# 03.06 — Thực hành Diễn tập Sao lưu và Phục hồi Dữ liệu (Backup & Disaster Recovery Drill)

> **Trạng thái:** Hướng dẫn thực hành chi tiết trên AWS Management Console (Console-first).  
> **Áp dụng cho:** Kiểm chứng mục tiêu RPO/RTO, Point-in-Time Recovery (PITR) cho RDS PostgreSQL và sao lưu trạng thái S3/Redis.

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Thực hiện tạo thủ công một bản sao lưu tức thời (**Manual DB Snapshot**) cho cơ sở dữ liệu RDS PostgreSQL trước các đợt release/migration lớn.
  - Diễn tập quy trình phục hồi về một thời điểm bất kỳ trong quá khứ (**Point-in-Time Recovery - PITR**) ra một DB Instance mới (`sre-platform-dev-pg-restored`).
  - Kiểm tra tính toàn vẹn của dữ liệu sau khi phục hồi và đo đạc chính xác hai chỉ số cốt lõi của SRE: **RPO** (Recovery Point Objective) và **RTO** (Recovery Time Objective).
  - Thiết lập vòng đời sao lưu (Snapshot Lifecycle) và dọn dẹp môi trường phục hồi thử nghiệm để không làm phát sinh chi phí thừa.
- **Nguyên tắc SRE:**
  - **An Untested Backup is No Backup (Bản sao lưu chưa từng diễn tập phục hồi là vô giá trị):** Tự động backup chỉ là bước đầu; việc chứng minh có thể dựng lại database hoạt động tốt từ snapshot mới là bằng chứng đáng tin cậy duy nhất.
  - **Never Overwrite in Disaster Recovery:** Quy trình phục hồi của AWS RDS luôn tạo ra một DB Instance mới với endpoint độc lập; tuyệt đối không ghi đè trực tiếp lên instance đang hoạt động để bảo vệ hiện trường điều tra.
  - **RPO & RTO Measurement:** Ghi nhận thời gian thực tế: RTO (mất bao nhiêu phút để instance mới sẵn sàng nhận kết nối) và RPO (lượng dữ liệu giao dịch tối đa có nguy cơ bị mất).

---

## 2. Thông số đầu vào (Input Parameters)

| Tham số | Giá trị mẫu | Ý nghĩa |
| :--- | :--- | :--- |
| **Source DB Instance** | `sre-platform-dev-pg` | Cơ sở dữ liệu gốc đang chạy |
| **Manual Snapshot Name**| `sre-platform-dev-pg-pre-release-snap` | Tên snapshot thủ công |
| **Restored DB Instance**| `sre-platform-dev-pg-restored` | Tên instance mới được sinh ra từ phục hồi |
| **Recovery Type** | `Point-in-Time Recovery (PITR)` | Khôi phục về thời điểm 15 phút trước |
| **Target RPO** | `< 5 phút` | Giới hạn mất mát dữ liệu tối đa |
| **Target RTO** | `< 20 phút` | Thời gian từ lúc phát lệnh đến khi DB mới sẵn sàng |

---

## 3. Các bước thực hiện chi tiết trên AWS Console (Console Steps)

### Bước 1: Tạo Manual Snapshot cho RDS PostgreSQL

1. Đăng nhập vào **AWS Console**, chọn Region `ap-southeast-1`.
2. Mở dịch vụ **Amazon RDS** -> Nhấp vào **Databases** ở menu bên trái.
3. Chọn database `sre-platform-dev-pg`.
4. Nhấp vào menu **Actions** ở góc trên bên phải -> Chọn **Take snapshot**.
5. **Snapshot details:**
   - **Snapshot name:** Nhập `sre-platform-dev-pg-pre-release-snap`.
   - **Tags:** Thêm `Environment` = `dev`, `Purpose` = `dr-drill`.
6. Nhấp nút cam **Take snapshot**.
7. Màn hình chuyển sang mục **Snapshots**:
   - Theo dõi thanh tiến trình (Progress).
   - Khi hoàn thành, **Status** chuyển sang **Available** (Màu xanh).

---

### Bước 2: Diễn tập Phục hồi Point-in-Time Recovery (PITR)

*(Giả định kịch bản: Một lập trình viên lỡ tay drop table hoặc xóa nhầm dữ liệu lúc 10 phút trước; ta cần khôi phục lại thời điểm trước khi lệnh lỗi diễn ra)*

1. Trong danh sách **Databases**, chọn `sre-platform-dev-pg`.
2. Nhấp vào menu **Actions** -> Chọn **Restore to point in time**.
3. **Restore time:**
   - Chọn radio button **Custom date and time (UTC)**.
   - Chọn thời điểm trong quá khứ khoảng 10-15 phút trước thời điểm hiện tại (nằm trong cửa sổ *Latest restorable time*).
