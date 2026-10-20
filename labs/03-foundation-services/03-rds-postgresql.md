# 03.04 (03) — Triển khai Amazon RDS PostgreSQL và Giám sát Performance Insights

> **Trạng thái:** Hướng dẫn thực hành chi tiết trên AWS Management Console (Console-first).  
> **Áp dụng cho:** Quản trị cơ sở dữ liệu quan hệ cho ReliabilityShop, tối ưu chi phí dev và giám sát hiệu năng truy vấn (Performance Engineering).

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Khởi tạo **DB Subnet Group** gồm tối thiểu 2 Private Database Subnets trải rộng trên 2 Availability Zones (`ap-southeast-1a` và `ap-southeast-1b`).
  - Triển khai **Amazon RDS PostgreSQL** (Engine 16.x) trong mạng cô lập (Private-only), được bảo vệ bởi `sre-platform-dev-db-sg`.
  - Kích hoạt **Performance Insights** (miễn phí lưu trữ 7 ngày) và **Enhanced Monitoring** để theo dõi tải cơ sở dữ liệu (Average Active Sessions - AAS), hàng đợi CPU và các câu lệnh SQL bị nghẽn/chậm.
  - Tích hợp mã hóa dữ liệu tĩnh bằng **KMS Customer Managed Key** (`alias/sre-platform-dev-main`) và bật **Storage Autoscaling**.
- **Nguyên tắc SRE:**
  - **Zero Public Ingress for State:** Database tuyệt đối không được phép có Public IP (`Publicly accessible: No`). Mọi truy vấn bắt buộc phải xuất phát từ EKS Worker Nodes trong cùng VPC.
  - **Connection Pooling & Saturation Management:** SRE phải kiểm soát số lượng kết nối tối đa (`max_connections`); một đợt k6 load test đột biến không được phép làm cạn kiệt tài nguyên bộ nhớ của PostgreSQL dẫn đến crash.
  - **Observability Beyond CPU/RAM:** Không chỉ nhìn vào CPU instance; chỉ số quan trọng nhất của Database là **DB Load theo Wait Events** (ví dụ: `wait/io/table/read`, `wait/synch/mutex`) thông qua Performance Insights.

---

## 2. Thông số đầu vào (Input Parameters)

| Tham số | Giá trị mẫu / Quy ước | Ý nghĩa |
| :--- | :--- | :--- |
| **DB Identifier** | `sre-platform-dev-pg` | Tên định danh của Database Instance |
| **Engine & Version** | `PostgreSQL 16.x` | Phiên bản cơ sở dữ liệu quan hệ tiêu chuẩn |
| **Template** | `Free tier` hoặc `Dev/Test` | Cấu hình tối ưu chi phí |
| **Instance Class** | `db.t4g.micro` (hoặc `db.t4g.small`) | Dòng Graviton tiết kiệm điện năng và chi phí |
| **Storage Type & Size**| `General Purpose SSD (gp3)` - 20 GiB | Lưu trữ SSD hiệu năng cao, chi phí thấp |
| **Master Username** | `sre_admin` | Tài khoản quản trị DB (mật khẩu lấy từ Secrets Manager) |
| **Database Name** | `reliability_shop` | Tên cơ sở dữ liệu khởi tạo mặc định |
| **Multi-AZ Deployment**| `Single DB instance` (cho dev) | *Lưu ý: Multi-AZ sẽ bật ở bài test GameDay/Failover* |
| **Publicly Accessible**| `No` (Bắt buộc) | Chặn hoàn toàn truy cập từ Internet |

---

## 3. Các bước thực hiện chi tiết trên AWS Console (Console Steps)

### Bước 1: Khởi tạo DB Subnet Group

