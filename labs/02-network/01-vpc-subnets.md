# 02.01 — Khởi tạo Amazon VPC và Hệ thống Subnets Đa Availability Zone

> **Trạng thái:** Hướng dẫn thực hành chi tiết trên AWS Management Console (Console-first).  
> **Áp dụng cho:** Xây dựng nền tảng mạng Private-first, High-Availability (HA) phục vụ EKS Cluster, RDS PostgreSQL và ElastiCache Redis.

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Khởi tạo Amazon Virtual Private Cloud (VPC) với dải địa chỉ IPv4 không chồng lấn (`10.0.0.0/16`).
  - Thiết kế kiến trúc phân tầng 3 lớp (3-Tier Network Architecture) trải dài trên **tối thiểu 2 Availability Zones** (`ap-southeast-1a` và `ap-southeast-1b`):
    1. **Public Subnets:** Chỉ dành riêng cho Ingress ALBs và NAT Gateways.
    2. **Private App Subnets:** Dành cho EKS Control Plane ENIs, EKS Worker Nodes và Pods.
    3. **Private Database Subnets:** Dành riêng cho RDS và ElastiCache, tuyệt đối không có đường đi trực tiếp ra Internet.
  - Gắn nhãn chuẩn (Subnet Tags) để AWS Load Balancer Controller và Karpenter tự động phát hiện (Auto-Discovery).
- **Nguyên tắc SRE:**
  - **Private-First & Zero Public Workloads:** Nghiêm cấm đặt Worker Nodes, Pods, hoặc Databases trong Public Subnets. Toàn bộ traffic nghiệp vụ phải nằm trong Private Subnets được bảo vệ.
  - **Fault Domain Isolation (Cô lập vùng lỗi):** Mọi tầng kiến trúc đều phải được phân bổ cân bằng trên ít nhất 2 AZ độc lập về nguồn điện, mạng và phần cứng.
  - **Sufficient IP Headroom (Dự phòng IP cho Pods):** Sử dụng dải subnet đủ rộng (`/24` hoặc `/20`) để tránh hiện tượng AWS VPC CNI cạn kiệt địa chỉ IP khi hệ thống autoscaling tăng vọt.

---

## 2. Thông số đầu vào và Sơ đồ Địa chỉ IP (IP Plan)

| Tên Subnet | CIDR Block | Availability Zone | Mục đích sử dụng |
| :--- | :--- | :--- | :--- |
| `sre-platform-dev-public-1a` | `10.0.0.0/24` (251 IPs) | `ap-southeast-1a` | Public ALB, NAT Gateway AZ-a |
| `sre-platform-dev-public-1b` | `10.0.1.0/24` (251 IPs) | `ap-southeast-1b` | Public ALB, NAT Gateway AZ-b |
| `sre-platform-dev-private-app-1a` | `10.0.10.0/24` (251 IPs) | `ap-southeast-1a` | EKS Nodes, Pods, Karpenter AZ-a |
| `sre-platform-dev-private-app-1b` | `10.0.11.0/24` (251 IPs) | `ap-southeast-1b` | EKS Nodes, Pods, Karpenter AZ-b |
| `sre-platform-dev-private-db-1a` | `10.0.20.0/24` (251 IPs) | `ap-southeast-1a` | RDS PostgreSQL, Redis AZ-a |
| `sre-platform-dev-private-db-1b` | `10.0.21.0/24` (251 IPs) | `ap-southeast-1b` | RDS PostgreSQL Standby, Redis AZ-b |

---

## 3. Các bước thực hiện chi tiết trên AWS Console (Console Steps)

### Bước 1: Khởi tạo Virtual Private Cloud (VPC)

