# 02.02 — Cấu hình Internet Gateway (IGW), NAT Gateway và Route Tables

> **Trạng thái:** Hướng dẫn thực hành chi tiết trên AWS Management Console (Console-first).  
> **Áp dụng cho:** Định tuyến mạng, kiểm soát đường ra Internet cho EKS Worker Nodes và cô lập tuyệt đối Database.

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Khởi tạo **Internet Gateway (IGW)** và gắn (Attach) vào VPC để làm cửa ngõ giao tiếp Internet cho Public Subnets.
  - Cấp phát **Elastic IP (EIP)** và khởi tạo **NAT Gateway** đặt tại Public Subnet để cho phép các Pods/Nodes trong Private Subnets tải packages, container images và kết nối external APIs.
  - Thiết lập 3 Bảng Định tuyến (Route Tables) riêng biệt:
    1. **Public Route Table:** Định tuyến `0.0.0.0/0` -> Internet Gateway.
    2. **Private App Route Table:** Định tuyến `0.0.0.0/0` -> NAT Gateway.
    3. **Private Database Route Table:** Tuyệt đối **KHÔNG CÓ** default route `0.0.0.0/0`, chỉ có route `local`.
- **Nguyên tắc SRE:**
  - **Egress-Only Security for Workloads:** Worker nodes chỉ được phép đi ra ngoài (Egress) thông qua NAT Gateway để pull images, không cho phép kết nối trực tiếp từ Internet vào nodes (No Ingress).
  - **Complete Air-Gapped Isolation for Databases:** Database subnets không có route ra Internet, ngăn ngừa hoàn toàn nguy cơ rò rỉ dữ liệu hoặc tấn công trực tiếp từ bên ngoài.
  - **FinOps & HA Trade-Off Awareness:** 
    - *Môi trường Dev:* Sử dụng **1 NAT Gateway** (đặt tại AZ-a) để tiết kiệm chi phí ($0.045/giờ + $0.045/GB ~ $32.4/tháng).
    - *Môi trường Prod:* Bắt buộc dùng **Multi-AZ NAT Gateways** (mỗi AZ 1 NAT Gateway) để tránh NAT Gateway trở thành Single Point of Failure (SPOF) khi cả một AZ gặp sự cố.

---

## 2. Thông số đầu vào (Input Parameters)

| Tham số | Giá trị mẫu | Ý nghĩa |
| :--- | :--- | :--- |
| **Internet Gateway Name** | `sre-platform-dev-igw` | Cửa ngõ kết nối Internet 2 chiều cho Public Subnets |
| **NAT Gateway Name** | `sre-platform-dev-nat-1a` | Dịch vụ chuyển đổi địa chỉ mạng cho Private Subnets |
| **Elastic IP Name** | `sre-platform-dev-nat-eip-1a` | Địa chỉ IP tĩnh công khai gắn cho NAT Gateway |
| **Public Route Table** | `sre-platform-dev-rt-public` | Gắn với 2 Public Subnets |
| **Private App Route Table** | `sre-platform-dev-rt-private-app` | Gắn với 2 Private App Subnets |
| **Private DB Route Table** | `sre-platform-dev-rt-private-db` | Gắn với 2 Private Database Subnets |

---

## 3. Các bước thực hiện chi tiết trên AWS Console (Console Steps)

### Bước 1: Tạo và Gắn Internet Gateway (IGW)

1. Mở ô tìm kiếm Console -> Nhập `VPC` -> Chọn dịch vụ **VPC**.
2. Tại menu bên trái, nhấp vào **Internet gateways** -> Nhấp nút cam **Create internet gateway**.
3. **Name tag:** Nhập `sre-platform-dev-igw`.
4. Nhấp **Create internet gateway**.
5. Sau khi tạo xong, trạng thái hiển thị là `Detached` (Màu vàng).
6. Nhấp vào nút **Actions** ở góc trên bên phải -> Chọn **Attach to VPC**.
7. Tại mục **Available VPCs**: Chọn `sre-platform-dev-vpc`.
8. Nhấp nút **Attach internet gateway**. Trạng thái chuyển sang **Attached** (Màu xanh).

