# 01.04 — Secrets Redaction & DevSecOps Pre-Commit Gate

> **Phạm vi:** Shift-Left Secret Prevention | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Shift-Left Secret Scanning:** Ngăn chặn token, AWS Key, DB Password và Terraform State lọt vào Git ngay từ máy trạm (pre-commit hook) và trên CI pipeline.
- **Strict `.gitignore` Boundary:** Các file state hoặc cấu hình backend riêng tư (`backend.tf`, `*.tfstate`, `.env`) bắt buộc nằm ngoài Git tracking.

---

## 2. Đặc tả Công cụ & Quy tắc Kiểm soát

| Thành phần | Tên File / Công cụ | Tham số Cấu hình Cốt lõi |
| :--- | :--- | :--- |
| **Git Ignore Rules** | `.gitignore` | Loại trừ: `**/backend.tf`, `*.tfstate*`, `.terraform/`, `.env*`, `*.pem`, `*.key` |
| **Pre-Commit Hook** | `.pre-commit-config.yaml` | Kiểm tra regex/secret (`AKIA...`, `secret_access_key`, private keys), YAML lint, trailing whitespace |
| **CI Container Scan** | `Trivy` (`security-scan.yml`) | Quét OS & NPM vulnerabilities trên mọi Docker image; **Fail build** nếu gặp `HIGH` hoặc `CRITICAL` |

---

## 3. Chiến lược Redaction Tài liệu

| Loại Dữ liệu | Quy tắc Xử lý trước khi Commit |
| :--- | :--- |
| **Terraform Backend** | Chỉ commit `backend.tf.example` (chứa placeholder `<ACCOUNT_ID>`), ignore `backend.tf` thật |
| **K8s Secrets** | Không commit `Secret` YAML chứa base64 thật; chỉ dùng `ExternalSecret` tham chiếu AWS Secrets Manager |

---

## 4. Tham chiếu IaC / GitOps
- [.gitignore](../../.gitignore)
- [.pre-commit-config.yaml](../../.pre-commit-config.yaml)
- [backend.tf.example](../../iac/terraform/envs/dev/backend.tf.example)

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
- **PASS:** `git status` không theo dõi `backend.tf` hay `*.tfstate`; toàn bộ manifests trong `gitops/` dùng `ExternalSecret` thay vì hardcoded `Secret`.
