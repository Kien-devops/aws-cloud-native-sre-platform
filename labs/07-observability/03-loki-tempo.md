# 07.03 — Loki (Logs) & Tempo (Distributed Tracing)

> **Phạm vi:** Log Centralization & Trace Correlation | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Memory-Bounded Stability:** Cấp phát limit `1536Mi` cho Loki và Tempo để tránh `OOMKilled` dưới tải cao k6.
- **Trace-to-Logs Correlation:** Mọi log JSON từ microservices đều gắn `traceId`, cho phép nhảy thẳng từ Grafana Tempo trace sang dòng log tương ứng trên Loki.

---

## 2. Đặc tả Tài nguyên Kubernetes

| Service | Namespace | Resources (Memory Limit) | Storage / Retention |
| :--- | :--- | :--- | :--- |
| `loki` | `monitoring` | Limit: `1536Mi` | EBS `gp3` PVC, Retention: `7 days` |
| `tempo` | `monitoring` | Limit: `1536Mi` | EBS `gp3` PVC, OTLP Receiver enabled |

---

## 3. Chiến lược Tagging & Labels

| Log / Trace Label | Giá trị | Mục đích |
| :--- | :--- | :--- |
| `namespace` | `reliability-shop*` | Cô lập log theo môi trường |
| `app` | `frontend` \| `order-service` \| ... | Lọc nhanh theo microservice |

---

## 4. Tham chiếu IaC / GitOps
- [03-loki-tempo.yaml](../../gitops/platform/monitoring/03-loki-tempo.yaml)
- [observability/loki/loki.yaml](../../observability/loki/loki.yaml) & [observability/tempo/tempo.yaml](../../observability/tempo/tempo.yaml)

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
```bash
kubectl get pods -n monitoring -l "app in (loki,tempo)"
```
- **PASS:** Cả `loki` và `tempo` ở trạng thái `Running`, `RESTARTS = 0`.