---

### Bước 2: Cấp phát Elastic IP và Khởi tạo NAT Gateway

1. Tại menu bên trái của VPC Console, nhấp vào **NAT gateways** -> Nhấp nút cam **Create NAT gateway**.
2. **Cấu hình NAT gateway:**
   - **Name:** Nhập `sre-platform-dev-nat-1a`.
   - **Subnet:** Bắt buộc chọn một **Public Subnet** -> Chọn `sre-platform-dev-public-1a`.
   - **Connectivity type:** Chọn `Public` (Mặc định).
   - **Elastic IP allocation ID:**
     - Nhấp vào nút **Allocate Elastic IP** ngay bên cạnh. AWS sẽ tự động cấp phát một EIP mới và điền vào ô này.
   - **Tags:** Thêm `Environment` = `dev`, `Project` = `sre-platform`.
3. Nhấp nút **Create NAT gateway**.
4. Quá trình khởi tạo NAT Gateway thường mất khoảng 2-3 phút. Trạng thái sẽ chuyển từ `Pending` sang **Available**.

---

### Bước 3: Cấu hình Bảng Định tuyến Public (Public Route Table)

1. Tại menu bên trái, nhấp vào **Route tables** -> Nhấp nút cam **Create route table**.
2. **Name:** Nhập `sre-platform-dev-rt-public`.
3. **VPC:** Chọn `sre-platform-dev-vpc`.
4. Nhấp **Create route table**.
5. **Thêm Route ra Internet qua IGW:**
   - Chọn tab **Routes** ở góc dưới -> Nhấp **Edit routes**.
   - Nhấp **Add route**:
     - **Destination:** `0.0.0.0/0`
     - **Target:** Chọn **Internet Gateway** -> Chọn `sre-platform-dev-igw`.
   - Nhấp **Save changes**.
6. **Liên kết Subnets (Subnet Associations):**
   - Chuyển sang tab **Subnet associations** -> Nhấp **Edit subnet associations**.
   - Tích chọn cả 2 Public Subnets:
     - `sre-platform-dev-public-1a`
     - `sre-platform-dev-public-1b`
   - Nhấp **Save associations**.

---

### Bước 4: Cấu hình Bảng Định tuyến Private App (Private App Route Table)

1. Tại màn hình **Route tables**, nhấp **Create route table**.
2. **Name:** Nhập `sre-platform-dev-rt-private-app`.
3. **VPC:** Chọn `sre-platform-dev-vpc`.
4. Nhấp **Create route table**.
5. **Thêm Route ra Internet qua NAT Gateway:**
   - Chọn tab **Routes** -> Nhấp **Edit routes**.
   - Nhấp **Add route**:
     - **Destination:** `0.0.0.0/0`
     - **Target:** Chọn **NAT Gateway** -> Chọn `sre-platform-dev-nat-1a`.
   - Nhấp **Save changes**.
6. **Liên kết Subnets:**
   - Chuyển sang tab **Subnet associations** -> Nhấp **Edit subnet associations**.
   - Tích chọn cả 2 Private App Subnets:
     - `sre-platform-dev-private-app-1a`
     - `sre-platform-dev-private-app-1b`
   - Nhấp **Save associations**.

---

### Bước 5: Cấu hình Bảng Định tuyến Private Database (Cô lập triệt để)

1. Nhấp **Create route table**.
2. **Name:** Nhập `sre-platform-dev-rt-private-db`.
3. **VPC:** Chọn `sre-platform-dev-vpc`.
4. Nhấp **Create route table**.
5. **Kiểm tra Routes:**
   - Tab **Routes** chỉ duy nhất có 1 dòng: `10.0.0.0/16` -> `local`.
   - **Tuyệt đối KHÔNG thêm route `0.0.0.0/0` ở bảng này**.
