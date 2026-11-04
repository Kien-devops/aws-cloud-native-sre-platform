# Lab 10.01: Resource Inventory & Ownership Cataloging

## 1. Mục tiêu & Nguyên lý SRE

Lab này thiết lập quy trình kiểm kê toàn diện (Resource Inventory) và định danh quyền sở hữu (Ownership Cataloging) cho tất cả tài nguyên hạ tầng AWS đã khởi tạo trong suốt vòng đời của dự án Cloud-Native SRE Platform (`ap-southeast-1`).

```
+---------------------------------------------------------------------------------------------------------+
|                                    AWS RESOURCE INVENTORY MATRIX                                        |
+---------------------------------------------------------------------------------------------------------+
|  VPC & Networking       Compute & Cluster         Database & Cache          Security & Identity         |
|  - 1x VPC (10.0.0.0/16) - 1x EKS Cluster (1.31)   - 1x RDS PostgreSQL (16)  - 1x KMS CMK Dev Key        |
|  - 6x Subnets (3 Tiers) - 1x MNG (system-nodes)   - 1x ElastiCache Redis    - 3x Secrets Manager Secrets|
|  - 1x IGW + 1x NAT GW   - Karpenter NodePools     - 1x SQS Queue + DLQ      - 1x GitHub OIDC Provider   |
|  - 1x S3 Gateway VPCE   - 1x Public ALB (LBC)     - 3x ECR Repositories     - 4x Pod Identity Roles     |
+---------------------------------------------------------------------------------------------------------+
                                                     |
                                                     v
+---------------------------------------------------------------------------------------------------------+
|                                 TAGGING COMPLIANCE & GOVERNANCE GATE                                    |
|   Project: sre-platform-dev  |  ManagedBy: Terraform / ArgoCD  |  Owner: platform-sre@company.internal  |
+---------------------------------------------------------------------------------------------------------+
```

### Nguyên lý SRE cốt lõi:
- **Zero Orphan Resources:** Bất kỳ tài nguyên điện toán, lưu trữ hay mạng nào không có chủ sở hữu (Owner) hoặc không nằm trong danh mục kiểm kê đều là rủi ro bảo mật tiềm ẩn và nguồn gây lãng phí chi phí (Cost Leakage).
- **Tagging as Infrastructure Invariant:** 100% tài nguyên phải mang các thẻ Tag bắt buộc: `Project`, `Environment`, `ManagedBy`, `Owner`, `CostCenter`, và `DataClassification`.
- **Pre-Handoff Reconciliation:** Đối chiếu thực tế hiện trạng AWS Console với mã nguồn Terraform và GitOps manifests trước khi tiến hành chuyển giao hoặc dọn dẹp.

---

## 2. Thông số kỹ thuật chuẩn hóa

| Khóa thuộc tính | Giá trị chuẩn hóa | Mô tả |
| :--- | :--- | :--- |
| **AWS Region** | `ap-southeast-1` (Singapore) | Khu vực triển khai chuẩn |
| **Project Tag** | `sre-platform-dev` | Khóa tag phân nhóm tài nguyên |
| **Environment Tag**| `dev` | Môi trường thử nghiệm |
| **ManagedBy Tag** | `Terraform` / `ArgoCD` | Hệ thống quản lý trạng thái hạ tầng |
| **Owner Tag** | `platform-sre@company.internal` | Đội ngũ kỹ thuật chịu trách nhiệm |
| **CostCenter Tag** | `CC-SRE-8820` | Mã số hạch toán chi phí |
| **DataClassification**| `Confidential` (DB/Secrets) / `Internal` | Phân loại độ nhạy cảm dữ liệu |

---

## 3. Thao tác trên AWS Management Console

### Bước 1: Mở Resource Groups & Tag Editor để quét toàn bộ tài nguyên
1. Đăng nhập AWS Management Console với quyền Administrator/Platform Engineer tại Region `ap-southeast-1`.
2. Trên thanh tìm kiếm, nhập `Resource Groups & Tag Editor` và chọn dịch vụ.
3. Trong menu bên trái, nhấp vào **Tag Editor**.
4. Cấu hình tiêu chí tìm kiếm:
   - **Regions:** Chọn `ap-southeast-1` (Singapore).
   - **Resource types:** Chọn `All resource types` (hoặc tick chọn `AWS::EC2::*`, `AWS::EKS::*`, `AWS::RDS::*`, `AWS::ElastiCache::*`, `AWS::SQS::*`, `AWS::SecretsManager::*`, `AWS::KMS::*`).
   - **Tags:**
     - Tag key: `Project`
     - Tag value: `sre-platform-dev`
5. Nhấp nút **Search resources**.
6. Hệ thống hiển thị bảng danh sách các tài nguyên đã gắn tag. Kiểm tra số lượng và xuất file bằng nút **Export to CSV**.

