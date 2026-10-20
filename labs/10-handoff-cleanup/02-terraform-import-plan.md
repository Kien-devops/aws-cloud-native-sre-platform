# Lab 10.02: Terraform Import & State Reconciliation Plan

## 1. Mục tiêu & Nguyên lý SRE

Lab này hướng dẫn quy trình chuyển giao chuẩn kỹ thuật từ hạ tầng khởi tạo bằng AWS Management Console sang quản lý hoàn toàn bằng Infrastructure as Code (IaC) với **Terraform**. Mục tiêu tối thượng là nhập trạng thái tài nguyên thực tế (`terraform import`) vào Terraform State mà **không làm thay đổi, gián đoạn hoặc xóa nhầm (Zero Destruction/Zero Disruption)** bất kỳ dịch vụ nào đang vận hành.

```
+----------------------------------------------------------------------------------------------------+
|                           TERRAFORM IMPORT & STATE RECONCILIATION WORKFLOW                         |
+----------------------------------------------------------------------------------------------------+
|  1. AWS Console/CLI         2. HCL Authoring          3. Terraform Import      4. Drift Resolution |
|  [Extract Real ID]   --->   [Write Resource Block] -> [Import into State] ---> [terraform plan]   |
|  vpc-0000000000001          resource "aws_vpc"        terraform import ...     [Iterate until:    |
|                             cidr_block = "..."                                 "No changes"]      |
+----------------------------------------------------------------------------------------------------+
                                                     |
                                                     v
+----------------------------------------------------------------------------------------------------+
|                                    SRE SAFETY GATES & VERIFICATION                                 |
|  - S3 Remote State Lock Active  |  Plan: 0 to add, 0 to change, 0 to destroy  | No Forces New EC2  |
+----------------------------------------------------------------------------------------------------+
```

### Nguyên lý SRE cốt lõi:
- **Zero-Disruption Import:** Không bao giờ áp dụng (`terraform apply`) khi lệnh `terraform plan` còn hiển thị bất kỳ cảnh báo `forces replacement` nào đối với tài nguyên Stateful (Database, VPC, KMS, EKS).
- **Single Source of Truth:** Sau khi import thành công, AWS Management Console chỉ dùng để quan sát (read-only); mọi thay đổi cấu hình phải được thực hiện qua Pull Request vào thư mục `iac/terraform/`.
- **State Locking & Versioning:** Terraform State được lưu trữ tập trung tại S3 Bucket có mã hóa KMS và bật Versioning, đồng bộ khóa đồng thời (Mutex Lock) qua bảng DynamoDB `sre-platform-dev-tf-locks`.

---

## 2. Chuẩn bị môi trường & Remote State Backend

Đảm bảo cấu hình backend từ Lab 03.02 đã sẵn sàng trong file `iac/terraform/backend.tf`:

```hcl
terraform {
  required_version = ">= 1.8.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
  }

  backend "s3" {
    bucket         = "sre-platform-dev-tfstate-ap-southeast-1"
    key            = "dev/platform/terraform.tfstate"
    region         = "ap-southeast-1"
    dynamodb_table = "sre-platform-dev-tf-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = "ap-southeast-1"

  default_tags {
    tags = {
      Project       = "sre-platform-dev"
      Environment   = "dev"
      ManagedBy     = "Terraform"
      Owner         = "platform-sre@company.internal"
      CostCenter    = "CC-SRE-8820"
    }
  }
}
```

Khởi tạo backend:
```bash
cd iac/terraform
terraform init
```

---

## 3. Quy trình Import từng nhóm tài nguyên chi tiết

### Nhóm 1: Mạng VPC & Cổng kết nối (Networking)

#### 1. Khai báo mã nguồn HCL trong `iac/terraform/01-vpc.tf`:
```hcl
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "sre-platform-dev-vpc"
  }
}

resource "aws_subnet" "public_1a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = "ap-southeast-1a"
  map_public_ip_on_launch = true

  tags = {
    Name                     = "sre-platform-dev-public-subnet-1a"
    "kubernetes.io/role/elb" = "1"
  }
}

resource "aws_nat_gateway" "nat_1a" {
  allocation_id = aws_eip.nat_eip.id
  subnet_id     = aws_subnet.public_1a.id

  tags = {
    Name = "sre-platform-dev-nat-gw-1a"
  }
}

resource "aws_eip" "nat_eip" {
  domain = "vpc"

  tags = {
    Name = "sre-platform-dev-nat-eip"
  }
}
```

