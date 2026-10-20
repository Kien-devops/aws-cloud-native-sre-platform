# 03.02 — S3 remote state cho Terraform

## Input

- Region, KMS key, owner và bucket name đã xác định.
- VPC/network đã qua Gate 02.

## Console steps

1. Mở S3 → Create bucket; chọn đúng Region và bật Block all public access.
2. Bật Versioning.
3. Bật Default encryption bằng KMS key dành cho Terraform state.
4. Thêm bucket policy tối thiểu cho Terraform role; không cấp quyền public.
5. Kiểm tra Encryption, Versioning và Access trước khi lưu.

## Verify / Output

- Expected: bucket private, versioning Enabled, encryption KMS.
- Measured Result: Chưa thực hiện; lưu bucket name đã redact, timestamp và screenshot.
- Output: backend parameters cho bước Terraform handoff.

## Gate / Cleanup

- Gate: policy đã review, không có public access, state lock/design đã thống nhất.
- Lỗi access: kiểm tra IAM role, KMS key policy và Region.
- Cleanup: chỉ xóa sau khi state đã migrate/backup và có approval; xóa object versions theo policy.

## Handoff

Không chạy Terraform init/apply tại lab này. Import và reconcile nằm ở phase 10.