### Bước 2: Kiểm tra các tài nguyên bị sót Tag (Untagged Resources)
1. Trong màn hình **Tag Editor**, đảo ngược điều kiện tìm kiếm:
   - Giữ nguyên Region: `ap-southeast-1`.
   - Trong mục **Tags**, chọn `Not tagged` hoặc tìm kiếm tài nguyên không có khóa `Project`.
2. Rà soát các thành phần phụ thuộc thường bị sót tag tự động:
   - **EC2 Elastic IPs (EIP):** Kiểm tra EIP cấp phát cho NAT Gateway.
   - **EBS Volumes:** Các ổ cứng gp3 gắn kèm với EKS Worker Nodes.
   - **Network Interfaces (ENI):** Các ENI của VPC Interface Endpoints và Application Load Balancer.
   - **CloudWatch Log Groups:** `/aws/eks/sre-platform-dev-cluster/cluster`, `/aws/vpc/sre-platform-dev-vpc-flow-logs`.
   - **Route 53 Hosted Zones & ACM Certificates.**

### Bước 3: Tạo Resource Group lưu vết hạ tầng `sre-platform-dev`
1. Trong menu bên trái của dịch vụ **Resource Groups**, chọn **Create Resource Group**.
2. **Group type:** Chọn `Tag-based`.
3. **Group criteria:**
   - Resource types: `All supported resource types`.
   - Tags: Thêm điều kiện `Project` = `sre-platform-dev`.
4. **Group details:**
   - Group name: `sre-platform-dev-resources`.
   - Group description: `Tất cả tài nguyên thuộc dự án SRE Platform Dev môi trường ap-southeast-1`.
5. Nhấp **Create group**. Resource Group này sẽ là dashboard trung tâm theo dõi trạng thái tài nguyên trong suốt pha Handoff & Cleanup.

---

## 4. Ma trận kiểm kê tài nguyên chi tiết (Inventory Matrix)

Bảng tổng hợp chi tiết tài nguyên thực tế cần đối chiếu:

| Phân nhóm | Loại tài nguyên AWS | Tên định danh (Resource Identifier) | Quản lý bởi | Phụ thuộc chính | Mức độ rủi ro khi xóa |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Network** | `AWS::EC2::VPC` | `sre-platform-dev-vpc` (`10.0.0.0/16`) | Terraform | Không | Thấp (nếu rỗng) |
| **Network** | `AWS::EC2::Subnet` | `sre-platform-dev-public-1a/1b`, `private-app-1a/1b`, `private-db-1a/1b` | Terraform | VPC | Thấp |
| **Network** | `AWS::EC2::NatGateway` | `sre-platform-dev-nat-gw-1a` | Terraform | Public Subnet, EIP | Rủi ro rò rỉ chi phí ($0.059/hr) |
| **Network** | `AWS::EC2::EIP` | Cấp cho NAT Gateway | Terraform | NAT Gateway | $0.005/hr nếu unassociated |
| **Network** | `AWS::EC2::VPCEndpoint`| S3 Gateway Endpoint (`com.amazonaws.ap-southeast-1.s3`) | Terraform | VPC, Route Table | Thấp (Miễn phí) |
| **Compute** | `AWS::EKS::Cluster` | `sre-platform-dev-cluster` (v1.31) | Terraform | Private App Subnets, KMS | $0.10/hr |
| **Compute** | `AWS::EKS::Nodegroup`| `sre-platform-dev-system-nodes` (t3.medium) | Terraform | EKS Cluster, AL2023 AMI | Chi phí EC2 System Nodes |
| **Compute** | `Karpenter::NodePool` | `workload-spot` (c5.large/t3.large Spot) | Karpenter | EKS Cluster, EC2NodeClass | Tự động co giãn theo Pods |
| **Compute** | `AWS::ElasticLoadBalancingV2::LoadBalancer` | `k8s-reliabil-*` (ALB Ingress) | LBC (Controller)| Public Subnets, ACM Cert | $0.028/hr + LCU |
| **Database**| `AWS::RDS::DBInstance` | `sre-platform-dev-pg` (PostgreSQL v16.3) | Terraform | DB Subnet Group, KMS | **MẤT DỮ LIỆU** - Cần Final Snapshot |
| **Cache** | `AWS::ElastiCache::CacheCluster` | `sre-platform-dev-redis-001` (v7.1) | Terraform | Cache Subnet Group, KMS | Mất cache session |
| **Messaging**| `AWS::SQS::Queue` | `reliability-shop-dev-order-queue`, `*-dlq` | Terraform | KMS CMK | Mất thông điệp thanh toán chưa xử lý |
| **Storage** | `AWS::ECR::Repository`| `order-service`, `inventory-service`, `payment-worker` | Terraform | KMS CMK | Mất container images |
| **Security**| `AWS::KMS::Key` | `alias/sre-platform-dev-main` | Terraform | IAM Policies | **CỰC KỲ NGUY HIỂM** - Khóa dữ liệu nếu mất |
| **Security**| `AWS::SecretsManager::Secret` | `sre-platform/dev/database`, `redis`, `/credentials` | Terraform / Console | KMS CMK | Cần 7-day recovery window |

