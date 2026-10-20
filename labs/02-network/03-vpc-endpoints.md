# 02.03 — Tối ưu hóa Lưu lượng Mạng với AWS VPC Endpoints (Gateway & Interface)

> **Trạng thái:** Hướng dẫn thực hành chi tiết trên AWS Management Console (Console-first).  
> **Áp dụng cho:** Định tuyến lưu lượng AWS nội bộ (PrivateLink), giảm độ trễ và cắt giảm chi phí NAT Gateway khi kéo Docker Images và ghi nhật ký S3.

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Khởi tạo **VPC Gateway Endpoint** cho **Amazon S3** (Hoàn toàn **miễn phí**) và gắn tự động vào Private Route Tables.
  - Hiểu và cấu hình **VPC Interface Endpoints (AWS PrivateLink)** cho **ECR (API & DKR)** và **Secrets Manager** để các kết nối từ EKS không cần đi vòng qua Internet/NAT Gateway.
- **Nguyên tắc SRE:**
  - **Data Transfer Cost Optimization (Tối ưu hóa Chi phí Băng thông):** Mỗi GB dữ liệu kéo qua NAT Gateway bị AWS tính phí $0.045/GB. Khi EKS pull hàng trăm GB container images từ S3/ECR, Gateway Endpoint giúp định tuyến trực tiếp trên mạng xương sống AWS (AWS Backbone) với chi phí $0.
  - **Enhanced Security & Latency:** Traffic không bao giờ rời khỏi mạng nội bộ của AWS, triệt tiêu nguy cơ bị tấn công Man-in-the-Middle và giảm độ trễ mạng (p99 latency) cho các dịch vụ phụ thuộc.
  - **Availability Guardrails:** Gateway Endpoint cho S3 có độ sẵn sàng cao mặc định theo thiết kế phân tán của AWS, loại bỏ nút thắt cổ chai tại NAT Gateway.

---

## 2. Thông số đầu vào (Input Parameters)

| Tham số | Giá trị mẫu | Loại Endpoint | Chi phí AWS |
| :--- | :--- | :--- | :--- |
| **S3 Endpoint** | `com.amazonaws.ap-southeast-1.s3` | **Gateway** | **Miễn phí 100%** |
| **ECR API Endpoint** | `com.amazonaws.ap-southeast-1.ecr.api` | Interface | ~$0.01/giờ/AZ + data processing |
| **ECR DKR Endpoint** | `com.amazonaws.ap-southeast-1.ecr.dkr` | Interface | ~$0.01/giờ/AZ + data processing |
| **Secrets Manager Endpoint**| `com.amazonaws.ap-southeast-1.secretsmanager` | Interface | ~$0.01/giờ/AZ + data processing |
| **VPC ID** | `sre-platform-dev-vpc` | - | - |
| **Endpoint Security Group** | `sre-platform-dev-vpce-sg` | - | Cho phép HTTPS (443) từ VPC CIDR |

---

## 3. Các bước thực hiện chi tiết trên AWS Console (Console Steps)

### Bước 1: Khởi tạo S3 Gateway Endpoint (Bắt buộc cho mọi môi trường)

1. Mở ô tìm kiếm Console -> Nhập `VPC` -> Chọn dịch vụ **VPC**.
2. Tại menu bên trái, nhấp vào **Endpoints** -> Nhấp nút cam **Create endpoint**.
3. **Endpoint settings:**
   - **Name tag:** Nhập `sre-platform-dev-vpce-s3`.
   - **Service category:** Chọn **AWS services**.
   - **Services (Bộ lọc tìm kiếm):**
     - Gõ `s3` vào ô tìm kiếm dịch vụ.
     - Tìm dòng có **Type = Gateway** (Tên dịch vụ: `com.amazonaws.ap-southeast-1.s3`).
     - Tích chọn radio button của dịch vụ này.
   - **VPC:** Chọn `sre-platform-dev-vpc`.
   - **Route tables:**
     - Tích chọn cả hai bảng định tuyến Private:
       - `sre-platform-dev-rt-private-app`
       - `sre-platform-dev-rt-private-db`
   - **Policy:** Chọn **Full access** (hoặc cấu hình Custom Policy nếu muốn siết chặt chỉ cho phép đọc bucket cụ thể).
   - **Tags:** `Environment` = `dev`, `Project` = `sre-platform`.
4. Nhấp nút **Create endpoint**.
5. Kiểm tra trạng thái: Endpoint lập tức chuyển sang trạng thái **Available** (Màu xanh).

---

### Bước 2: Tạo Security Group cho Interface Endpoints