#### 2. Thực thi lệnh Import:
Truy vấn ID thực tế từ AWS CLI hoặc Console và chạy:
```bash
# Lấy VPC ID thực tế
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=tag:Name,Values=sre-platform-dev-vpc" --query "Vpcs[0].VpcId" --output text)
SUBNET_PUB_1A=$(aws ec2 describe-subnets --filters "Name=tag:Name,Values=sre-platform-dev-public-subnet-1a" --query "Subnets[0].SubnetId" --output text)
NAT_ID=$(aws ec2 describe-nat-gateways --filter "Name=tag:Name,Values=sre-platform-dev-nat-gw-1a" --query "NatGateways[0].NatGatewayId" --output text)
EIP_ALLOC=$(aws ec2 describe-nat-gateways --filter "Name=tag:Name,Values=sre-platform-dev-nat-gw-1a" --query "NatGateways[0].NatGatewayAddresses[0].AllocationId" --output text)

# Thực hiện import vào Terraform state
terraform import aws_vpc.main ${VPC_ID}
terraform import aws_subnet.public_1a ${SUBNET_PUB_1A}
terraform import aws_eip.nat_eip ${EIP_ALLOC}
terraform import aws_nat_gateway.nat_1a ${NAT_ID}
```

---

### Nhóm 2: Cơ sở dữ liệu RDS PostgreSQL & ElastiCache Redis

#### 1. Khai báo mã nguồn HCL trong `iac/terraform/02-databases.tf`:
```hcl
resource "aws_db_instance" "postgres" {
  identifier           = "sre-platform-dev-postgres"
  allocated_storage    = 20
  max_allocated_storage= 50
  engine               = "postgres"
  engine_version       = "16.3"
  instance_class       = "db.t4g.micro"
  db_name              = "reliabilityshop"
  username             = "sreadmin"
  skip_final_snapshot  = false
  final_snapshot_identifier = "sre-platform-dev-postgres-final-snap"
  
  storage_encrypted    = true
  kms_key_id          = aws_kms_key.main.arn
  publicly_accessible  = false

  lifecycle {
    ignore_changes = [
      password,
      latest_restorable_time
    ]
  }
}

resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "sre-platform-dev-redis"
  engine               = "redis"
  node_type            = "cache.t4g.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379

  lifecycle {
    ignore_changes = [
      num_cache_nodes
    ]
  }
}
```

#### 2. Thực thi lệnh Import:
```bash
terraform import aws_db_instance.postgres sre-platform-dev-postgres
terraform import aws_elasticache_cluster.redis sre-platform-dev-redis
```

---

### Nhóm 3: EKS Cluster & Managed Node Group

#### 1. Khai báo mã nguồn HCL trong `iac/terraform/03-eks.tf`:
```hcl
resource "aws_eks_cluster" "platform" {
  name     = "sre-platform-dev-cluster"
  version  = "1.30"
  role_arn = "arn:aws:iam::***:role/sre-platform-dev-eks-cluster-role"

  vpc_config {
    subnet_ids              = [aws_subnet.private_app_1a.id, aws_subnet.private_app_1b.id]
    endpoint_private_access = true
    endpoint_public_access  = true
  }

  enabled_cluster_log_types = ["api", "audit", "authenticator", "controllerManager", "scheduler"]

  encryption_config {
    provider {
      key_arn = aws_kms_key.main.arn
    }
    resources = ["secrets"]
  }
}

resource "aws_eks_node_group" "default" {
  cluster_name    = aws_eks_cluster.platform.name
  node_group_name = "sre-platform-dev-mng-default"
  node_role_arn   = "arn:aws:iam::***:role/sre-platform-dev-eks-nodegroup-role"
  subnet_ids      = [aws_subnet.private_app_1a.id, aws_subnet.private_app_1b.id]
  instance_types  = ["t3.medium"]

  scaling_config {
    desired_size = 2
    max_size     = 4
    min_size     = 2
  }
}
```

#### 2. Thực thi lệnh Import:
```bash
terraform import aws_eks_cluster.platform sre-platform-dev-cluster
terraform import aws_eks_node_group.default sre-platform-dev-cluster:sre-platform-dev-mng-default
```

---

### Nhóm 4: Bảo mật & Messaging (KMS, Secrets Manager, SQS, ECR)

#### 1. Khai báo HCL và Import:
```bash
# Import KMS Key và Alias
KMS_KEY_ID=$(aws kms describe-key --key-id alias/sre-platform-dev-main --query "KeyMetadata.KeyId" --output text)
terraform import aws_kms_key.main ${KMS_KEY_ID}
terraform import aws_kms_alias.main alias/sre-platform-dev-main

# Import Secrets Manager Secret
terraform import aws_secretsmanager_secret.creds arn:aws:secretsmanager:ap-southeast-1:***:secret:/sre-platform/dev/reliability-shop/credentials

# Import SQS Queue & DLQ
QUEUE_URL=$(aws sqs get-queue-url --queue-name sre-platform-dev-payment-queue --query "QueueUrl" --output text)
DLQ_URL=$(aws sqs get-queue-url --queue-name sre-platform-dev-payment-queue-dlq --query "QueueUrl" --output text)
terraform import aws_sqs_queue.payment ${QUEUE_URL}
terraform import aws_sqs_queue.payment_dlq ${DLQ_URL}

# Import ECR Repositories
terraform import aws_ecr_repository.order order-service
terraform import aws_ecr_repository.inventory inventory-service
terraform import aws_ecr_repository.payment payment-worker
```

