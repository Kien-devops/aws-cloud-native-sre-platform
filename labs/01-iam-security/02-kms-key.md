# 01.02 — AWS KMS Customer Managed Key (CMK)

> **Phạm vi:** Encryption at Rest & Key Governance | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Centralized Envelope Encryption:** Mọi dữ liệu nhạy cảm (EKS etcd secrets, EBS volumes, RDS PostgreSQL, SQS queues, Secrets Manager, S3 Terraform state) đều mã hóa bằng Customer Managed Key riêng.
- **Automatic Key Rotation:** Bật xoay vòng khóa tự động hàng năm (`enable_key_rotation = true`) mà không gây downtime.
- **Safe Deletion Window:** Đặt thời gian chờ hủy khóa tối thiểu `7 days` (`deletion_window_in_days = 7`).

---

## 2. Đặc tả Tài nguyên (Resource Inventory & Config)

| Resource Type | Tên Resource (Naming) | Tham số Cấu hình Cốt lõi |
| :--- | :--- | :--- |
| **KMS Key (CMK)** | `sre-platform-dev-main-cmk` | Type: `Symmetric` (`ENCRYPT_DECRYPT`), Rotation: `Enabled (365d)`, Pending Window: `7 days` |
| **KMS Alias** | `alias/sre-platform-dev-main` | Trỏ tới `sre-platform-dev-main-cmk` |
| **Key Policy Principals** | Root Account, EKS Role, RDS, SQS, Secrets Manager, CloudWatch Logs | Cho phép `kms:Encrypt`, `kms:Decrypt`, `kms:GenerateDataKey*`, `kms:CreateGrant` theo service principal |

---

## 3. Chiến lược Tagging & Labels

| Tag Key | Tag Value | Mục đích |
| :--- | :--- | :--- |
| `Name` | `sre-platform-dev-main-cmk` | Định danh khóa CMK chính |
| `Project` | `sre-platform` | Phân bổ chi phí ($1/tháng/key) |
| `Environment` | `dev` | Cô lập môi trường |

---

## 4. Tham chiếu IaC / GitOps
- [02-kms.tf](../../iac/terraform/envs/dev/02-kms.tf) — Khai báo `aws_kms_key.main` và `aws_kms_alias.main`.
- Tham chiếu sử dụng tại: [03-eks.tf](../../iac/terraform/envs/dev/03-eks.tf), [04-database.tf](../../iac/terraform/envs/dev/04-database.tf), [05-messaging.tf](../../iac/terraform/envs/dev/05-messaging.tf).

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
```bash
aws kms describe-key --key-id alias/sre-platform-dev-main --region ap-southeast-1 --query "KeyMetadata.{KeyState:KeyState,KeyUsage:KeyUsage}"
aws kms get-key-rotation-status --key-id alias/sre-platform-dev-main --region ap-southeast-1
```
- **PASS:** `KeyState = Enabled`, `KeyRotationEnabled = true`.