*(Nếu triển khai Interface Endpoints cho ECR/Secrets Manager, các endpoints này cần ENI đặt trong subnet và cần Security Group mở cổng 443)*

1. Tại menu bên trái VPC Console, chọn **Security Groups** -> Nhấp **Create security group**.
2. **Security group name:** `sre-platform-dev-vpce-sg`.
3. **Description:** `Security Group for VPC Interface Endpoints (Allow HTTPS from VPC)`.
4. **VPC:** Chọn `sre-platform-dev-vpc`.
5. **Inbound rules:**
   - Nhấp **Add rule**:
     - **Type:** `HTTPS` (Port 443).
     - **Source:** Chọn `Custom` -> Nhập CIDR của VPC: `10.0.0.0/16`.
     - **Description:** `Allow HTTPS traffic from EKS nodes and pods`.
6. Nhấp **Create security group**.

---

### Bước 3: Khởi tạo Interface Endpoint cho AWS Secrets Manager (Tùy chọn nâng cao)

1. Quay lại menu **Endpoints** -> Nhấp **Create endpoint**.
2. **Name tag:** `sre-platform-dev-vpce-secretsmanager`.
3. **Service category:** Chọn **AWS services**.
4. **Services:** Tìm `secretsmanager` -> Chọn `com.amazonaws.ap-southeast-1.secretsmanager` (Type = **Interface**).
5. **VPC:** Chọn `sre-platform-dev-vpc`.
6. **Subnets:**
   - Chọn tối thiểu 2 Private App Subnets trên 2 AZ:
     - AZ 1 (`ap-southeast-1a`): Chọn `sre-platform-dev-private-app-1a`.
     - AZ 2 (`ap-southeast-1b`): Chọn `sre-platform-dev-private-app-1b`.
7. **Security groups:**
   - Bỏ chọn default SG -> Tích chọn `sre-platform-dev-vpce-sg` vừa tạo ở Bước 2.
8. Nhấp **Create endpoint**.
9. Chờ 2 phút để AWS cấp phát Network Interface (ENI), trạng thái chuyển sang **Available**.

---

## 4. Xác minh (Verification)

### 4.1. Kiểm tra Route Table đã được tự động thêm Route S3
1. Vào **VPC Console** -> **Route tables** -> Chọn `sre-platform-dev-rt-private-app`.
2. Chọn tab **Routes**:
   - Bạn sẽ thấy một route mới xuất hiện tự động:
     - **Destination:** `pl-xxxxxxxx` (AWS Prefix List cho S3 trong region).
     - **Target:** `vpce-xxxxxxxx` (ID của S3 Gateway Endpoint vừa tạo).
     - **Status:** `Active`.

### 4.2. Kiểm tra bằng AWS CLI

```bash
# Kiểm tra danh sách VPC Endpoints trong VPC
aws ec2 describe-vpc-endpoints \
  --filters "Name=vpc-id,Values=$(aws ec2 describe-vpcs --filters Name=tag:Name,Values=sre-platform-dev-vpc --query 'Vpcs[0].VpcId' --output text)" \
  --query 'VpcEndpoints[*].{Id:VpcEndpointId,ServiceName:ServiceName,Type:VpcEndpointType,State:State}' \
  --output table
```

---

## 5. Chuyển giao sang IaC (Terraform Snippet)

```hcl
# S3 Gateway Endpoint (Miễn phí)
resource "aws_vpc_endpoint" "s3" {
  vpc_id       = aws_vpc.main.id
  service_name = "com.amazonaws.ap-southeast-1.s3"
  vpc_endpoint_type = "Gateway"

  route_table_ids = [
    aws_route_table.private_app.id,
    aws_route_table.private_db.id
  ]

  tags = {
    Name        = "sre-platform-dev-vpce-s3"
    Environment = "dev"
  }
}
```

---

## 6. Điều kiện hoàn thành Gate (Gate Check)

- [ ] S3 Gateway Endpoint đã được tạo và ở trạng thái `Available`.
- [ ] Bảng định tuyến `sre-platform-dev-rt-private-app` có Prefix List của S3 trỏ tới Gateway Endpoint.
- [ ] Toàn bộ lưu lượng truy xuất S3 từ Private Subnet đi thẳng qua Gateway Endpoint, không tốn dung lượng NAT Gateway.

---

## 7. Dọn dẹp tài nguyên (Cleanup)

1. Vào **VPC Console** -> **Endpoints** -> Chọn các Endpoints đã tạo (`sre-platform-dev-vpce-s3`, `sre-platform-dev-vpce-secretsmanager`).
2. Nhấp **Actions** -> **Delete VPC endpoints**.
3. Xóa Security Group `sre-platform-dev-vpce-sg`.
