# 05.03 — Điều kiện tiên quyết cho AWS Load Balancer Controller (LBC)

> **Trạng thái:** Hướng dẫn thực hành chi tiết trên AWS Management Console (Console-first).  
> **Áp dụng cho:** Chuẩn bị Subnet tags, IAM Role Pod Identity và Security Groups để AWS Load Balancer Controller tự động quản lý Application Load Balancer (ALB).

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Gắn tag định danh subnet trên VPC Console để AWS Load Balancer Controller (LBC) tự động nhận diện public subnet (cho internet-facing ALB) và private subnet (cho internal ALB).
  - Khởi tạo IAM Policy và IAM Role với quyền hạn tối thiểu cho LBC, liên kết qua EKS Pod Identity.
  - Thiết lập Security Group chuyên biệt cho Application Load Balancer để kiểm soát chặt chẽ luồng traffic mạng từ internet vào worker nodes.
- **Nguyên tắc SRE:**
  - **Dynamic Ingress Provisioning:** Controller tự động tạo, cấu hình và cập nhật ALB dựa trên Ingress manifest trong Kubernetes; không tạo ALB thủ công bằng Console cho workloads.
  - **Network Segmentation & Perimeter Defense:** Tách biệt rõ ràng Security Group của ALB (chỉ mở 80/443 ra Internet) và Security Group của Node (chỉ nhận traffic bắt nguồn từ ALB).
  - **Multi-AZ High Availability:** ALB bắt buộc phải liên kết tối thiểu hai Public Subnet thuộc hai Availability Zone khác nhau để đảm bảo khả năng chịu lỗi tầng mạng.

---

## 2. Thông số đầu vào (Input Parameters)

| Tham số | Giá trị mẫu / Quy ước | Ý nghĩa |
| :--- | :--- | :--- |
| **VPC ID** | `vpc-xxxxxxxxxxxxxxxxx` | VPC chứa nền tảng EKS |
| **EKS Cluster Name** | `sre-platform-dev` | Tên cluster EKS quản trị |
| **Public Subnet 1 (AZ-a)** | `subnet-pub-1a` (`10.0.0.0/24`) | Subnet cho ALB Listener tại AZ a |
| **Public Subnet 2 (AZ-b)** | `subnet-pub-1b` (`10.0.1.0/24`) | Subnet cho ALB Listener tại AZ b |
| **IAM Policy Name** | `AWSLoadBalancerControllerIAMPolicy` | Policy chính thức từ AWS dành cho LBC |
| **IAM Role Name** | `sre-platform-dev-lbc-role` | Role EKS Pod Identity cho Controller |
| **ALB Security Group** | `sre-platform-dev-alb-sg` | Cho phép HTTP (80) và HTTPS (443) từ `0.0.0.0/0` |

---

## 3. Các bước thực hiện chi tiết trên AWS Console (Console Steps)

### Bước 1: Gắn Subnet Tags cho AWS Load Balancer Controller Discovery

1. Mở ô tìm kiếm Console -> Nhập `VPC` -> Chọn dịch vụ **VPC**.
2. Tại menu bên trái, nhấp vào **Subnets**.
3. **Cấu hình Public Subnets (Dành cho Internet-facing ALB):**
   - Tìm và chọn **Public Subnet 1** (`sre-platform-dev-public-1a`).
   - Chọn tab **Tags** ở góc dưới -> Nhấp nút **Manage tags**.
   - Nhấp **Add new tag**:
     - **Key:** `kubernetes.io/role/elb` — **Value:** `1`
   - Nhấp **Add new tag**:
     - **Key:** `kubernetes.io/cluster/sre-platform-dev` — **Value:** `shared`
   - Nhấp **Save changes**.
   - Lặp lại thao tác trên cho **Public Subnet 2** (`sre-platform-dev-public-1b`).
