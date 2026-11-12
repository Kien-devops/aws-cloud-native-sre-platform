# 09.04 — Pod Resilience & PodDisruptionBudget (PDB)

> **Phạm vi:** High Availability During Voluntary/Involuntary Disruptions | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Zero-Downtime Node Drain:** Bảo vệ tối thiểu 1 replica đang phục vụ (`minAvailable: 1`) khi Karpenter consolidate node hoặc khi EKS nâng cấp node group.
- **Anti-Affinity & Multi-AZ Spread:** Các replicas của `frontend`, `order-service`, `payment-worker` phân bổ đều qua `ap-southeast-1a` và `ap-southeast-1b`.

---

## 2. Đặc tả Tài nguyên Resilience

| Resource | Target Workload | Tham số Cấu hình Cốt lõi |
| :--- | :--- | :--- |
| **PodDisruptionBudget** | `frontend`, `order-service`, `auth-service`, `inventory-service`, `payment-worker` | `minAvailable: 1` (với `replicas >= 2`) |
| **Liveness & Readiness Probes** | Toàn bộ 5 services | HTTP `/health`, `initialDelaySeconds`, `periodSeconds` |
| **Graceful Shutdown** | Node.js services | Xử lý `SIGTERM`, đóng DB/Redis/SQS connection trước khi exit |

---

## 3. Chiến lược Tagging & Labels
- `topology.kubernetes.io/zone` phân bổ Pods trên cả `1a` và `1b`.

---

## 4. Tham chiếu IaC / GitOps
- [chaos/README.md](../../chaos/README.md)

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
```bash
kubectl get pdb -n reliability-shop
```
- **PASS:** Khi xóa đột ngột 1 Pod hoặc drain 1 Node dưới tải k6, `ALLOWED DISRUPTIONS` đảm bảo không làm gián đoạn toàn bộ service, `5xx = 0.00%`.
