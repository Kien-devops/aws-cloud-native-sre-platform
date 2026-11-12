# 07.02 — Prometheus & Multi-Burn-Rate Alerting

> **Phạm vi:** Metrics Storage & SLO Alerting | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Symptom-Based Alerting:** Cảnh báo dựa trên tốc độ đốt Error Budget (Multi-window Multi-burn-rate) và tỷ lệ lỗi HTTP 5xx thay vì cảnh báo nhiễu theo CPU spike đơn lẻ.
- **Persistent Metrics:** Lưu trữ dữ liệu Prometheus trên EBS `gp3` PVC.

---

## 2. Đặc tả Alert Rules & Scrape Targets

| Rule / Resource | Namespace | Ngưỡng Cảnh báo (Thresholds) | Mức độ |
| :--- | :--- | :--- | :--- |
| `HighErrorBudgetBurn` | `monitoring` | Burn rate `> 14.4x` (5m/1h) hoặc `> 6x` (30m/6h) | `critical` (Page immediately) |
| `ServiceHigh5xxRate` | `monitoring` | `5xx / total > 1%` trong 5 phút liên tục | `critical` |
| `OrderServiceHighLatency` | `monitoring` | `P95 latency > 500ms` | `warning` |
| `SQSDLQMessagesVisible` | `monitoring` | `ApproximateNumberOfMessagesVisible > 0` | `critical` |

---

## 3. Chiến lược Tagging & Labels

| Alert Label | Giá trị | Mục đích |
| :--- | :--- | :--- |
| `severity` | `critical` \| `warning` | Phân tuyến cảnh báo Alertmanager |
| `slo` | `availability` \| `latency` | Gắn kết với bảng chính sách SLO |

---

## 4. Tham chiếu IaC / GitOps
- [07-prometheus-rules.yaml](../../gitops/platform/monitoring/07-prometheus-rules.yaml)
- [sre/alerts/slo-recording-and-alerts.yaml](../../sre/alerts/slo-recording-and-alerts.yaml)

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
```bash
kubectl get prometheusrules -n monitoring
```
- **PASS:** Toàn bộ scrape targets `UP`, recording rules & alert rules load thành công không có lỗi syntax PromQL.
