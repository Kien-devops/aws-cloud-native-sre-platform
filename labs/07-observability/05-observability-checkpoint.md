# 07.05 — Kiểm chứng Tương quan Telemetry Toàn trình (Observability Checkpoint Gate)

> **Trạng thái:** Đã diễn tập và nghiệm thu thành công trên EKS Cluster (GATE VERIFIED & COMPLETED).<br>
> **Áp dụng cho:** Nghiệm thu Gate Phase 07; chứng minh khả năng liên kết Metrics, Logs và Traces cho cùng một giao dịch người dùng thật.

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Thực hiện kịch bản kiểm tra toàn diện (**End-to-End Correlation Drill**): Phát sinh một giao dịch đơn hàng thật qua ALB Ingress (`shop.dev.devopsss.site`), truyền Trace Context (`Traceparent`, `X-Correlation-Id`, `Idempotency-Key`), và chứng minh dữ liệu xuất hiện đồng bộ trên cả 3 trụ cột Observability:
    1. **Metrics:** Chỉ số `http_requests_total` và `up` được Prometheus scrape tự động từ OTel Collector, phản ánh ngay vào Grafana SLO Dashboard.
    2. **Traces:** Grafana Tempo tiếp nhận spans từ OTel Collector trên cổng gRPC 4317, thể hiện luồng giao dịch qua các chặng: `Ingress ALB` -> `Frontend` -> `order-service` -> `PostgreSQL RDS` -> `Amazon SQS` -> `payment-worker`.
    3. **Logs:** Grafana Loki lưu trữ structured logs dạng JSON, lập chỉ mục nhãn `service_name` và liên kết trực tiếp với Trace ID mà không để lộ mật khẩu/secrets.
  - Đánh giá khả năng tự động hóa và độ ổn định của toàn bộ stack giám sát trước khi chuyển sang Module 08.
- **Nguyên tắc SRE:**
  - **The Three Pillars Must Converge (Ba trụ cột phải hội tụ):** Một hệ thống có metrics riêng, logs riêng, traces riêng nhưng không liên kết được với nhau bằng `trace_id` chỉ tạo ra sự quá tải thông tin (Cognitive Overload) trong lúc xử lý sự cố.
  - **Zero Telemetry Loss:** Tỷ lệ nhận diện trace và log cho các request hợp lệ phải đạt xấp xỉ 100% trong điều kiện tải bình thường.
  - **Sanitization Audit:** Kiểm tra ngẫu nhiên các bản ghi log để đảm bảo bộ lọc Redaction của OpenTelemetry Collector hoạt động đúng, không để lọt dữ liệu nhạy cảm.

---

## 2. Kịch bản Diễn tập Thực nghiệm (Step-by-Step Drill)

### Bước 1: Gửi Giao dịch Đơn hàng thật kèm Trace Context

Gửi một đơn hàng kiểm thử có gắn `Traceparent`, `X-Correlation-Id` và `Idempotency-Key` tới API `https://shop.dev.devopsss.site/api/orders`:

```bash
curl -i -X POST https://shop.dev.devopsss.site/api/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: sre-audit-gate-checkpoint-001" \
  -H "Traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01" \
  -H "X-Correlation-Id: 4bf92f3577b34da6a3ce929d0e0e4736" \
  -d '{
    "item": "SRE Observability Drill",
    "quantity": 1,
    "amount": 99,
    "customer": "SRE Gate Auditor"
  }'
```

**Kết quả phản hồi thực tế từ API:**

```json
HTTP/1.1 200 OK
Content-Type: application/json
Connection: keep-alive

{
  "success": true,
  "duplicate": false,
  "order": {
    "id": "ord-dace6258-1316-4cb2-84b5-77357c92236b",
    "item": "SRE Observability Drill",
    "quantity": 1,
    "amount": 99,
    "customer": "SRE Gate Auditor",
    "status": "PENDING_PAYMENT",
    "createdAt": "2026-11-03T20:26:30.753Z",
    "eventId": "4b4c06f3-c3c8-4213-a14b-d1e289f9e182",
    "eventStatus": "PENDING"
  },
  "storage": "POSTGRESQL_RDS",
  "outbox": {
    "eventId": "4b4c06f3-c3c8-4213-a14b-d1e289f9e182",
    "status": "PENDING"
  }
}
```

Kiểm tra trạng thái hoàn tất thanh toán sau 150ms:

```bash
curl -s https://shop.dev.devopsss.site/api/orders | jq '.orders[] | select(.id=="ord-dace6258-1316-4cb2-84b5-77357c92236b")'
```

```json
{
  "id": "ord-dace6258-1316-4cb2-84b5-77357c92236b",
  "item": "SRE Observability Drill",
  "quantity": 1,
  "amount": 99,
  "customer": "SRE Gate Auditor",
  "status": "PAID",
  "createdAt": "2026-11-03T20:26:30.753Z",
  "eventId": "4b4c06f3-c3c8-4213-a14b-d1e289f9e182",
  "eventStatus": "PUBLISHED",
  "eventPublishedAt": "2026-11-03T20:26:30.760Z",
  "paymentProcessedAt": "2026-11-03T20:26:30.907Z"
}
```

*Ghi nhận:* Giao dịch chuyển từ `PENDING_PAYMENT` sang `PAID` hoàn tất sau **154ms** qua chu trình: `order-service` -> `PostgreSQL RDS` -> `Outbox SQS` -> `payment-worker`.

---

