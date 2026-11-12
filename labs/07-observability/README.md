# Module 07 — Full-Stack Observability & Telemetry

> **Phạm vi:** OpenTelemetry, Prometheus, Loki, Tempo, Grafana & CloudWatch | **Region:** `ap-southeast-1`

Module 07 đặc tả hệ thống giám sát 3 trụ cột (Metrics, Logs, Traces) hợp nhất qua chuẩn OpenTelemetry và cảnh báo hạ tầng AWS CloudWatch.

---

## Danh sách Đặc tả

| Mã | Tài liệu | Nội dung Chính |
| :--- | :--- | :--- |
| `07.01` | [OpenTelemetry Collectors](01-otel-collectors.md) | OTel Collector (`monitoring`), OTLP HTTP/gRPC endpoints & Auto-instrumentation |
| `07.02` | [Prometheus & Alertmanager](02-prometheus-alertmanager.md) | Scrape Targets, Multi-window Multi-burn-rate SLO Alert Rules |
| `07.03` | [Loki & Tempo](03-loki-tempo.md) | Log Aggregation (Loki) & Distributed Tracing (Tempo), Memory Limit `1536Mi` |
| `07.04` | [Grafana Dashboards](04-grafana-dashboards.md) | Golden Signals & Error Budget Dashboards, ESO Admin Credentials |
| `07.05` | [Observability Checkpoint](05-observability-checkpoint.md) | Kiểm chứng tương quan Metrics <-> Logs <-> Traces qua `traceId` |
| `07.06` | [AWS CloudWatch & DLQ Alarms](06-console-observability.md) | CloudWatch Foundation Dashboard & SQS DLQ Alarm (`> 0` messages) |
