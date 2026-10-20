# 01.03 — Thiết lập Giám sát Nhật ký Kiểm toán (CloudTrail) và Phát hiện Đe dọa (GuardDuty)

> **Trạng thái:** Hướng dẫn thực hành chi tiết trên AWS Management Console (Console-first).  
> **Áp dụng cho:** Thiết lập kiểm toán hoạt động API (Audit Logging) và phát hiện hành vi bất thường theo chuẩn bảo mật SRE.

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Khởi tạo một Multi-Region **AWS CloudTrail** để ghi nhận toàn bộ các lệnh gọi Management API (`Create*`, `Delete*`, `Modify*`, `AssumeRole`) trên toàn tài khoản.
  - Cấu hình lưu trữ log vào Amazon S3 có bật tính năng **Log File Integrity Validation** (Xác thực tính toàn vẹn của tệp nhật ký, chống can thiệp).
  - Kích hoạt **Amazon GuardDuty** để tự động phân tích hành vi đáng ngờ (ví dụ: truy cập từ IP độc hại, dò quét port, tấn công brute-force).
- **Nguyên tắc SRE:**
  - **Accountability & Root Cause Analysis (RCA):** Không thể giải quyết sự cố (Incident Response) nếu không có timeline chính xác về việc ai đã thay đổi cấu hình gì, vào lúc nào và từ đâu.
  - **Tamper-Evident Logging:** Logs kiểm toán phải được bảo vệ bất biến để đảm bảo tính pháp lý và độ tin cậy trong điều tra bảo mật.
  - **Proactive Threat Detection:** Phát hiện sớm các rủi ro bảo mật trước khi chúng trở thành sự cố gián đoạn dịch vụ (Reliability Outage).

---

## 2. Thông số đầu vào (Input Parameters)

| Tham số | Giá trị mẫu / Quy ước | Ý nghĩa |
| :--- | :--- | :--- |
| **Trail Name** | `sre-platform-audit-trail` | Tên của CloudTrail trail chính |
| **S3 Bucket Name** | `sre-platform-audit-logs-<random-suffix>` | Bucket lưu trữ tệp nhật ký kiểm toán |
| **Log Integrity** | `Enabled` | Bật mã băm cryptographic digest để kiểm tra sửa đổi log |
| **GuardDuty Status** | `Enabled` | Kích hoạt AI/ML detector phân tích luồng sự kiện |
| **KMS Encryption** | Sử dụng KMS CMK hoặc AWS Managed Key | Mã hóa dữ liệu log tại S3 |

---

## 3. Các bước thực hiện chi tiết trên AWS Console (Console Steps)

### Bước 1: Tạo CloudTrail và Cấu hình Lưu trữ S3

1. Đăng nhập vào **AWS Management Console**, chọn Region `ap-southeast-1`.
2. Nhập `CloudTrail` vào ô tìm kiếm -> Chọn dịch vụ **CloudTrail**.
3. Tại menu bên trái, nhấp vào **Trails** -> Nhấp nút cam **Create trail**.
4. **Step 1 - Choose trail attributes:**
   - **Trail name:** Nhập `sre-platform-audit-trail`.
   - **Storage location:**
     - Chọn radio button **Create new S3 bucket**.
     - **Trail log bucket and folder:** Nhập tên bucket duy nhất toàn cầu (ví dụ: `sre-platform-audit-logs-11223344`).
   - **Log file SSE-KMS encryption:**
     - Tích chọn **Enabled** nếu muốn mã hóa bằng KMS CMK (chọn khóa `alias/sre-platform-dev-main`), hoặc bỏ chọn để dùng SSE-S3 mặc định nhằm tiết kiệm chi phí lab.
   - **Log file validation:**
     - Bắt buộc tích chọn **Enabled** (tạo file digest sau mỗi 1 giờ để phát hiện sửa đổi).
   - **CloudWatch Logs:**
     - Có thể bỏ qua trong lab ban đầu để tránh chi phí CloudWatch Ingestion, hoặc bật nếu cần tạo Alarm tức thời.
   - Nhấp nút **Next**.