### Bước 2: Kiểm tra Trụ cột 1 — Metrics trên Prometheus

Kiểm tra các targets đang được Prometheus scrape tự động:

```bash
kubectl run prom-check --rm -i --tty --image=curlimages/curl --restart=Never -- \
  curl -s "http://prometheus-kube-prometheus-prometheus.monitoring.svc.cluster.local:9090/api/v1/query?query=up" | grep -o '"job":"[^"]*"' | sort -u
```

**Kết quả xác nhận:**
- `"job":"otel-collector"` (Scrape port 8889)
- `"job":"kube-state-metrics"`
- `"job":"node-exporter"`
- `"job":"prometheus-kube-prometheus-alertmanager"`
- `"job":"prometheus-kube-prometheus-operator"`
- `"job":"prometheus-kube-prometheus-prometheus"`

---

### Bước 3: Kiểm tra Trụ cột 2 — Traces trên Grafana Tempo

1. Truy cập Grafana Web UI: **`https://grafana.dev.devopsss.site`**
2. Vào menu **Explore** -> chọn datasource **Tempo**.
3. Tra cứu Trace ID: `4bf92f3577b34da6a3ce929d0e0e4736`.
4. **Xác nhận Sơ đồ Thác nước (Trace Waterfall):**
   - Root Span: `POST /api/orders`
   - Child Span 1: `order-service: db.insert_order` (RDS PostgreSQL)
   - Child Span 2: `order-service: sqs.publish_event` (Amazon SQS)
   - Child Span 3: `payment-worker: sqs.consume_message` (Xử lý thanh toán bất đồng bộ)
   - Toàn bộ hành trình không bị đứt đoạn giữa HTTP và SQS message nhờ W3C Trace Context propagation.

---

### Bước 4: Kiểm tra Trụ cột 3 — Logs Tương quan trên Grafana Loki

1. Kiểm tra nhãn metadata của Loki:
   ```bash
   kubectl run loki-check --rm -i --tty --image=curlimages/curl --restart=Never -- \
     curl -s http://loki-gateway.monitoring.svc.cluster.local/loki/api/v1/labels
   ```
   *Kết quả:* `{"status":"success","data":["service_name"]}`

2. Trong Grafana Explore (Loki):
   Truy vấn LogQL:
   ```sql
   {service_name="order-service"} |= "ord-dace6258-1316-4cb2-84b5-77357c92236b"
   ```
3. Xem log xử lý từ `payment-worker`:
   ```text
   [2026-11-03T20:26:30.917Z] payment committed for order ord-dace6258-1316-4cb2-84b5-77357c92236b
   ```
4. **Kiểm tra An toàn Dữ liệu (Sanitization Audit):** Các token nhạy cảm (`Bearer ***`, `password=***`) đều được OTel Collector processor `transform` thay thế bằng `[REDACTED]`.

---

## 3. Bảng Điểm Đánh giá Trưởng thành Observability (Maturity Scorecard)

| Tiêu chuẩn Đánh giá | Trạng thái Nghiệm thu | Bằng chứng Thực tế |
| :--- | :--- | :--- |
| **Metrics Collection** | **ĐẠT (Level 4)** | Scrape tự động qua ServiceMonitors (`otel-collector`, `node-exporter`) |
| **SLO & Burn Rate Alerting** | **ĐẠT (Level 4)** | Multi-window, multi-burn-rate rules (14.4x 1h, 6.0x 6h) nạp thành công |
| **Distributed Tracing** | **ĐẠT (Level 4)** | Tempo tiếp nhận OTLP spans qua cổng 4317, Trace ID đồng bộ qua SQS |
| **Centralized Logging** | **ĐẠT (Level 4)** | Loki 3.0 lưu trữ logs nhãn `service_name`, truy vấn LogQL độ trễ thấp |
| **Trace-to-Log Linkage** | **ĐẠT (Level 5)** | Derived Fields trong Grafana tự động nhảy giữa Tempo và Loki |
| **Single Pane of Glass** | **ĐẠT (Level 5)** | Grafana Server public HTTPS tại `grafana.dev.devopsss.site` qua shared ALB |
| **Data Redaction** | **ĐẠT (Level 5)** | Không lộ secret/PII trong telemetry pipelines |

---

## 4. Điều kiện hoàn thành Gate (SRE Gate Check)

- [x] Một request thật được truy vết trọn vẹn qua cả 3 hệ thống Metrics, Traces, và Logs.
- [x] Tính năng Trace-to-Log Correlation hoạt động hoàn hảo trên Grafana UI (`grafana.dev.devopsss.site`).
- [x] Không có dữ liệu nhạy cảm rò rỉ trong log storage.
- [x] Nền tảng chính thức đạt tiêu chuẩn Observability và sẵn sàng bước sang Module 08 (Delivery & Scaling).

---

## 5. Tổng kết Module 07

Toàn bộ 5 bài lab của **Module 07 (Observability Platform)** đã hoàn thành và kiểm chứng thành công trên cluster:
1. `07.01` — OpenTelemetry Collector Pipeline (DaemonSet / Deployment OTLP Ingestion).
2. `07.02` — Prometheus, ServiceMonitors & Multi-Burn-Rate Alerting Rules.
3. `07.03` — Grafana Loki & Tempo Centralized Telemetry Backends.
4. `07.04` — Grafana Dashboards as Code (Golden Signals & Error Budget).
5. `07.05` — Observability Checkpoint Gate (Tri-Signal Correlation Drill).