4. **Settings:**
   - **DB instance identifier:** Nhập tên instance mới: `sre-platform-dev-pg-restored`.
5. **Instance configuration:**
   - Giữ nguyên cấu hình `db.t4g.micro` và `gp3` để kiểm thử tương đương.
6. **Connectivity:**
   - **Virtual private cloud (VPC):** Chọn `sre-platform-dev-vpc`.
   - **Subnet group:** Chọn `sre-platform-dev-rds-subnet-group`.
   - **Public access:** Chọn **No**.
   - **Security group:** Chọn `sre-platform-dev-db-sg`.
7. **Bắt đầu đo thời gian (RTO Timer Start):**
   - Bấm đồng hồ bấm giờ (hoặc ghi nhận timestamp chính xác).
   - Nhấp nút cam **Restore to point in time**.
8. Danh sách Databases xuất hiện thêm `sre-platform-dev-pg-restored` với trạng thái `Creating`.

---

### Bước 3: Đo đạc RTO và Xác minh Tính Khả dụng

1. Quan sát quá trình tạo instance mới:
   - AWS tự động tạo storage volume từ snapshot gốc và áp dụng các transaction logs (WAL) cho đến đúng mốc thời gian đã chọn.
2. Khi trạng thái của `sre-platform-dev-pg-restored` chuyển sang **Available**:
   - **Bấm dừng đồng hồ (RTO Timer Stop).**
   - Ghi lại số phút đã trôi qua (thông thường từ 8 đến 15 phút) -> Đây chính là **Measured RTO**.
3. Kiểm tra thông tin kết nối:
   - Nhấp vào `sre-platform-dev-pg-restored`.
   - Lấy **Endpoint** mới của instance phục hồi.
   - Thử nghiệm truy vấn SELECT dữ liệu từ một pod trong EKS để chứng minh dữ liệu còn nguyên vẹn.

---

## 4. Xác minh và Báo cáo Diễn tập (Verification & Evidence)

### 4.1. Kiểm tra bằng AWS CLI
```bash
# Kiểm tra snapshot đã tạo
aws rds describe-db-snapshots \
  --db-snapshot-identifier sre-platform-dev-pg-pre-release-snap \
  --query 'DBSnapshots[0].{Name:DBSnapshotIdentifier,Status:Status,AllocatedStorage:AllocatedStorage,SnapshotCreateTime:SnapshotCreateTime}' \
  --output table

# Kiểm tra trạng thái của instance sau phục hồi
aws rds describe-db-instances \
  --db-instance-identifier sre-platform-dev-pg-restored \
  --query 'DBInstances[0].{Identifier:DBInstanceIdentifier,Status:DBInstanceStatus,Endpoint:Endpoint.Address}' \
  --output table
```

### 4.2. Mẫu Báo cáo Diễn tập Phục hồi (DR Drill Report)
```text
=== SRE DISASTER RECOVERY DRILL REPORT ===
Date/Time:             2026-10-21T02:00:00Z
Target System:         RDS PostgreSQL (reliability_shop)
Disaster Scenario:     Simulated Data Corruption / Table Drop
Recovery Method:       Point-in-Time Recovery (PITR)
Restored Instance ID:  sre-platform-dev-pg-restored
RPO Target:            < 5 minutes
RPO Achieved:          ~1 minute (Latest transaction logs applied)
RTO Target:            < 20 minutes
RTO Achieved (Actual): 11 minutes 42 seconds
Integrity Status:      VERIFIED (All tables & rows intact)
Drill Result:          PASSED
```

---

## 5. Điều kiện hoàn thành Gate (Gate Check)

- [ ] Manual snapshot `sre-platform-dev-pg-pre-release-snap` tạo thành công và ở trạng thái `Available`.
- [ ] Diễn tập PITR tạo thành công instance phục hồi `sre-platform-dev-pg-restored`.
- [ ] RTO đo đạc thực tế nằm trong ngưỡng chấp nhận (< 20 phút).
- [ ] Dữ liệu sau phục hồi được kiểm tra tính toàn vẹn từ EKS pod.

---

## 6. Dọn dẹp tài nguyên Diễn tập (Cleanup)

> [!WARNING]
> Instance phục hồi `sre-platform-dev-pg-restored` chỉ dùng để kiểm chứng trong bài diễn tập; nếu để chạy sẽ bị AWS tính phí gấp đôi chi phí RDS! Phải xóa ngay sau khi nghiệm thu.

1. Vào **RDS Console** -> **Databases** -> Chọn `sre-platform-dev-pg-restored`.
2. Nhấp **Actions** -> Chọn **Delete**.
3. Bỏ tích chọn *Create final snapshot* -> Gõ `delete me` -> Nhấp **Delete**.
4. (Tùy chọn) Xóa snapshot thủ công `sre-platform-dev-pg-pre-release-snap` trong mục **Snapshots** nếu không cần lưu trữ lâu dài.
