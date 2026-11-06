# Module 01: IAM, Bảo mật & Audit Guardrails

**Danh tính ngắn hạn, mã hóa có kiểm soát và audit có thể truy vết.**

[Labs](../README.md) / Module 01 · [Trước: Chuẩn bị](../00-chuan-bi/README.md) · [Tiếp: Network](../02-network/README.md)

## 1. Tổng quan Module

Module 01 triển khai hàng rào bảo mật nền tảng (Security Guardrails) theo nguyên tắc Least Privilege:
- **Zero Static Keys:** Loại bỏ hoàn toàn AWS Access Key dài hạn trong CI/CD bằng cách thiết lập Identity Federation qua **GitHub Actions OIDC Provider**.
- **KMS Customer Managed Key (CMK):** Khởi tạo khóa mã hóa dữ liệu độc lập với cơ chế tự động xoay vòng khóa hàng năm (Annual Key Rotation) và tách biệt Key Administrators với Key Users.
- **Audit & Threat Detection:** Kích hoạt **AWS CloudTrail** đa vùng với tính năng xác thực toàn vẹn file log (Log File Integrity Validation) và bật **Amazon GuardDuty** phát hiện mối đe dọa sớm.
- **Secrets Prevention:** Tích hợp công cụ quét mã độc và lộ bí mật tự động (**Gitleaks**) trước khi commit mã nguồn vào Git.

---

## 2. Danh mục bài Lab chi tiết

| Bài Lab | Tiêu đề | Trọng tâm kỹ thuật | Console / CLI Path |
| :--- | :--- | :--- | :--- |
| [01.01](01-github-oidc-roles.md) | GitHub Actions OIDC | Provider, trust policy, phạm vi repo/branch | IAM > Identity providers |
| [01.02](02-kms-key.md) | KMS key | Rotation, quyền quản trị và quyền sử dụng | KMS |
| [01.03](03-cloudtrail-guardduty.md) | Audit & Detection | CloudTrail, S3 log storage, GuardDuty | CloudTrail / GuardDuty |
| [01.04](04-secrets-redaction.md) | Secret prevention | Gitleaks, Git hooks, thu hồi credential | CLI / Git Hooks |

---

## 3. Tiêu chí hoàn thành Module (Exit Gate)

- [ ] GitHub Actions OIDC Provider hoạt động; workflow GitHub Actions assume role thành công mà không dùng static AWS credentials.
- [ ] Khóa KMS CMK ở trạng thái `Enabled`, có bí danh chuẩn và bật tự động xoay vòng hàng năm.
- [ ] CloudTrail ghi nhận đầy đủ Management Events vào S3 với tính năng xác thực toàn vẹn file log bật sẵn.
- [ ] Amazon GuardDuty đang ở trạng thái `Running` tại Region `ap-southeast-1`.
- [ ] Gitleaks chặn thành công các commit thử nghiệm chứa token hoặc secret giả lập.