5. **Step 2 - Choose log events:**
   - **Event type:**
     - Tích chọn **Management events** (Mặc định: ghi nhận thao tác kiểm soát hạ tầng).
     - Bỏ chọn *Data events* (tránh phát sinh chi phí lớn khi đọc/ghi từng object S3 trong lab).
   - **Management events:**
     - API activity: Chọn cả **Read** và **Write**.
   - Nhấp nút **Next**.
6. **Step 3 - Review and create:**
   - Kiểm tra lại toàn bộ thông tin -> Nhấp nút **Create trail**.
   - Xác nhận Trail chuyển sang trạng thái **Logging** (Màu xanh lá cây).

---

### Bước 2: Kích hoạt Amazon GuardDuty

1. Nhập `GuardDuty` vào thanh tìm kiếm Console -> Chọn dịch vụ **Amazon GuardDuty**.
2. Nếu đây là lần đầu tiên mở dịch vụ:
   - Nhấp vào nút xanh **Get Started**.
   - Nhấp tiếp nút cam **Enable GuardDuty**.
3. Nếu đã bật trước đó:
   - Vào menu bên trái -> Chọn **Settings** -> Xác nhận **Detector status** là **Enabled**.
4. GuardDuty sẽ tự động phân tích:
   - VPC Flow Logs (kết nối mạng).
   - CloudTrail Management Events (thao tác người dùng).
   - DNS Query Logs (truy vấn tên miền độc hại).
   - EKS Audit Logs (nếu bật EKS Protection).

---

## 4. Xác minh (Verification)

### 4.1. Kiểm tra CloudTrail S3 Delivery
1. Vào **Amazon S3 Console** -> Mở bucket `sre-platform-audit-logs-...`.
2. Kiểm tra cấu trúc thư mục:
   `AWSLogs/<ACCOUNT_ID>/CloudTrail/ap-southeast-1/YYYY/MM/DD/`
3. Xác nhận các tệp log dạng `.json.gz` đang được ghi đều đặn.

### 4.2. Kiểm tra bằng AWS CLI

```bash
# 1. Kiểm tra trạng thái ghi log của CloudTrail
aws cloudtrail get-trail-status \
  --name sre-platform-audit-trail \
  --output table

# 2. Xác thực tính toàn vẹn của log files (Log File Integrity)
aws cloudtrail validate-logs \
  --trail-arn $(aws cloudtrail describe-trails --trail-name-list sre-platform-audit-trail --query 'trailList[0].TrailARN' --output text) \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ)

# 3. Kiểm tra trạng thái detector của GuardDuty
aws guardduty list-detectors --output table
```

---

## 5. Chuyển giao sang IaC (Terraform Snippet)

```hcl
resource "aws_s3_bucket" "audit_logs" {
  bucket        = "sre-platform-audit-logs-prod-dev"
  force_destroy = true
}

resource "aws_cloudtrail" "main" {
  name                          = "sre-platform-audit-trail"
  s3_bucket_name                = aws_s3_bucket.audit_logs.id
  include_global_service_events = true
  is_multi_region_trail         = true
  enable_log_file_validation    = true

  tags = {
    Project   = "sre-platform"
    ManagedBy = "terraform"
  }
}

resource "aws_guardduty_detector" "primary" {
  enable = true
}
```

---

## 6. Điều kiện hoàn thành Gate (Gate Check)

- [ ] CloudTrail `sre-platform-audit-trail` ở trạng thái `Logging: True`.
- [ ] Tính năng `Log File Validation` đã bật và lưu log định kỳ vào S3 Bucket.
- [ ] Amazon GuardDuty đã được kích hoạt trên Region thực hành.
- [ ] Báo cáo chi phí được kiểm soát: Data events tắt để tránh chi phí ngoài dự kiến.

---

## 7. Dọn dẹp tài nguyên (Cleanup)

1. **Tắt GuardDuty:**
   - Vào **GuardDuty Console** -> **Settings** -> Kéo xuống cuối -> Nhấp **Disable GuardDuty**.
2. **Xóa CloudTrail:**
   - Vào **CloudTrail Console** -> **Trails** -> Chọn `sre-platform-audit-trail` -> Nhấp **Delete**.
3. **Xóa S3 Bucket Audit Logs:**
   - Vào **S3 Console** -> Chọn bucket log -> Nhấp **Empty** để xóa toàn bộ objects -> Nhấp **Delete bucket**.
