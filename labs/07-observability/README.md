# Module 07: SRE Observability & Tri-Signal Telemetry

**Theo dõi một giao dịch bằng metrics, logs và traces liên quan.**

[Labs](../README.md) / Module 07 · [Trước: GitOps](../06-gitops-application/README.md) · [Tiếp: Delivery & Scaling](../08-delivery-scaling/README.md)

## 1. Tổng quan Module

Module 07 xây dựng hệ thống quan sát hiện đại (Observability Stack) tích hợp 3 trụ cột tín hiệu đo lường (**Metrics, Logs, Traces - Tri-Signal Telemetry**) theo tiêu chuẩn OpenTelemetry và Google SRE:
- **OpenTelemetry (OTel) Collectors:** Thu thập, làm giàu (enrich), che giấu thông tin nhạy cảm (PII redaction) và phân phối telemetry từ ứng dụng tới các backend chuyên dụng.
- **Prometheus & Alertmanager:** Giám sát các chỉ số hạ tầng và ứng dụng, áp dụng triết lý cảnh báo nâng cao của Google SRE: **Multi-Window Multi-Burn-Rate Alerts** (14.4x trong 1 giờ, 6x trong 6 giờ) thay cho các ngưỡng cảnh báo tĩnh thông thường.
- **Grafana Loki & Tempo:** Hệ thống lưu trữ và truy vấn tập trung cho Structured Logs (Loki với nhãn `trace_id`) và Distributed Traces (Tempo hỗ trợ TraceQL).
- **Dashboards as Code (DaC):** Tự động hóa triển khai các bảng điều khiển Grafana phản ánh chính xác các tín hiệu vàng (Golden Signals: Latency, Traffic, Errors, Saturation) và đồng hồ đo tốc độ tiêu hao ngân sách lỗi (SLO Error Budget Gauges).
- **Tri-Signal Correlation Drill:** Thực hành diễn tập đối soát 1 giao dịch đơn lẻ xuyên suốt từ Span Tracing sang Log liên quan và phản ánh trên biểu đồ Metrics.

---

## 2. Danh mục bài Lab chi tiết

| Bài Lab | Tiêu đề | Trọng tâm kỹ thuật | Console / CLI Path |
| :--- | :--- | :--- | :--- |
| [07.01](01-otel-collectors.md) | OpenTelemetry | Receivers, processors, exporters | `gitops/platform/monitoring/` |
| [07.02](02-prometheus-alertmanager.md) | Prometheus & Alertmanager | Scrape, rules và burn rate | Prometheus / Alertmanager |
| [07.03](03-loki-tempo.md) | Loki & Tempo | LogQL, TraceQL và correlation | `gitops/platform/monitoring/` |
| [07.04](04-grafana-dashboards.md) | Dashboards as Code | Golden Signals và budget | Grafana / Git |
| [07.05](05-observability-checkpoint.md) | Correlation Drill | Metric, trace, log và root cause | Grafana Explore |
| [07.06](06-console-observability.md) | AWS telemetry | Alarms, DLQ và replay runbook | CloudWatch |

---

## 3. Tiêu chí hoàn thành Module (Exit Gate)

- [ ] OTel Collector DaemonSet/Deployment chạy ổn định, không bị OOMKilled nhờ có `memory_limiter`.
- [ ] Prometheus cào chỉ số thành công từ toàn bộ pod `reliability-shop` với chu kỳ scrape 15s.
- [ ] Các quy tắc cảnh báo Multi-burn-rate (14.4x và 6x) được nạp vào Prometheus Rules không có lỗi cú pháp.
- [ ] Loki thu thập đầy đủ JSON structured logs từ stdout của containers.
- [ ] Tempo ghi nhận trace graph hoàn chỉnh thể hiện lời gọi từ `order-service` -> `inventory-service` -> `PostgreSQL` / `Redis`.
- [ ] Bài diễn tập Tri-Signal chứng minh tìm ra nguyên nhân gốc rễ sự cố trong vòng dưới 2 phút nhờ liên kết dữ liệu trực tiếp.
