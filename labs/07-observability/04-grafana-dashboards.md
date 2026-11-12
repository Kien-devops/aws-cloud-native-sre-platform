# 07.04 — Grafana Dashboards & ESO Secret Integration

> **Phạm vi:** SRE Visualization | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **GitOps-Provisioned Dashboards:** Datasources (Prometheus, Loki, Tempo) và Dashboards (Golden Signals, Error Budget) được khai báo qua ConfigMap, tự động nạp khi Grafana khởi động.
- **Single Replica + PVC Session Stability:** Giữ `replicas: 1` với PVC (hoặc shared session store) để tránh lỗi drop session trên Shared ALB; mật khẩu admin quản lý qua AWS Secrets Manager.

---

## 2. Đặc tả Tài nguyên Kubernetes

| Resource | Namespace | Host / Port | Tham số Cấu hình Cốt lõi |
| :--- | :--- | :--- | :--- |
| `grafana` | `monitoring` | `https://grafana.devopsss.site` (`:3000`) | `replicas: 1`, `ExternalSecret`: `/sre-platform/dev/grafana/admin` |
| `golden-signals.json` | `monitoring` | Dashboard Provisioner | 4 Golden Signals: Latency (P50/P95/P99), Traffic (RPS), Errors (5xx), Saturation |
| `slo-error-budget.json` | `monitoring` | Dashboard Provisioner | Availability SLI (`99.9%` target) & Error Budget Remaining |

---

## 3. Chiến lược Tagging & Labels

| Label Key | Label Value | Mục đích |
| :--- | :--- | :--- |
| `grafana_dashboard` | `"1"` | Grafana sidecar tự động nhận diện và import ConfigMap thành Dashboard |

---

## 4. Tham chiếu IaC / GitOps
- [04-grafana-dashboards.yaml](../../gitops/platform/monitoring/04-grafana-dashboards.yaml)
- [05-grafana-core.yaml](../../gitops/platform/monitoring/05-grafana-core.yaml)
- [06-grafana-ingress.yaml](../../gitops/platform/monitoring/06-grafana-ingress.yaml)

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
- **PASS:** Truy cập `https://grafana.devopsss.site` thành công, dữ liệu hiển thị đầy đủ trên cả 3 datasources (Prometheus, Loki, Tempo).
