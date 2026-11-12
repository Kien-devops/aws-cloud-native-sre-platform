# 00.01 — Account, Region & Identity Baseline

> **Phạm vi:** Governance & IAM Baseline | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Single Region Invariant:** Toàn bộ tài nguyên AWS triển khai tập trung tại `ap-southeast-1` (Singapore) để tối ưu độ trễ và tránh chi phí cross-region data transfer.
- **Zero Root Account Usage:** Tài khoản Root chỉ dùng để bật MFA và cài đặt ban đầu; mọi thao tác hàng ngày dùng IAM Role / IAM User có quyền tối thiểu (Least Privilege).
- **No Long-Lived Credentials:** Không lưu trữ `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` trong mã nguồn, Git hay container.

---

## 2. Đặc tả Tài nguyên (Resource Inventory & Config)

| Resource Type | Tên Resource / Giá trị Chuẩn | Tham số Cấu hình Cốt lõi |
| :--- | :--- | :--- |
| **AWS Region** | `ap-southeast-1` | Default region cho toàn bộ CLI, Terraform & GitOps |
| **Account ID (Redacted)** | `123456789012` | Giá trị ẩn danh chuẩn khi lưu evidence lên Git |
| **Admin / Operator IAM** | IAM User / SSO Role (MFA Enabled) | Bắt buộc kích hoạt Virtual/Hardware MFA |
| **CLI Profile** | `default` / OIDC Session | Output format `json`, `region = ap-southeast-1` |

---

## 3. Chiến lược Tagging & Labels

| Tag Key | Tag Value | Mục đích |
| :--- | :--- | :--- |
| `Project` | `sre-platform` | Định danh dự án xuyên suốt tài khoản |
| `Environment` | `dev` \| `staging` \| `prod` | Phân tách môi trường & chi phí |

---

## 4. Tham chiếu IaC / GitOps
- [variables.tf](../../iac/terraform/envs/dev/variables.tf) — Khai báo `aws_region = "ap-southeast-1"`, `environment = "dev"`.
- [backend.tf.example](../../iac/terraform/envs/dev/backend.tf.example) — Cấu hình provider mặc định & default tags.

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
```bash
aws sts get-caller-identity --region ap-southeast-1
```
- **PASS:** Trả về đúng Account ID và ARN của IAM User/Role (không phải `:root`), `aws configure get region` trả về `ap-southeast-1`.
