# 07.05 — Kiểm chứng Tương quan Telemetry Toàn trình (Observability Checkpoint Gate)

> **Trạng thái:** Hướng dẫn thực hành diễn tập chẩn đoán đa chiều (Tri-Signal Correlation Drill).  
> **Áp dụng cho:** Nghiệm thu Gate Phase 07; chứng minh khả năng liên kết Metrics, Logs và Traces cho cùng một giao dịch người dùng thật.

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Thực hiện kịch bản kiểm tra toàn diện (**End-to-End Correlation Drill**): Phát sinh một giao dịch đơn hàng qua ALB, lấy `trace_id` từ response header, và chứng minh dữ liệu xuất hiện đồng bộ trên cả 3 trụ cột Observability:
    1. **Metrics:** Chỉ số `http_requests_total` tăng lên trên Prometheus và phản ánh ngay vào Grafana SLO Dashboard.
    2. **Traces:** Sơ đồ thác nước (Waterfall Graph) trên Grafana Tempo hiển thị đầy đủ các chặng: `Ingress ALB` -> `order-service` -> `PostgreSQL query` -> `SQS Publish` -> `payment-worker`.
    3. **Logs:** Grafana Loki hiển thị chính xác các dòng log sinh ra bởi cả hai dịch vụ kèm nhãn metadata chuẩn và không chứa bất kỳ secret/password nào.
  - Đo đạc độ trễ phân tán (Span Durations) và đánh giá độ chính xác của ngữ cảnh truy vết.
- **Nguyên tắc SRE:**
  - **The Three Pillars Must Converge (Ba trụ cột phải hội tụ):** Một hệ thống có metrics riêng, logs riêng, traces riêng nhưng không liên kết được với nhau bằng `trace_id` chỉ tạo ra sự quá tải thông tin (Cognitive Overload) trong lúc xử lý sự cố.
  - **Zero Telemetry Loss:** Tỷ lệ nhận diện trace và log cho các request hợp lệ phải đạt xấp xỉ 100% trong điều kiện tải bình thường.
  - **Sanitization Audit:** Kiểm tra ngẫu nhiên các bản ghi log để đảm bảo bộ lọc Redaction của OpenTelemetry Collector hoạt động đúng, không để lọt dữ liệu nhạy cảm.

---

## 2. Kịch bản Diễn tập Thực nghiệm (Step-by-Step Drill)

### Bước 1: Gửi Giao dịch Kiểm thử và Thu thập `trace_id`

Chạy lệnh gửi đơn hàng có yêu cầu in header chi tiết từ terminal:

```bash
curl -Iv -X POST https://shop.dev.sreplatform.yourdomain.com/api/v1/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "cust-sre-audit",
    "item_id": "item-macbook-pro",
    "quantity": 1,
    "price": 2500.00
  }'
```

Quan sát HTTP Response Headers:
- Ghi nhận mã trạng thái: `HTTP/2 201 Created`.
- Tìm header chứa Trace Context:
  `x-trace-id: 4bf92f3577b34da6a3ce929d0e0e4736` (hoặc `traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01`).
- Sao chép giá trị Trace ID: `4bf92f3577b34da6a3ce929d0e0e4736`.

---

### Bước 2: Kiểm tra Trụ cột 1 — Metrics trên Prometheus

Mở giao diện Prometheus (`http://localhost:9090`):
1. Chạy câu lệnh PromQL:
   ```sql
   increase(http_requests_total{service="order-service", status="201"}[2m])
   ```
2. **Xác nhận:** Giá trị trả về `>= 1` (chứng minh metric đã được OpenTelemetry SDK ghi nhận và Prometheus đã scrape thành công).

---

### Bước 3: Kiểm tra Trụ cột 2 — Traces trên Grafana Tempo

1. Mở Grafana (`http://localhost:3000`) -> Menu **Explore** -> Chọn datasource **Tempo**.
2. Chọn tab **TraceQL** hoặc chuyển sang chế độ tìm kiếm theo ID.
3. Dán `4bf92f3577b34da6a3ce929d0e0e4736` vào ô **Trace ID** -> Nhấn Enter.
4. **Xác nhận Sơ đồ Thác nước (Trace Waterfall):**
   - Root Span: `POST /api/v1/orders` (thời gian: ~25ms).
   - Child Span 1: `SELECT FROM inventory` (thời gian: ~3ms).
   - Child Span 2: `INSERT INTO orders` (thời gian: ~8ms).
   - Child Span 3: `SQS.SendMessage` (thời gian: ~5ms).
   - Child Span 4: `payment-worker.ConsumeMessage` (xử lý bất đồng bộ, thời gian: ~12ms).
5. Toàn bộ hành trình của request được hiển thị liên tục mà không bị đứt quãng giữa HTTP và SQS.

---

### Bước 4: Kiểm tra Trụ cột 3 — Logs Tương quan trên Grafana Loki

1. Từ màn hình Trace Waterfall trên Tempo, nhấp vào span `POST /api/v1/orders`.
2. Nhấp nút **Loki logs**:
   - Khung xem Log của Loki tự động mở ra với câu truy vấn:
     `{service="order-service"} |= "4bf92f3577b34da6a3ce929d0e0e4736"`
3. **Xác nhận nội dung Log:**
   ```json
   {
     "timestamp": "2026-10-21T02:30:15.123Z",
     "level": "INFO",
     "service": "order-service",
     "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
     "message": "Order created successfully. Database committed with ID ORD-2026-X8Y9Z0",
     "customer_id": "cust-sre-audit"
   }
   ```
4. **Kiểm tra An toàn Dữ liệu:** Không có mật khẩu database hay auth token nào bị in ra log.

---

## 3. Bảng Điểm Đánh giá Trưởng thành Observability (Maturity Scorecard)

| Tiêu chuẩn Đánh giá | Trạng thái Nghiệm thu | Bằng chứng |
| :--- | :--- | :--- |
| **Metrics Collection** | **ĐẠT (Level 4)** | Scrape tự động qua ServiceMonitors, nhãn chuẩn hóa |
| **SLO & Burn Rate Alerting** | **ĐẠT (Level 4)** | Multi-window, multi-burn-rate rules nạp thành công |
| **Distributed Tracing** | **ĐẠT (Level 4)** | Trace xuyên suốt API -> Database -> SQS -> Worker |
| **Centralized Logging** | **ĐẠT (Level 4)** | Structured JSON logs có `trace_id` trong Loki |
| **Trace-to-Log Linkage** | **ĐẠT (Level 5)** | Nhảy trực tiếp từ Tempo span sang Loki logs |
| **Data Redaction** | **ĐẠT (Level 5)** | Không lộ secret/PII trong telemetry pipelines |

---

## 4. Điều kiện hoàn thành Gate (Gate Check)

- [ ] Một request thật được truy vết trọn vẹn qua cả 3 hệ thống Metrics, Traces, và Logs.
- [ ] Tính năng Trace-to-Log Correlation hoạt động hoàn hảo trên Grafana UI.
- [ ] Không có dữ liệu nhạy cảm rò rỉ trong log storage.
- [ ] Nền tảng chính thức đạt tiêu chuẩn Observability và sẵn sàng bước sang Module 08 (Delivery & Scaling).