4. **Cấu hình Private Subnets (Dành cho Internal ALB / Pods):**
   - Tìm và chọn **Private Subnet 1** (`sre-platform-dev-private-1a`).
   - Chọn tab **Tags** -> Nhấp **Manage tags**.
   - Nhấp **Add new tag**:
     - **Key:** `kubernetes.io/role/internal-elb` — **Value:** `1`
   - Nhấp **Add new tag**:
     - **Key:** `kubernetes.io/cluster/sre-platform-dev` — **Value:** `shared`
   - Nhấp **Save changes**.
   - Lặp lại cho **Private Subnet 2** (`sre-platform-dev-private-1b`).

> [!IMPORTANT]
> Nếu thiếu tag `kubernetes.io/role/elb = 1`, LBC sẽ báo lỗi không tìm thấy subnet hợp lệ khi tạo Ingress và ALB sẽ không thể khởi tạo.

---

### Bước 2: Tạo IAM Policy cho AWS Load Balancer Controller

1. Mở ô tìm kiếm Console -> Nhập `IAM` -> Chọn **IAM**.
2. Chọn **Policies** ở menu bên trái -> Nhấp nút cam **Create policy**.
3. Chuyển sang tab **JSON** trong Policy editor.
4. Tải hoặc sao chép policy chính thức khuyến nghị từ AWS cho Load Balancer Controller v2.7+:
   *(Truy cập [AWS LBC IAM Policy v2.7+](https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.7.2/docs/install/iam_policy.json) và dán toàn bộ JSON vào editor)*.
5. Nhấp **Next**.
6. **Policy name:** Nhập `AWSLoadBalancerControllerIAMPolicy`.
7. **Description:** `IAM policy for AWS Load Balancer Controller on EKS`.
8. Nhấp **Create policy**.

---

### Bước 3: Tạo IAM Role Pod Identity cho AWS Load Balancer Controller

1. Tại menu bên trái của IAM, nhấp vào **Roles** -> Nhấp **Create role**.
2. **Select trusted entity:**
   - Chọn **Custom trust policy**.
   - Dán Trust Policy cho EKS Pod Identity:
     ```json
     {
       "Version": "2012-10-17",
       "Statement": [
         {
           "Sid": "AllowEKSPodIdentity",
           "Effect": "Allow",
           "Principal": {
             "Service": "pods.eks.amazonaws.com"
           },
           "Action": [
             "sts:AssumeRole",
             "sts:TagSession"
           ]
         }
       ]
     }
     ```
   - Nhấp **Next**.
3. **Add permissions:**
   - Tìm kiếm `AWSLoadBalancerControllerIAMPolicy` vừa tạo.
   - Tích chọn checkbox cạnh policy.
   - Nhấp **Next**.
4. **Name, review, and create:**
   - **Role name:** Nhập `sre-platform-dev-lbc-role`.
   - **Tags:** `Environment` = `dev`, `Project` = `sre-platform`.
   - Nhấp **Create role**.

---

### Bước 4: Tạo Pod Identity Association trên EKS Console

1. Vào **Amazon EKS Console** -> Chọn cluster `sre-platform-dev`.
2. Chuyển sang tab **Access** -> Kéo xuống mục **Pod Identity associations**.
3. Nhấp nút **Create Pod Identity association**.
4. Điền các giá trị chính xác sau:
   - **IAM role:** Chọn `sre-platform-dev-lbc-role`.
   - **Kubernetes namespace:** Nhập `kube-system`.
   - **Kubernetes service account:** Nhập `aws-load-balancer-controller`.
5. Nhấp **Create**.
6. Xác nhận Association có trạng thái **Active**.

---

### Bước 5: Tạo Security Group cho ALB trên EC2 Console

1. Mở ô tìm kiếm Console -> Nhập `EC2` -> Chọn **EC2**.
2. Tại menu bên trái, mục **Network & Security**, chọn **Security Groups**.
3. Nhấp nút cam **Create security group**.
4. **Basic details:**
   - **Security group name:** `sre-platform-dev-alb-sg`.
   - **Description:** `Security Group for Public Ingress ALB`.
   - **VPC:** Chọn đúng VPC của lab (`sre-platform-dev-vpc`).
