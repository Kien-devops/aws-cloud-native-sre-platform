# 09.06 — Incident Runbooks & Blameless Postmortem

> **Phạm vi:** Incident Response & Operational Excellence | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Standardized Triage (MTTR Optimization):** Mọi cảnh báo nghiêm trọng (DLQ > 0, High 5xx, CrashLoopBackOff, OOMKilled) đều có Runbook xử lý từng bước rõ ràng.
- **Blameless Culture:** Postmortem tập trung vào lỗ hổng hệ thống, phòng ngừa tái diễn và action items cụ thể thay vì đổ lỗi cá nhân.

---

## 2. Danh mục Tài nguyên Vận hành (`sre/`)

| Tài liệu | Đường dẫn | Nội dung Chính |
| :--- | :--- | :--- |
| **Incident Triage** | `sre/runbooks/incident-triage.md` | Quy trình điều tra từ Metrics -> Traces -> Logs |
| **Common Failures** | `sre/runbooks/common-failures.md` | Xử lý `OOMKilled`, `CrashLoopBackOff`, `SQS DLQ Replay`, `RDS Connection Exhaustion` |
| **Postmortem Template** | `sre/postmortems/template.md` | Timeline, Root Cause (5 Whys), Action Items |
| **Actual Drill Report** | `sre/incidents/drill-canary-abort.md` | Báo cáo diễn tập Canary Abort thực tế |

---

## 3. Chiến lược Tagging & Labels
- Incident ID chuẩn: `INC-YYYYMMDD-<sequence>` gắn trong tiêu đề báo cáo.

---

## 4. Tham chiếu IaC / GitOps
- [sre/runbooks/README.md](../../sre/runbooks/README.md)

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
- **PASS:** Runbook có đủ lệnh kiểm tra read-only, quy trình rollback an toàn và mẫu Postmortem hoàn chỉnh.
