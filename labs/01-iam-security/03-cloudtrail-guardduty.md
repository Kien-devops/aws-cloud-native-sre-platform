# 01.03 — AWS CloudTrail & Amazon GuardDuty

> **Phạm vi:** Audit Logging & Continuous Threat Detection | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Full API Auditability:** Ghi lại toàn bộ lời gọi AWS API (Control Plane & IAM events) để phục vụ truy vết sự cố (Forensics) và tuân thủ bảo mật.
- **Managed Threat Detection:** Kích hoạt Amazon GuardDuty giám sát bất thường ở tầng CloudTrail, VPC Flow Logs, DNS Logs và EKS Audit Logs.
- **Cost-Aware Retention:** Lưu log vào S3 với Lifecycle Policy chuyển sang Glacier/xóa sau 90 ngày để tối ưu chi phí.

---

## 2. Đặc tả Tài nguyên (Resource Inventory & Config)

| Resource Type | Tên Resource (Naming) | Tham số Cấu hình Cốt lõi |
| :--- | :--- | :--- |
| **CloudTrail Trail** | `sre-platform-dev-audit-trail` | Multi-region: `Enabled`, Log file validation: `Enabled`, KMS: `alias/sre-platform-dev-main` |
| **S3 Bucket (Logs)** | `sre-platform-dev-cloudtrail-logs-<account-id>` | Public Access: `Blocked All`, Encryption: `SSE-KMS`, Lifecycle: `90 days` |
| **GuardDuty Detector** | `sre-platform-dev-guardduty` | Status: `ENABLED`, Finding Export: `15 minutes`, EKS Protection: `Enabled` |

---

## 3. Chiến lược Tagging & Labels

| Tag Key | Tag Value | Mục đích |
| :--- | :--- | :--- |
| `Name` | `sre-platform-dev-audit-trail` | Định danh Trail & Detector |
| `Project` | `sre-platform` | Phân bổ tài nguyên |
| `Environment` | `dev` | Cô lập môi trường |
| `Component` | `security-audit` | Nhóm kiểm toán bảo mật |

---

## 4. Tham chiếu IaC / GitOps
- Quản lý ở tầng Account Security Baseline (`ap-southeast-1`).

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
```bash
aws cloudtrail get-trail-status --name sre-platform-dev-audit-trail --region ap-southeast-1 --query "IsLogging"
aws guardduty list-detectors --region ap-southeast-1
```
- **PASS:** `IsLogging = true` và tồn tại GuardDuty Detector ở trạng thái `ENABLED`.