5. **Inbound rules:**
   - Nhấp **Add rule**:
     - **Type:** `HTTP` (Port 80) — **Source:** `Anywhere-IPv4` (`0.0.0.0/0`) — **Description:** `Allow HTTP from internet for redirect`.
   - Nhấp **Add rule**:
     - **Type:** `HTTPS` (Port 443) — **Source:** `Anywhere-IPv4` (`0.0.0.0/0`) — **Description:** `Allow secure HTTPS traffic from internet`.
6. **Outbound rules:**
   - Giữ nguyên `All traffic` ra `0.0.0.0/0` (hoặc giới hạn đến EKS Node Security Group).
7. **Tags:** Thêm `Environment` = `dev`, `Project` = `sre-platform`.
8. Nhấp **Create security group**.
9. Sao chép lại **Security Group ID** (ví dụ `sg-0123456789abcdef0`).

---

### Bước 6: Cập nhật Inbound Rule cho EKS Node Security Group

1. Vẫn tại màn hình **Security Groups**, tìm kiếm Security Group của EKS Node Group (thường có tên dạng `eks-cluster-sg-...` hoặc `sre-platform-dev-node-sg`).
2. Chọn Security Group này -> Chọn tab **Inbound rules** -> Nhấp **Edit inbound rules**.
3. Nhấp **Add rule**:
   - **Type:** `All traffic` (hoặc Custom TCP Port Range `1025-65535` cho NodePort / Pod IPs).
   - **Source:** Chọn `Custom` -> Nhập ID của `sre-platform-dev-alb-sg` vừa tạo ở Bước 5.
   - **Description:** `Allow inbound traffic from Public ALB to worker pods`.
4. Nhấp **Save rules**.

---

## 4. Xác minh (Verification)

### 4.1. Kiểm tra bằng AWS CLI
Xác nhận Subnet tags:

```bash
aws ec2 describe-subnets \
  --filters "Name=tag:kubernetes.io/role/elb,Values=1" \
  --query 'Subnets[*].{ID:SubnetId,AZ:AvailabilityZone,CIDR:CidrBlock,Tags:Tags}' \
  --output table
```

Xác nhận Pod Identity Association:

```bash
aws eks list-pod-identity-associations \
  --cluster-name sre-platform-dev \
  --namespace kube-system \
  --output table
```

---

## 5. Chuyển giao sang IaC (Terraform Snippet)

```hcl
# Subnet Tagging trong Module VPC
resource "aws_ec2_tag" "public_subnet_lbc" {
  for_each    = toset(module.vpc.public_subnets)
  resource_id = each.value
  key         = "kubernetes.io/role/elb"
  value       = "1"
}

# ALB Security Group
resource "aws_security_group" "alb" {
  name        = "sre-platform-dev-alb-sg"
  description = "Security Group for Public Ingress ALB"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description = "HTTP Redirect"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS Inbound"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Environment = "dev"
    Project     = "sre-platform"
  }
}
```

---

## 6. Điều kiện hoàn thành Gate (Gate Check)

- [ ] Tối thiểu 2 Public Subnet thuộc 2 AZ khác nhau có tag `kubernetes.io/role/elb = 1`.
- [ ] IAM Policy `AWSLoadBalancerControllerIAMPolicy` tồn tại và gắn vào role `sre-platform-dev-lbc-role`.
- [ ] EKS Pod Identity Association cho `kube-system/aws-load-balancer-controller` ở trạng thái `Active`.
- [ ] Security Group `sre-platform-dev-alb-sg` đã mở cổng 80/443 và Node Security Group đã cấp phép nhận traffic từ ALB.
- [ ] Sẵn sàng để GitOps cài đặt Helm chart `aws-load-balancer-controller` mà không bị lỗi thiếu quyền AWS.

---

## 7. Dọn dẹp tài nguyên (Cleanup)

1. Xóa EKS Pod Identity Association trong EKS Console.
2. Xóa Security Group `sre-platform-dev-alb-sg` (lưu ý xóa bỏ rule tham chiếu trong Node SG trước).
3. Xóa IAM Role `sre-platform-dev-lbc-role` và Policy `AWSLoadBalancerControllerIAMPolicy`.
4. Gỡ bỏ các tag `kubernetes.io/role/elb` khỏi subnets nếu không còn sử dụng.
