# 08.06 — Automated Rollback & GitOps Revert

> **Phạm vi:** Failure Containment & Recovery | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Automated Canary Abort:** Nếu phiên bản Canary vượt ngưỡng lỗi (`5xx > 1%`) hoặc latency (`P95 > 500ms`), Argo Rollouts tự động **Abort** và chuyển `100%` traffic về `stable` mà không cần con người can thiệp.
- **GitOps Auditability (`git revert`):** Sau khi hệ thống tự bảo vệ (Degraded/Aborted), kỹ sư thực hiện `git revert` commit lỗi trên nhánh GitOps để đồng bộ lại trạng thái `Synced` & `Healthy`.

---

## 2. Đặc tả Cơ chế Rollback

| Kịch bản Lỗi | Cơ chế Phản ứng | Thời gian Phục hồi |
| :--- | :--- | :--- |
| **Bad Canary Release (5xx / High Latency)** | `AnalysisRun` đánh dấu `Failed` -> Argo Rollouts chuyển 100% traffic về `order-service-stable` | Tự động trong `< 30 giây` |
| **Config / Manifest Error sau Sync** | Thực hiện `git revert <bad-commit>` trên nhánh `dev`/`main` -> Argo CD tự reconcile bản sạch | `< 10 giây` sau push |

---

## 3. Chiến lược Tagging & Labels
- Mọi sự cố Canary Abort được ghi nhận thành Incident Report kèm `traceId` và Commit SHA lỗi.

---

## 4. Tham chiếu IaC / GitOps
- [sre/incidents/drill-canary-abort.md](../../sre/incidents/drill-canary-abort.md) — Biên bản diễn tập Canary Abort thực tế.

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
- **PASS:** Khi giả lập lỗi trên bản Canary, traffic lập tức cắt về 100% Stable, Error Budget không bị đốt quá ngưỡng, và `git revert` đưa Argo CD về `Synced / Healthy`.