---

## 4. Xử lý lệch trạng thái (Reconciling Drift & Plan Loop)

Sau khi nhập tài nguyên vào state, chạy lệnh `terraform plan` để phát hiện sự khác biệt giữa code HCL và thực tế:

```bash
terraform plan -out=tfplan.binary
```

### Các tình huống Drift phổ biến và cách khắc phục:
1. **Lệch Tag mặc định (Default Tags mismatch):**
   - *Triệu chứng:* Terraform muốn cập nhật lại toàn bộ tag trên tài nguyên.
   - *Giải pháp:* Đảm bảo khối `default_tags` trong `provider "aws"` trùng khớp hoàn toàn với các Tag đã gán ở Lab 10.01.
2. **Thuộc tính do AWS tự sinh (Computed Attributes):**
   - *Triệu chứng:* Cảnh báo `forces replacement` trên các trường như mật khẩu DB hoặc VPC CIDR block.
   - *Giải pháp:* Thêm khối `lifecycle { ignore_changes = [ ... ] }` cho các trường tính toán hoặc bảo mật động.
3. **Mục tiêu đạt được (Success Metric):**
   Lặp lại việc chỉnh sửa code HCL và chạy lại `terraform plan` cho đến khi màn hình hiển thị:
   ```text
   No changes. Your infrastructure matches the configuration.
   ```
   Hoặc:
   ```text
   Plan: 0 to add, 0 to change, 0 to destroy.
   ```

---

## 5. Thiết lập Pipeline tự động kiểm tra Drift định kỳ

Tạo GitHub Actions workflow `.github/workflows/terraform-drift-detection.yaml` để tự động cảnh báo nếu có thao tác can thiệp thủ công trên Console:

```yaml
name: "Terraform Scheduled Drift Detection"

on:
  schedule:
    - cron: "0 2 * * *" # Chạy 09:00 AM VN hàng ngày
  workflow_dispatch:

jobs:
  drift-check:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Configure AWS Credentials via OIDC
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::***:role/github-actions-oidc-sre-platform
          aws-region: ap-southeast-1

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: 1.8.5

      - name: Terraform Init
        run: terraform init
        working-directory: iac/terraform

      - name: Terraform Plan (Detailed Exit Code)
        id: plan
        run: |
          terraform plan -detailed-exitcode -no-color || exit_code=$?
          echo "exit_code=${exit_code}" >> $GITHUB_OUTPUT
          if [ $exit_code -eq 2 ]; then
            echo "::error::Phát hiện hạ tầng thực tế bị lệch (Drift) so với mã nguồn Git!"
            exit 2
          elif [ $exit_code -eq 0 ]; then
            echo "Hạ tầng hoàn toàn đồng nhất. Không có drift."
          else
            exit $exit_code
          fi
        working-directory: iac/terraform
```

---

## 6. SRE Gate Check & Tiêu chí nghiệm thu

| STT | Hạng mục kiểm tra (Gate Criteria) | Điều kiện đạt (Pass Criteria) | Trạng thái |
| :--- | :--- | :--- | :--- |
| 1 | **Terraform Plan Parity** | `terraform plan` trả về `0 to add, 0 to change, 0 to destroy` trên toàn bộ tài nguyên nền tảng | [ ] Đạt |
| 2 | **Zero Destructive Changes** | Tuyệt đối không có bất kỳ cờ `forces replacement` nào xuất hiện trong plan | [ ] Đạt |
| 3 | **State Locking Verification** | DynamoDB table `sre-platform-dev-tf-locks` khóa và mở khóa thành công trong suốt phiên chạy | [ ] Đạt |
| 4 | **No Static Secrets in Code** | File HCL không chứa mật khẩu tĩnh hoặc API token; toàn bộ tham chiếu qua Secrets Manager hoặc biến môi trường an toàn | [ ] Đạt |

---

## 7. Quy tắc an toàn & Bước kế tiếp

> [!CAUTION]
> **Không bao giờ chạy `terraform apply -auto-approve` trong quá trình import.** Bất kỳ sai sót nào trong định nghĩa HCL có thể dẫn đến việc Terraform tự động xóa và tạo lại VPC hoặc cơ sở dữ liệu RDS, gây gián đoạn hoàn toàn hệ thống.

Chuyển sang [Lab 10.03: GitOps Ownership & Drift Management](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/10-handoff-cleanup/03-gitops-ownership.md) để phân định rõ ràng quyền kiểm soát giữa Terraform và Argo CD.
