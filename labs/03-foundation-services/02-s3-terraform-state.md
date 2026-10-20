# 03.02 — Khởi tạo Amazon S3 Bucket và DynamoDB Table cho Terraform Remote State

> **Trạng thái:** Hướng dẫn thực hành chi tiết trên AWS Management Console (Console-first).  
> **Áp dụng cho:** Quản lý tập trung trạng thái hạ tầng (State Storage) và khóa đồng thời (State Locking) cho Terraform.

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Tạo một **Amazon S3 Bucket** chuyên dụng để lưu trữ tệp trạng thái Terraform (`terraform.tfstate`).
  - Kích hoạt **Bucket Versioning** (Phiên bản hóa) để tự động lưu giữ lịch sử mọi lần thay đổi và cho phép khôi phục khi state bị hỏng (State Corruption).
  - Bật **Block All Public Access** và mã hóa mặc định bằng **KMS Customer Managed Key** (`alias/sre-platform-dev-main`).
  - Khởi tạo **Amazon DynamoDB Table** với khóa phân vùng `LockID` phục vụ cơ chế **State Locking** ngăn ngừa xung đột ghi đồng thời (Race Condition) khi nhiều kỹ sư hoặc CI chạy cùng lúc.
- **Nguyên tắc SRE:**
  - **State is the Single Source of Truth:** Tệp `terraform.tfstate` chứa toàn bộ ánh xạ giữa mã nguồn và tài nguyên thực tế trên AWS. Mất state tương đương với mất khả năng quản lý hạ tầng bằng code.
  - **Concurrency Protection:** Không bao giờ chạy Terraform mà không có cơ chế Locking; hai lệnh `terraform apply` chạy đồng thời có thể gây phá hủy tài nguyên hoặc ghi đè state.
  - **Zero Public Exposure:** State chứa metadata của toàn bộ hệ thống và đôi khi chứa cả secrets chưa redact; bucket lưu state phải được khóa chặn ở mức nghiêm ngặt nhất.

---

## 2. Thông số đầu vào (Input Parameters)

| Tham số | Giá trị mẫu | Ý nghĩa |
| :--- | :--- | :--- |
| **S3 Bucket Name** | `sre-platform-terraform-state-<account-id>` | Tên bucket duy nhất toàn cầu |
| **AWS Region** | `ap-southeast-1` | Cùng Region với hạ tầng quản lý |
| **Versioning** | `Enabled` | Bắt buộc để phòng ngừa thảm họa hỏng state |
| **Encryption** | `AWS-KMS` (`alias/sre-platform-dev-main`) | Mã hóa tệp state với CMK |
| **DynamoDB Table Name** | `sre-platform-terraform-locks` | Bảng quản lý khóa lock |
| **Partition Key** | `LockID` (kiểu String) | Tên trường khóa chính theo chuẩn Terraform |

---

## 3. Các bước thực hiện chi tiết trên AWS Console (Console Steps)

### Bước 1: Khởi tạo Amazon S3 Bucket lưu trữ State

1. Mở ô tìm kiếm Console -> Nhập `S3` -> Chọn dịch vụ **S3**.
2. Nhấp vào nút cam **Create bucket**.
3. **General configuration:**
   - **Bucket name:** Nhập `sre-platform-terraform-state-<mã_tùy_chọn>` (ví dụ `sre-platform-terraform-state-dev-sg`).
   - **AWS Region:** Chọn `ap-southeast-1`.
4. **Object Ownership:** Chọn **ACLs disabled (recommended)**.
5. **Block Public Access settings for this bucket:**
   - Tích chọn **Block all public access**.
   - Tích chọn cả 4 ô kiểm tra bên dưới (chặn hoàn toàn mọi truy cập công khai).
6. **Bucket Versioning:**
   - Chọn radio button **Enable** (Bắt buộc).
7. **Default encryption:**
   - **Encryption type:** Chọn **Server-side encryption with AWS Key Management Service keys (SSE-KMS)**.
   - **KMS key:** Chọn **Choose from your AWS KMS keys** -> Chọn `alias/sre-platform-dev-main`.
   - **Bucket Key:** Chọn **Enable**.