1. Đăng nhập vào **AWS Console**, chọn Region `ap-southeast-1`.
2. Nhập `VPC` vào ô tìm kiếm -> Chọn dịch vụ **VPC**.
3. Tại menu bên trái, nhấp vào **Your VPCs** -> Nhấp nút cam **Create VPC**.
4. **VPC settings:**
   - Chọn radio button **VPC only** (để tự tay cấu hình từng subnet và hiểu sâu kiến trúc, không dùng wizard tự động).
   - **Name tag:** Nhập `sre-platform-dev-vpc`.
   - **IPv4 CIDR block:** Nhập `10.0.0.0/16`.
   - **IPv6 CIDR block:** Chọn `No IPv6 CIDR block`.
   - **Tenancy:** Chọn `Default`.
   - **Tags:**
     - `Project`: `sre-platform`
     - `Environment`: `dev`
     - `ManagedBy`: `Console-to-IaC`
5. Nhấp **Create VPC**.

---

### Bước 2: Bật DNS Hostnames và DNS Resolution

> [!IMPORTANT]
> EKS Cluster, RDS và VPC Endpoints bắt buộc yêu cầu cả hai thuộc tính DNS Hostnames và DNS Resolution phải được kích hoạt để phân giải tên miền nội bộ.

1. Tại danh sách **Your VPCs**, chọn `sre-platform-dev-vpc`.
2. Nhấp vào menu **Actions** ở góc trên bên phải -> Chọn **Edit VPC settings**.
3. Tại mục **DNS settings**:
   - Tích chọn **Enable DNS resolution**.
   - Tích chọn **Enable DNS hostnames**.
4. Nhấp nút **Save changes**.

---

### Bước 3: Tạo 6 Subnets Phân tầng trên 2 Availability Zones

Tại menu bên trái của VPC Console, nhấp vào **Subnets** -> Nhấp nút cam **Create subnet**:

1. **Chọn VPC:** Chọn `sre-platform-dev-vpc`.
2. **Tạo Subnet 1 (Public AZ-a):**
   - **Subnet name:** `sre-platform-dev-public-1a`.
   - **Availability Zone:** Chọn `ap-southeast-1a`.
   - **IPv4 subnet CIDR block:** `10.0.0.0/24`.
   - **Tags:**
     - `kubernetes.io/role/elb` = `1`
     - `kubernetes.io/cluster/sre-platform-dev` = `shared`
3. Nhấp **Add new subnet** (ngay bên dưới để tạo hàng loạt):
4. **Tạo Subnet 2 (Public AZ-b):**
   - **Subnet name:** `sre-platform-dev-public-1b`.
   - **Availability Zone:** Chọn `ap-southeast-1b`.
   - **IPv4 subnet CIDR block:** `10.0.1.0/24`.
   - **Tags:**
     - `kubernetes.io/role/elb` = `1`
     - `kubernetes.io/cluster/sre-platform-dev` = `shared`
5. Nhấp **Add new subnet**:
6. **Tạo Subnet 3 (Private App AZ-a):**
   - **Subnet name:** `sre-platform-dev-private-app-1a`.
   - **Availability Zone:** Chọn `ap-southeast-1a`.
   - **IPv4 subnet CIDR block:** `10.0.10.0/24`.
   - **Tags:**
     - `kubernetes.io/role/internal-elb` = `1`
     - `kubernetes.io/cluster/sre-platform-dev` = `shared`
     - `karpenter.sh/discovery` = `sre-platform-dev`
7. Nhấp **Add new subnet**:
8. **Tạo Subnet 4 (Private App AZ-b):**
   - **Subnet name:** `sre-platform-dev-private-app-1b`.
   - **Availability Zone:** Chọn `ap-southeast-1b`.
   - **IPv4 subnet CIDR block:** `10.0.11.0/24`.
   - **Tags:**
     - `kubernetes.io/role/internal-elb` = `1`
     - `kubernetes.io/cluster/sre-platform-dev` = `shared`
     - `karpenter.sh/discovery` = `sre-platform-dev`
