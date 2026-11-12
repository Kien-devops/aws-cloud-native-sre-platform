# 00.03 — Evidence & Secret Redaction Standards

> **Phạm vi:** Security Compliance & Audit | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Evidence-Based SRE:** Mọi trạng thái hạ tầng, load test và chaos drill phải có log/ảnh chứng minh thực tế.
- **Zero Secret Leakage:** Tuyệt đối không commit AWS Account ID thật (nếu yêu cầu ẩn danh), Access Keys, Passwords, DB Credentials, JWT tokens hoặc Private Keys lên Git.

---

## 2. Đặc tả Quy chuẩn Redaction

| Dữ liệu Nhạy cảm | Giá trị Gốc (Ví dụ) | Giá trị Sau Redaction |
| :--- | :--- | :--- |
| **AWS Account ID** | `620306387033` (ví dụ) | `123456789012` hoặc `***` |
| **AWS Access Key ID** | `AKIA...` | `AKIA****************` |
| **DB / Redis Password** | Plaintext string | `***REDACTED***` |
| **Secret Values / Tokens** | Bearer token / API key | `***REDACTED***` |
| **Terraform State (`backend.tf`)** | Chứa bucket/key riêng tư | Đưa vào `.gitignore`, chỉ giữ `backend.tf.example` |

---

## 3. Chiến lược Lưu trữ Bằng chứng

| Loại Bằng chứng | Đường dẫn Lưu trữ | Định dạng |
| :--- | :--- | :--- |
| **Ảnh chụp Console / Argo / Grafana** | `docs/images/evidence/*.png\|.jpg` | PNG / JPG đã che thông tin nhạy cảm |
| **Sơ đồ Kiến trúc Draw.io** | `docs/diagrams/*.drawio` & `docs/images/architecture/` | `.drawio`, `.png`, `.jpg` |
| **Incident Drill / Postmortem** | `sre/incidents/*.md` | Markdown |

---

## 4. Tham chiếu IaC / GitOps
- [.gitignore](../../.gitignore) — Loại trừ `**/backend.tf`, `*.tfstate`, `.env`, `*.pem`.
- [.pre-commit-config.yaml](../../.pre-commit-config.yaml) — Chặn commit chứa secret trước khi đẩy lên remote.

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
- **PASS:** Không tồn tại plaintext secret hoặc file `*.tfstate` / `backend.tf` trong lịch sử Git; mọi file evidence đều đã được redact.