6. **Liên kết Subnets:**
   - Chuyển sang tab **Subnet associations** -> Nhấp **Edit subnet associations**.
   - Tích chọn cả 2 Private Database Subnets:
     - `sre-platform-dev-private-db-1a`
     - `sre-platform-dev-private-db-1b`
   - Nhấp **Save associations**.

---

## 4. Xác minh (Verification)

Chạy lệnh kiểm tra các liên kết Route Table và Subnet bằng AWS CLI:

```bash
# Liệt kê các Route Table cùng đích đến Internet (0.0.0.0/0)
aws ec2 describe-route-tables \
  --filters "Name=vpc-id,Values=$(aws ec2 describe-vpcs --filters Name=tag:Name,Values=sre-platform-dev-vpc --query 'Vpcs[0].VpcId' --output text)" \
  --query 'RouteTables[*].{Name:Tags[?Key==`Name`].Value | [0],Routes:Routes[?DestinationCidrBlock==`0.0.0.0/0`].{GatewayId:GatewayId,NatGatewayId:NatGatewayId}}' \
  --output table
```

**Kết quả mong đợi:**
- `sre-platform-dev-rt-public`: có `GatewayId` trỏ về `igw-...`.
- `sre-platform-dev-rt-private-app`: có `NatGatewayId` trỏ về `nat-...`.
- `sre-platform-dev-rt-private-db`: danh sách Routes `0.0.0.0/0` hoàn toàn trống (None/Empty).

---

## 5. Chuyển giao sang IaC (Terraform Snippet)

```hcl
# Internet Gateway
resource "aws_internet_gateway" "gw" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "sre-platform-dev-igw" }
}

# Elastic IP cho NAT
resource "aws_eip" "nat" {
  domain = "vpc"
  tags   = { Name = "sre-platform-dev-nat-eip-1a" }
}

# NAT Gateway đặt tại Public Subnet
resource "aws_nat_gateway" "nat" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public_1a.id
  tags          = { Name = "sre-platform-dev-nat-1a" }
}

# Route Table Private App -> NAT Gateway
resource "aws_route_table" "private_app" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.nat.id
  }

  tags = { Name = "sre-platform-dev-rt-private-app" }
}
```

---

## 6. Điều kiện hoàn thành Gate (Gate Check)

- [ ] Internet Gateway đã được tạo và gắn vào VPC `sre-platform-dev-vpc`.
- [ ] NAT Gateway ở trạng thái `Available` và có gắn Elastic IP hợp lệ.
- [ ] Public Subnets định tuyến ra ngoài qua Internet Gateway.
- [ ] Private App Subnets định tuyến ra ngoài qua NAT Gateway.
- [ ] Database Subnets hoàn toàn không có route ra Internet (`0.0.0.0/0`).

---

## 7. Dọn dẹp tài nguyên (Cleanup)

> [!WARNING]
> NAT Gateway tính phí theo giờ (~$0.045/giờ) kể cả khi không có lưu lượng truyền qua. Nếu tạm dừng bài lab, nên xóa NAT Gateway và giải phóng Elastic IP.

1. Vào **VPC Console** -> **NAT gateways** -> Chọn `sre-platform-dev-nat-1a` -> Nhấp **Actions** -> **Delete NAT gateway**.
2. Chờ NAT Gateway chuyển sang trạng thái `Deleted`.
3. Vào menu **Elastic IPs** -> Chọn EIP vừa dùng cho NAT -> Nhấp **Actions** -> **Release Elastic IP addresses** (nếu không release, EIP chưa gán sẽ bị AWS tính phí $0.005/giờ).
4. Vào **Internet gateways** -> Chọn `sre-platform-dev-igw` -> **Detach from VPC** -> **Delete internet gateway**.
5. Xóa các Route Tables tùy chỉnh.