1. Đăng nhập vào **AWS Console**, chọn Region `ap-southeast-1`.
2. Nhập `RDS` vào ô tìm kiếm -> Chọn dịch vụ **Relational Database Service**.
3. Tại menu bên trái, nhấp vào **Subnet groups** -> Nhấp nút cam **Create DB subnet group**.
4. **Subnet group details:**
   - **Name:** Nhập `sre-platform-dev-rds-subnet-group`.
   - **Description:** `Subnet group for dev RDS across Private DB subnets`.
   - **VPC:** Chọn `sre-platform-dev-vpc`.
5. **Add subnets:**
   - **Availability Zones:** Chọn cả 2 AZ: `ap-southeast-1a` và `ap-southeast-1b`.
   - **Subnets:** Tích chọn chính xác 2 Private Database Subnets đã tạo ở Lab 02.01:
     - Subnet có CIDR `10.0.20.0/24` (`sre-platform-dev-private-db-1a`).
     - Subnet có CIDR `10.0.21.0/24` (`sre-platform-dev-private-db-1b`).
6. Nhấp nút **Create**.

---

### Bước 2: Tạo Amazon RDS PostgreSQL Instance

1. Tại menu bên trái của RDS Console, nhấp vào **Databases** -> Nhấp nút cam **Create database**.
2. **Choose a database creation method:** Chọn **Standard create**.
3. **Engine options:**
   - Engine type: Chọn **PostgreSQL**.
   - Engine Version: Chọn phiên bản mới nhất (ví dụ `PostgreSQL 16.3-R1`).
4. **Templates:**
   - Chọn **Free tier** (hoặc **Dev/Test**).
5. **Settings:**
   - **DB instance identifier:** Nhập `sre-platform-dev-pg`.
   - **Master username:** `sre_admin`.
   - **Credentials management:** Chọn **Self managed**.
   - **Master password:** Nhập chính xác mật khẩu mạnh đã lưu trong AWS Secrets Manager (`DB_PASSWORD` ở Lab 05.01).
6. **Instance configuration:**
   - **DB instance class:** Chọn **Burstable classes (includes t classes)** -> Chọn `db.t4g.micro` (hoặc `db.t4g.small`).
7. **Storage:**
   - **Storage type:** `gp3`.
   - **Allocated storage:** `20 GiB`.
   - **Storage autoscaling:** Tích chọn **Enable storage autoscaling** (Maximum storage threshold: `50 GiB`).
8. **Connectivity (Cực kỳ quan trọng về an toàn mạng):**
   - **Virtual private cloud (VPC):** Chọn `sre-platform-dev-vpc`.
   - **DB subnet group:** Chọn `sre-platform-dev-rds-subnet-group` vừa tạo ở Bước 1.
   - **Public access:** Chọn **No** (Chặn hoàn toàn kết nối ngoài).
   - **VPC security group (firewall):**
     - Bỏ chọn `default`.
     - Chọn **Choose existing** -> Tích chọn `sre-platform-dev-db-sg` (đã mở port 5432 từ Node SG).
   - **Availability Zone:** Chọn `No preference`.
   - **Database port:** `5432`.
9. **Database authentication:**
   - Chọn **Password authentication** (hoặc Password and IAM database authentication).
10. **Additional configuration:**
    - **Initial database name:** Nhập `reliability_shop`.
    - **Backup:**
      - Tích chọn **Enable automated backups** (Backup retention period: `7 days`).
    - **Encryption:**
      - Tích chọn **Enable encryption**.
      - **KMS key:** Chọn Customer Managed Key `alias/sre-platform-dev-main`.
    - **Monitoring:**
      - Tích chọn **Turn on Performance Insights** (Retention period: `7 days - Free tier`).
      - Tích chọn **Enhanced Monitoring** (Granularity: `60 seconds`).
11. Nhấp nút cam **Create database** ở cuối trang.
12. Quá trình tạo RDS mất khoảng 8-15 phút. Chờ trạng thái chuyển từ `Creating` sang **Available**.

---

## 4. Xác minh và Kiểm tra Hiệu năng (Verification)

