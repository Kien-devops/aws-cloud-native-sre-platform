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

## 5. Kiến trúc Schema Cơ sở dữ liệu: Outbox Pattern & Consumer Idempotency

Để đáp ứng tiêu chuẩn **SRE Correctness** (đảm bảo không mất mát giao dịch khi sự cố mạng hoặc sập pod), cơ sở dữ liệu `reliability_shop` được thiết kế theo mô hình **Transactional Outbox** và **Idempotent Consumer**:

```sql
-- 1. Bảng lưu trữ trạng thái đơn hàng (Orders)
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    item_id VARCHAR(64) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING_PAYMENT',
    trace_id VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bảng Transactional Outbox (Chống mất mát Event khi publish SQS lỗi)
CREATE TABLE IF NOT EXISTS order_outbox (
    id BIGSERIAL PRIMARY KEY,
    event_id VARCHAR(64) UNIQUE NOT NULL,
    schema_version VARCHAR(16) NOT NULL DEFAULT '1.0',
    order_id VARCHAR(64) NOT NULL REFERENCES orders(id),
    event_type VARCHAR(64) NOT NULL DEFAULT 'OrderCreated',
    payload JSONB NOT NULL,
    trace_id VARCHAR(64),
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING', -- PENDING, PUBLISHED, FAILED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP WITH TIME ZONE
);

-- 3. Bảng Idempotent Consumer (Chống xử lý trùng lặp khi SQS retry)
CREATE TABLE IF NOT EXISTS processed_events (
    event_id VARCHAR(64) PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL,
    consumer_name VARCHAR(64) NOT NULL DEFAULT 'payment-worker',
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Nguyên tắc Bất biến SRE (SRE Invariants):
1. **Atomic Transaction:** Thao tác tạo đơn hàng bắt buộc thực hiện trong cùng 1 Transaction (`orders + order_outbox`):
   ```sql
   BEGIN;
     INSERT INTO orders (id, user_id, item_id, amount, status, trace_id) VALUES (...);
     INSERT INTO order_outbox (event_id, order_id, payload, trace_id) VALUES (...);
   COMMIT;
   ```
2. **Idempotency Guarantee:** `payment-worker` khi nhận message từ SQS chỉ cập nhật `orders.status = 'PAID'` khi và chỉ khi ghi nhận thành công `event_id` vào `processed_events`. Nếu `event_id` đã tồn tại (Duplicate message), worker bỏ qua và commit xóa message khỏi SQS.
3. **Additive-Only Migration:** Khi nâng cấp tính năng, mọi thay đổi schema cơ sở dữ liệu phải là **Additive** (chỉ thêm bảng mới hoặc thêm cột có giá trị default/nullable), tuyệt đối không drop table hay rename cột cũ để đảm bảo khả năng tương thích ngược và rollback an toàn.

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