9. Nhấp **Add new subnet**:
10. **Tạo Subnet 5 (Private Database AZ-a):**
    - **Subnet name:** `sre-platform-dev-private-db-1a`.
    - **Availability Zone:** Chọn `ap-southeast-1a`.
    - **IPv4 subnet CIDR block:** `10.0.20.0/24`.
    - **Tags:** `Component` = `database`.
11. Nhấp **Add new subnet**:
12. **Tạo Subnet 6 (Private Database AZ-b):**
    - **Subnet name:** `sre-platform-dev-private-db-1b`.
    - **Availability Zone:** Chọn `ap-southeast-1b`.
    - **IPv4 subnet CIDR block:** `10.0.21.0/24`.
    - **Tags:** `Component` = `database`.
13. Nhấp nút **Create subnet** ở cuối trang để hoàn tất tạo đồng loạt 6 subnets.

---

### Bước 4: Bật Tự động Gán Public IPv4 cho Public Subnets

1. Tại bảng danh sách **Subnets**, chọn `sre-platform-dev-public-1a`.
2. Nhấp **Actions** -> **Edit subnet settings**.
3. Tại mục **Auto-assign IP settings**:
   - Tích chọn **Enable auto-assign public IPv4 address**.
4. Nhấp **Save**.
5. Lặp lại thao tác này cho `sre-platform-dev-public-1b`.  
   *(Các Private Subnets giữ nguyên tùy chọn tắt auto-assign public IP)*.

---

## 4. Xác minh (Verification)

Chạy câu lệnh AWS CLI để kiểm tra cấu trúc Subnet và Tagging:

```bash
aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$(aws ec2 describe-vpcs --filters Name=tag:Name,Values=sre-platform-dev-vpc --query 'Vpcs[0].VpcId' --output text)" \
  --query 'Subnets[*].{Name:Tags[?Key==`Name`].Value | [0],CIDR:CidrBlock,AZ:AvailabilityZone,AvailableIPs:AvailableIpAddressCount}' \
  --output table
```

---

## 5. Chuyển giao sang IaC (Terraform Snippet)

```hcl
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "sre-platform-dev-vpc"
  cidr = "10.0.0.0/16"

  azs              = ["ap-southeast-1a", "ap-southeast-1b"]
  public_subnets   = ["10.0.0.0/24", "10.0.1.0/24"]
  private_subnets  = ["10.0.10.0/24", "10.0.11.0/24"]
  database_subnets = ["10.0.20.0/24", "10.0.21.0/24"]

  enable_dns_hostnames = true
  enable_dns_support   = true

  public_subnet_tags = {
    "kubernetes.io/role/elb" = 1
  }

  private_subnet_tags = {
    "kubernetes.io/role/internal-elb" = 1
    "karpenter.sh/discovery"          = "sre-platform-dev"
  }

  tags = {
    Environment = "dev"
    Project     = "sre-platform"
  }
}
```

---

## 6. Điều kiện hoàn thành Gate (Gate Check)

- [ ] VPC `sre-platform-dev-vpc` tạo thành công với CIDR `10.0.0.0/16`.
- [ ] Cả hai tính năng `Enable DNS hostnames` và `Enable DNS resolution` đã bật.
- [ ] 6 subnets phân bổ đều trên 2 AZs (`ap-southeast-1a`, `ap-southeast-1b`) không bị trùng CIDR.
- [ ] Các tag `kubernetes.io/role/elb` và `kubernetes.io/role/internal-elb` đã được gắn chính xác.

---

## 7. Dọn dẹp tài nguyên (Cleanup)

1. Không thể xóa VPC nếu bên trong vẫn còn Subnets có tài nguyên đang chạy (ENI, EC2, NAT, RDS).
2. Khi dọn dẹp môi trường sạch:
   - Vào **VPC Console** -> **Your VPCs** -> Chọn `sre-platform-dev-vpc` -> **Actions** -> **Delete VPC**.
   - AWS Console sẽ tự động kiểm tra và xóa toàn bộ subnets, route tables, internet gateways gắn liền với VPC này.
