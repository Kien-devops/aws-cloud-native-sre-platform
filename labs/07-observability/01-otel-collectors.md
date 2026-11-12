# 07.01 — OpenTelemetry Collectors & Auto-Instrumentation

> **Phạm vi:** Unified Telemetry Pipeline | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Vendor-Neutral Instrumentation:** Thu thập đồng thời Metrics, Logs và Traces qua một pipeline OpenTelemetry thống nhất (`OTLP HTTP 4318` / `gRPC 4317`).
- **Zero Code Pollution:** Bật auto-instrumentation cho Node.js services qua biến môi trường `NODE_OPTIONS=--require /otel-auto-instrumentation/autoinstrumentation.js`.

---

## 2. Đặc tả Tài nguyên Kubernetes

| Resource / Service | Namespace | Ports / Endpoint | Tham số Cấu hình Cốt lõi |
| :--- | :--- | :--- | :--- |
| `otel-collector` | `monitoring` | `4317` (gRPC), `4318` (HTTP), `8889` (Prometheus exporter) | Receivers: `otlp`; Processors: `batch`, `memory_limiter`; Exporters: `prometheus`, `otlp/tempo`, `loki` |
| `app-config` (Env Vars) | `reliability-shop*` | `http://otel-collector.monitoring.svc.cluster.local:4318` | `OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf`, `OTEL_TRACES_EXPORTER=otlp`, `OTEL_METRICS_EXPORTER=otlp` |

---

## 3. Chiến lược Tagging & Labels

| Resource Attribute | Giá trị | Mục đích |
| :--- | :--- | :--- |
| `service.name` | `frontend` \| `order-service` \| `payment-worker` \| ... | Định danh service trên Tempo & Prometheus |
| `deployment.environment` | `dev` \| `staging` \| `prod` | Lọc telemetry theo môi trường |

---

## 4. Tham chiếu IaC / GitOps
- [02-otel-collector.yaml](../../gitops/platform/monitoring/02-otel-collector.yaml)
- [observability/opentelemetry/collectors/otel-collector.yaml](../../observability/opentelemetry/collectors/otel-collector.yaml)

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
```bash
kubectl get pods,svc -n monitoring -l app=otel-collector
```
- **PASS:** `otel-collector` trạng thái `Running`, xuất metrics `http_server_duration_milliseconds_*` tại endpoint `:8889/metrics`.