### 4.1. Lấy Endpoint Database từ Console
1. Trong bảng **Databases**, nhấp vào `sre-platform-dev-pg`.
2. Tại tab **Connectivity & security**, sao chép:
   - **Endpoint:** Dạng `sre-platform-dev-pg.xxxxxx.ap-southeast-1.rds.amazonaws.com`.
   - **Port:** `5432`.
   - Xác nhận **Public accessibility:** `No`.

### 4.2. Khám phá RDS Performance Insights Console
1. Tại menu bên trái của RDS, chọn **Performance Insights**.
2. Chọn instance `sre-platform-dev-pg`:
   - Biểu đồ **Database Load:** Thể hiện số Average Active Sessions (AAS). Đường đứt nét đỏ biểu thị số vCPU của instance (ví dụ: 2 vCPU). Nếu AAS vượt trên đường đỏ nghĩa là Database đang quá tải.
   - Bảng **Top SQL:** Liệt kê các câu lệnh SQL tiêu tốn nhiều thời gian và CPU nhất, kèm thời gian chạy trung bình và số lần gọi.

### 4.3. Kiểm tra bằng AWS CLI
```bash
aws rds describe-db-instances \
  --db-instance-identifier sre-platform-dev-pg \
  --query 'DBInstances[0].{Endpoint:Endpoint.Address,Port:Endpoint.Port,Status:DBInstanceStatus,Engine:Engine,AllocatedStorage:AllocatedStorage,PubliclyAccessible:PubliclyAccessible}' \
  --output table
```

---

## 5. Chuyển giao sang IaC (Terraform Snippet)

```hcl
resource "aws_db_subnet_group" "rds" {
  name       = "sre-platform-dev-rds-subnet-group"
  subnet_ids = [aws_subnet.private_db_1a.id, aws_subnet.private_db_1b.id]
}

resource "aws_db_instance" "postgresql" {
  identifier        = "sre-platform-dev-pg"
  engine            = "postgres"
  engine_version    = "16.3"
  instance_class    = "db.t4g.micro"
  allocated_storage = 20
  storage_type      = "gp3"

  db_name  = "reliability_shop"
  username = "sre_admin"
  password = var.db_password # Lấy từ Secrets Manager

  db_subnet_group_name   = aws_db_subnet_group.rds.name
  vpc_security_group_ids = [aws_security_group.db.id]
  publicly_accessible    = false
  kms_key_id             = data.aws_kms_key.main.arn
  storage_encrypted      = true

  performance_insights_enabled          = true
  performance_insights_retention_period = 7

  skip_final_snapshot = true

  tags = {
    Environment = "dev"
    Project     = "sre-platform"
  }
}
```

---

## 6. Điều kiện hoàn thành Gate (Gate Check)

- [ ] RDS Instance `sre-platform-dev-pg` ở trạng thái `Available`.
- [ ] Database Subnet Group nằm trọn vẹn trong 2 Private DB Subnets.
- [ ] `Publicly Accessible` được thiết lập là **No**.
- [ ] Security Group `sre-platform-dev-db-sg` chỉ cho phép kết nối cổng 5432 từ EKS Node Group.
- [ ] Performance Insights được kích hoạt và sẵn sàng ghi nhận số liệu.

---

## 7. Dọn dẹp tài nguyên (Cleanup)

1. Vào **RDS Console** -> Chọn `sre-platform-dev-pg`.
2. Nhấp **Actions** -> Chọn **Delete**.
3. **Delete options:**
   - Bỏ tích chọn *Create final snapshot* (trong môi trường dev lab để xóa nhanh và tránh lưu snapshot tính phí).
   - Bỏ tích chọn *Retain automated backups*.
   - Tích chọn **I acknowledge that upon instance deletion...**.
   - Gõ `delete me` vào ô xác nhận -> Nhấp **Delete**.
4. Chờ cơ sở dữ liệu xóa xong -> Vào **Subnet groups** -> Xóa `sre-platform-dev-rds-subnet-group`.