8. **Tags:** Thêm `Environment` = `dev`, `Project` = `sre-platform`, `Purpose` = `terraform-state`.
9. Nhấp **Create bucket**.

---

### Bước 2: Khởi tạo Amazon DynamoDB Table cho State Locking

1. Nhập `DynamoDB` vào thanh tìm kiếm Console -> Chọn **DynamoDB**.
2. Tại menu bên trái, nhấp vào **Tables** -> Nhấp nút cam **Create table**.
3. **Table details:**
   - **Table name:** Nhập `sre-platform-terraform-locks`.
   - **Partition key:**
     - Tên trường: Nhập chính xác từng chữ hoa/thường: `LockID`.
     - Kiểu dữ liệu: Chọn **String**.
   - **Sort key:** Để trống.
4. **Table settings:**
   - Chọn **Default settings** (hoặc chọn Customize settings -> Chọn **On-demand** capacity mode để chỉ tính tiền khi có lệnh lock, chi phí ~$0/tháng ở môi trường dev).
5. **Tags:** `Environment` = `dev`, `Project` = `sre-platform`.
6. Nhấp **Create table**.
7. Chờ 10-15 giây để bảng chuyển từ trạng thái `Creating` sang **Active**.

---

## 4. Xác minh (Verification)

### 4.1. Kiểm tra trên Console
- **S3 Console:** Xác nhận bucket có nhãn **Bucket and objects not public**, **Versioning: Enabled**, **Default encryption: SSE-KMS**.
- **DynamoDB Console:** Bảng `sre-platform-terraform-locks` có trạng thái **Active**, Primary key là `LockID (String)`.

### 4.2. Kiểm tra bằng AWS CLI
```bash
# Kiểm tra cấu hình versioning của bucket
aws s3api get-bucket-versioning \
  --bucket sre-platform-terraform-state-dev-sg \
  --output table

# Kiểm tra trạng thái của DynamoDB Table
aws dynamodb describe-table \
  --table-name sre-platform-terraform-locks \
  --query 'Table.{Name:TableName,Status:TableStatus,BillingMode:BillingModeSummary.BillingMode}' \
  --output table
```

---

## 5. Chuyển giao sang Handoff Backend (`iac/terraform/envs/dev/backend.tf`)

Sau bài lab này, khi khởi tạo Terraform code trong repository, khai báo file `backend.tf`:

```hcl
terraform {
  backend "s3" {
    bucket         = "sre-platform-terraform-state-dev-sg"
    key            = "dev/sre-platform.tfstate"
    region         = "ap-southeast-1"
    dynamodb_table = "sre-platform-terraform-locks"
    encrypt        = true
  }
}
```

---

## 6. Điều kiện hoàn thành Gate (Gate Check)

- [ ] S3 Bucket tồn tại, bị chặn 100% Public Access.
- [ ] Versioning đã được bật trên S3 Bucket (có thể khôi phục các phiên bản cũ của state).
- [ ] DynamoDB Table `sre-platform-terraform-locks` với partition key `LockID` ở trạng thái `Active`.
- [ ] Đã sẵn sàng các thông số backend để chuyển giao cho Terraform ở Phase 10.

---

## 7. Dọn dẹp tài nguyên (Cleanup)

> [!CAUTION]
> Tuyệt đối KHÔNG xóa S3 Bucket này nếu Terraform đã lưu file state thực tế vào bên trong. Xóa state sẽ làm mất liên kết quản lý toàn bộ hạ tầng AWS!

Khi hủy hoàn toàn dự án:
1. Vào **DynamoDB Console** -> Chọn bảng `sre-platform-terraform-locks` -> Nhấp **Delete table**.
2. Vào **S3 Console** -> Chọn bucket state -> Nhấp **Empty** (chọn xóa vĩnh viễn mọi phiên bản objects) -> Nhấp **Delete bucket**.
