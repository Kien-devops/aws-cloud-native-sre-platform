# 00.03 — Thu thập Bằng chứng, Phê duyệt Thay đổi và Che dấu Dữ liệu Nhạy cảm (Redaction)

> **Trạng thái:** Hướng dẫn thực hành chuẩn mực SRE (SRE Standards & Evidence Protocols).  
> **Áp dụng cho:** Tất cả các bài lab từ 01 đến 10; đảm bảo tính minh bạch, khả năng tái lập và an toàn thông tin tuyệt đối.

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Ban hành quy trình thu thập bằng chứng kỹ thuật (Evidence Collection) thực tế sau mỗi bước thao tác trên AWS Console.
  - Thiết lập ranh giới phê duyệt (Approval Gates) đối với các hành động rủi ro cao: Tạo tài nguyên tính phí cao, thay đổi chính sách IAM, mở cổng Security Group ra Internet, hoặc xóa dữ liệu.
  - Hướng dẫn quy tắc che giấu thông tin nhạy cảm (Sanitization & Redaction) trước khi commit bất kỳ bằng chứng nào vào Git.
- **Nguyên tắc SRE:**
  - **No Evidence, No Pass:** Không tự tuyên bố "đã hoàn thành" hoặc "hệ thống hoạt động tốt" nếu không có log thực tế, output câu lệnh, hoặc metrics đo đạc từ AWS CloudWatch.
  - **Distinguish Expected vs. Measured:** Phân biệt rạch ròi giữa "kết quả mong đợi theo lý thuyết" (Expected) và "kết quả thực tế đo được" (Measured Result).
  - **Zero Credential Leakage:** Một lần rò rỉ Access Key hoặc Password lên GitHub công khai có thể dẫn đến thiệt hại tài chính nghiêm trọng trong vòng vài phút.

---

## 2. Quy tắc Che giấu Dữ liệu Nhạy cảm (Redaction Rules)

Trước khi lưu file bằng chứng vào thư mục `labs/*/evidence/` hoặc commit vào Git repository, bắt buộc phải duyệt và thay thế các chuỗi ký tự sau:

| Loại dữ liệu | Chuỗi nhạy cảm thực tế | Chuỗi sau khi che giấu (Redacted) |
| :--- | :--- | :--- |
| **AWS Account ID** | `123456789012` | `***REDACTED_ACCOUNT_ID***` hoặc `111122223333` |
| **IAM User/Role ARN** | `arn:aws:iam::123456789012:role/...` | `arn:aws:iam::***REDACTED***:role/...` |
| **Secret Value / Password** | `My$ecr3tP@ssw0rd!` | `***REDACTED_SECRET_VALUE***` |
| **AWS Access Key ID** | `AKIAIOSFODNN7EXAMPLE` | `AKIA****************` |
| **AWS Secret Access Key** | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` | `****************************************` |
| **Public IP máy chủ / client**| `203.113.152.12` | `203.0.113.x` (RFC 5737 Test-Net) |
| **Email cá nhân** | `nguyenvana@gmail.com` | `admin@example.com` |

---

## 3. Quy trình Đối chiếu Thao tác trên AWS CloudTrail Console

Khi thực hiện thao tác trên Console, nếu muốn lấy bằng chứng kiểm toán (Audit Trail) để đối chiếu:

1. Nhập `CloudTrail` vào thanh tìm kiếm Console -> Chọn **CloudTrail**.
2. Tại menu bên trái, nhấp vào **Event history**.
3. Tại ô **Lookup attributes**:
   - Chọn `Event source` -> Nhập dịch vụ vừa thao tác (ví dụ `secretsmanager.amazonaws.com` hoặc `eks.amazonaws.com`).
   - Hoặc chọn `Event name` -> Nhập hành động cụ thể (ví dụ `CreateCluster`, `StoreSecret`, `CreateVpc`).
4. Nhấp vào tên Event để xem bản ghi JSON chi tiết:
   - Ghi nhận `eventTime`, `userIdentity.arn`, `sourceIPAddress`, `responseElements`.
   - Sao chép JSON này, thực hiện che giấu (redaction) Account ID / IP trước khi lưu làm bằng chứng lab.

---

## 4. Ranh giới Phê duyệt (Approval Gate Checklist)

Trước khi thực hiện các bài lab có mức độ ảnh hưởng lớn, phải tự kiểm tra 4 câu hỏi:

1. **Blast Radius (Phạm vi ảnh hưởng):** Thao tác này có ảnh hưởng đến các tài nguyên khác trong tài khoản không?
2. **Cost Impact (Chi phí phát sinh):** Tài nguyên sắp tạo có phí duy trì theo giờ không? (Ví dụ: NAT Gateway ~$32/tháng, EKS Cluster ~$73/tháng, RDS Multi-AZ ~$50+/tháng). Đã có kế hoạch tắt/hủy chưa?
3. **Rollback Plan (Kế hoạch hoàn nguyên):** Nếu thao tác thất bại giữa chừng, cách khôi phục về trạng thái ổn định ban đầu là gì?
4. **Data Loss (Nguy cơ mất mát dữ liệu):** Thao tác có format volume, drop database, hay purge SQS queue không? Đã tạo snapshot/backup chưa?

---

## 5. Mẫu Báo cáo Bằng chứng Chuẩn cho Mọi Bài Lab (Evidence Template)

Mọi báo cáo thực nghiệm trong các bài lab tiếp theo bắt buộc áp dụng cấu trúc Markdown chuẩn sau:

```markdown
### Báo cáo Thực nghiệm Lab [Mã Lab]
- **Người thực hiện:** SRE Engineer
- **Thời gian thực hiện (UTC):** YYYY-MM-DDTHH:MM:SSZ
- **Region:** ap-southeast-1
- **Tài nguyên khởi tạo / thay đổi:**
  - Resource Type: [AWS Service Name]
  - Resource Identifier: [Tên tài nguyên / ID đã redact]
- **Kết quả Mong đợi (Expected):**
  - [Mô tả trạng thái lý thuyết cần đạt được]
- **Kết quả Thực tế Đo được (Measured Result):**
  - Status: [Active / Healthy / Succeeded]
  - Telemetry / Metrics: [p95 Latency = xx ms, Error Rate = 0%]
- **Evidence Snippet (CLI / Log Output):**
  ```text
  [Dán log hoặc bảng kết quả đã redact ở đây]
  ```
- **Xác nhận Tuân thủ An toàn:**
  - [x] Đã redact toàn bộ Account ID, Secret, Access Key.
  - [x] Không lưu trữ dữ liệu nhạy cảm vào Git.
```

---

## 6. Điều kiện hoàn thành Gate (Gate Check)

- [ ] Hiểu rõ quy tắc Redaction và cam kết không push secret vào Git.
- [ ] Biết cách tra cứu lịch sử thao tác trên AWS CloudTrail Console Event History.
- [ ] Sẵn sàng áp dụng mẫu Evidence Template cho toàn bộ các bài lab từ Phase 01 đến 10.
