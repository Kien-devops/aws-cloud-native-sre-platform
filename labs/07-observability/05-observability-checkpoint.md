# 07.05 — Observability End-to-End Checkpoint

> **Phạm vi:** Telemetry Correlation Gate | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Three Pillars Correlation:** Kiểm chứng một transaction tạo đơn hàng thực tế có thể truy vết liền mạch giữa **Metric (Prometheus)** -> **Trace Span (Tempo)** -> **JSON Log (Loki)**.

---

## 2. Bảng Kiểm chứng Checkpoint

| Trụ cột | Nguồn Dữ liệu | Điều kiện Xác minh |
| :--- | :--- | :--- |
| **Metrics** | Prometheus | Ghi nhận `http_server_duration_milliseconds_count` tăng theo traffic thật |
| **Traces** | Tempo | Hiển thị full waterfall span: `frontend -> order-service -> pg.query -> sqs.send` |
| **Logs** | Loki | Log của `order-service` và `payment-worker` khớp chung một `traceId` |

---

## 3. Chiến lược Tagging & Labels
- Đảm bảo nhãn `service_name` và `namespace` đồng nhất trên cả Prometheus, Loki và Tempo.

---

## 4. Tham chiếu IaC / GitOps
- [observability/README.md](../../observability/README.md)

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
- **PASS:** Mở một trace bất kỳ trong Grafana Explore -> Click `Logs for this span` -> Hiển thị ngay log chi tiết của request đó.