---

## 5. Xác thực bằng AWS CLI & Kịch bản tự động kiểm kê

### Lệnh 1: Quét và đếm tài nguyên theo Tag thông qua `Resource Groups Tagging API`
Chạy lệnh sau trên terminal để kiểm kê toàn bộ tài nguyên mang tag `Project=sre-platform-dev`:

```bash
aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=Project,Values=sre-platform-dev \
  --region ap-southeast-1 \
  --query "ResourceTagMappingList[].[ResourceARN]" \
  --output text | sort
```

*Kỳ vọng đầu ra (đã redacted Account ID):*
```text
arn:aws:ec2:ap-southeast-1:***:natgateway/nat-0a1b2c3d4e5f67890
arn:aws:ec2:ap-southeast-1:***:subnet/subnet-0111111111111111a
arn:aws:ec2:ap-southeast-1:***:vpc/vpc-00000000000000001
arn:aws:ecr:ap-southeast-1:***:repository/order-service
arn:aws:eks:ap-southeast-1:***:cluster/sre-platform-dev-cluster
arn:aws:elasticache:ap-southeast-1:***:cluster:sre-platform-dev-redis-001
arn:aws:kms:ap-southeast-1:***:key/12345678-1234-1234-1234-1234567890ab
arn:aws:rds:ap-southeast-1:***:db:sre-platform-dev-pg
arn:aws:secretsmanager:ap-southeast-1:***:secret:/sre-platform/dev/reliability-shop/credentials-AbCdEf
arn:aws:sqs:ap-southeast-1:***:reliability-shop-dev-order-queue
```

### Lệnh 2: Phát hiện các tài nguyên không có Tag chuẩn (Untagged Hunter)
Chạy script kiểm tra xem có volume EBS, ENI hoặc EIP nào bị mồ côi (orphaned/untagged):

```bash
# Kiểm tra Elastic IPs chưa gắn tag Project
aws ec2 describe-addresses \
  --region ap-southeast-1 \
  --query "Addresses[?Tags==null || !contains(Tags[].Key, 'Project')].[AllocationId,PublicIp]" \
  --output table

# Kiểm tra EBS Volumes chưa gắn tag Project
aws ec2 describe-volumes \
  --region ap-southeast-1 \
  --query "Volumes[?Tags==null || !contains(Tags[].Key, 'Project')].[VolumeId,Size,State]" \
  --output table
```

### Lệnh 3: Tự động bổ sung Tag chuẩn hóa cho tài nguyên còn thiếu
Nếu phát hiện tài nguyên thiếu tag, chạy script batch tag tự động:

```bash
TARGET_ARN="arn:aws:ec2:ap-southeast-1:***:natgateway/nat-0a1b2c3d4e5f67890"

aws resourcegroupstaggingapi tag-resources \
  --resource-arn-list "${TARGET_ARN}" \
  --tags Project=sre-platform-dev,Environment=dev,ManagedBy=Terraform,Owner=platform-sre@company.internal,CostCenter=CC-SRE-8820 \
  --region ap-southeast-1
```

---

## 6. SRE Gate Check & Tiêu chí nghiệm thu

| STT | Hạng mục kiểm tra (Gate Criteria) | Điều kiện đạt (Pass Criteria) | Trạng thái |
| :--- | :--- | :--- | :--- |
| 1 | **Tagging Compliance** | 100% tài nguyên liên quan đến lab mang đủ bộ 5 tags bắt buộc | [x] Đạt |
| 2 | **Orphan Resource Audit** | Không có EIP nào ở trạng thái unassociated; không có EBS volume ở trạng thái `available` (unattached) | [x] Đạt |
| 3 | **Stateful Resource Identification** | Xác định rõ 2 tài nguyên chứa dữ liệu quan trọng: RDS PostgreSQL (`sre-platform-dev-pg`) và Secrets Manager, đã được đánh dấu nhãn `Lifecycle=Persistent` | [x] Đạt |
| 4 | **Owner Sign-off** | Đội ngũ SRE xác nhận danh mục kiểm kê đầy đủ trước khi thực hiện bước chuyển giao | [x] Đạt |

---

## 7. Quy tắc an toàn & Bước kế tiếp

> [!WARNING]
> **Tuyệt đối không thực hiện xóa tài nguyên ở bước này.** Việc một tài nguyên bị thiếu tag không đồng nghĩa với việc nó là tài nguyên thừa. Cần đối chiếu kỹ với bảng Inventory Matrix để tránh xóa nhầm VPC, KMS CMK hoặc IAM OIDC Provider đang phục vụ cluster.

Chuyển sang [Lab 10.02: GitOps Drift Detection & Reconciliation](02-gitops-drift-reconciliation.md) để kiểm tra tính toàn vẹn cấu hình và tự động hòa giải trôi lệch trên cụm EKS.
