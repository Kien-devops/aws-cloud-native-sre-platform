# 09.01 — Platform Smoke & Baseline Verification

> **Phạm vi:** Pre-Load Readiness Gate | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Clean Baseline Before Load:** Đảm bảo 100% thành phần hạ tầng và ứng dụng ở trạng thái ổn định (`Healthy`) trước khi bơm tải k6 hoặc thực hiện Chaos GameDay.

---

## 2. Bảng Kiểm tra Baseline

| Lớp Kiến trúc | Tài nguyên Kiểm tra | Điều kiện Đạt |
| :--- | :--- | :--- |
| **Compute** | EKS `sre-platform-dev`, System Nodes + Karpenter | `ACTIVE`, Nodes `Ready` |
| **Ingress** | Shared ALB `k8s-sreplatform-*` | 5 Target Groups `healthy` |
| **GitOps** | Argo CD `root-application`, `platform-infrastructure`, `reliability-shop*` | `Synced` & `Healthy` |
| **Data & Queue** | RDS `sre-platform-dev-pg`, Redis `sre-platform-dev-redis`, SQS | `available`, DLQ = `0` messages |

---

## 3. Chiến lược Tagging & Labels
- Đánh dấu test traffic bằng header hoặc prefix `testId` để tách biệt dữ liệu kiểm thử nếu cần.

---

## 4. Tham chiếu IaC / GitOps
- [sre/README.md](../../sre/README.md)

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
```bash
kubectl get pods -A | grep -v Running | grep -v Completed
```
- **PASS:** Không có Pod lỗi (`CrashLoopBackOff`, `Pending`, `ImagePullBackOff`).
