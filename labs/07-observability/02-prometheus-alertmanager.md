# 07.02 — Thiết lập Prometheus, ServiceMonitors và Quy tắc Cảnh báo Tốc độ Tiêu hao Ngân sách Lỗi (Burn-Rate Alerting)

> **Trạng thái:** Hướng dẫn thực hành chi tiết cấu hình Prometheus, Alertmanager và SRE Multi-Burn-Rate Rules.  
> **Áp dụng cho:** Thu thập chỉ số RED/USE, tính toán độ tiêu hao Error Budget và định tuyến cảnh báo sự cố có độ trễ thấp.

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Triển khai **Prometheus Stack** (`kube-prometheus-stack`) thu thập metrics hạ tầng (Node Exporter, Kube State Metrics) và metrics tầng ứng dụng từ OpenTelemetry Collector.
  - Khai báo **ServiceMonitor** tự động khám phá và scrape endpoint `/metrics` của microservices.
  - Áp dụng triết lý Google SRE: Xây dựng quy tắc cảnh báo **Multi-Window, Multi-Burn-Rate** dựa trên tỷ lệ tiêu hao ngân sách lỗi (Error Budget Consumption), loại bỏ hoàn toàn các cảnh báo "rác" dựa trên ngưỡng CPU/RAM đơn thuần.
  - Cấu hình **Alertmanager** định tuyến thông báo theo mức độ nghiêm trọng (Severity: `critical` -> Page/SMS tức thời; `warning` -> Ticket/Slack).
- **Nguyên tắc SRE:**
  - **Alert on Symptoms, Not Causes:** Cảnh báo khi người dùng đang gặp lỗi (ví dụ: HTTP 5xx tăng vọt, p95 latency > 300ms), không cảnh báo chỉ vì một node CPU chạm 85%.
  - **Precision & Recall in Alerting:** Dùng cơ chế **đa cửa sổ thời gian** (Multi-Window: kết hợp cửa sổ ngắn 1 giờ và cửa sổ dài 6 giờ) để bắt được cả sự cố sập nhanh diện rộng (Fast Burn) và suy thoái chậm âm ỉ (Slow Burn).
  - **Actionable Alerts with Runbooks:** Mọi alert gửi đi bắt buộc phải có link dẫn thẳng tới Runbook xử lý tương ứng (`runbook_url`).

---

## 2. Bảng Tính Toán Tốc độ Tiêu hao Ngân sách Lỗi (Burn Rate Matrix)

*Giả định: Dịch vụ Order API cam kết mục tiêu SLO **99.9% Availability** trong cửa sổ 30 ngày (Ngân sách lỗi = 0.1%).*

| Loại Cảnh báo | Tốc độ tiêu hao (Burn Rate) | % Budget tiêu thụ | Cửa sổ Đánh giá (Short / Long) | Mức độ nghiêm trọng | Kênh xử lý |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Fast Burn** | **14.4x** | 2% trong 1 giờ | 5 phút & 1 giờ | `critical` | Paging trực tiếp kỹ sư On-call |
| **Medium Burn**| **6.0x** | 5% trong 6 giờ | 30 phút & 6 giờ | `critical` | Paging trực tiếp kỹ sư On-call |
| **Slow Burn** | **1.0x** | 10% trong 3 ngày| 2 giờ & 3 ngày | `warning` | Ticket làm việc trong giờ hành chính |

---

## 3. Các bước Khai báo Chi tiết (Manifest Walkthrough)

### Bước 1: Khai báo ServiceMonitor Scrape Metrics từ OTel Collector

Tạo file `observability/prometheus/otel-servicemonitor.yaml`:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: otel-collector-monitor
  namespace: monitoring
  labels:
    release: prometheus
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: otel-collector
  endpoints:
    - port: prometheus-metrics
      interval: 15s
      path: /metrics
```

---

### Bước 2: Khai báo Quy tắc Cảnh báo Multi-Burn-Rate (SLO Alert Rules)

Tạo file `observability/prometheus/slo-burn-rate-rules.yaml`:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: reliability-shop-slo-alerts
  namespace: monitoring
  labels:
    role: alert-rules
    release: prometheus
spec:
  groups:
    - name: order-service-slo
      rules:
        # TÍNH TOÁN SLI: TỶ LỆ LỖI TỔNG HỢP (ERROR RATE)
        - record: job:order_http_requests:error_rate5m
          expr: |
            sum(rate(http_requests_total{service="order-service", status=~"5.."}[5m]))
            /
            sum(rate(http_requests_total{service="order-service"}[5m]))

        - record: job:order_http_requests:error_rate1h
          expr: |
            sum(rate(http_requests_total{service="order-service", status=~"5.."}[1h]))
            /
            sum(rate(http_requests_total{service="order-service"}[1h]))

        # CẢNH BÁO 1: FAST BURN RATE (Burn Rate 14.4x - Tiêu hao 2% ngân sách lỗi trong 1h)
        - alert: OrderServiceFastBurnRate
          expr: |
            (
              job:order_http_requests:error_rate5m > (14.4 * 0.001)
              and
              job:order_http_requests:error_rate1h > (14.4 * 0.001)
            )
          for: 2m
          labels:
            severity: critical
            team: sre-oncall
            service: order-service
          annotations:
            summary: "Order Service is burning error budget at 14.4x rate"
            description: "High error rate ({{ $value | humanizePercentage }}) detected. At this burn rate, 2% of the monthly error budget will be consumed in 1 hour."
            runbook_url: "https://github.com/my-org/aws-cloud-native-sre-platform/blob/main/sre/runbooks/high-error-rate.md"

        # CẢNH BÁO 2: MEDIUM BURN RATE (Burn Rate 6x - Tiêu hao 5% ngân sách trong 6h)
        - alert: OrderServiceMediumBurnRate
          expr: |
            (
              sum(rate(http_requests_total{service="order-service", status=~"5.."}[30m])) / sum(rate(http_requests_total{service="order-service"}[30m])) > (6 * 0.001)
              and
              sum(rate(http_requests_total{service="order-service", status=~"5.."}[6h])) / sum(rate(http_requests_total{service="order-service"}[6h])) > (6 * 0.001)
            )
          for: 15m
          labels:
            severity: critical
            team: sre-oncall
            service: order-service
          annotations:
            summary: "Order Service is burning error budget at 6x rate"
            description: "Persistent error degradation detected over the last 6 hours."
            runbook_url: "https://github.com/my-org/aws-cloud-native-sre-platform/blob/main/sre/runbooks/high-error-rate.md"
```

---

### Bước 3: Cấu hình Alertmanager Routing và Inhibition Rules

Tạo file `observability/alertmanager/alertmanager-config.yaml`:

```yaml
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname', 'service', 'severity']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: 'slack-notifications'
  routes:
    # ĐỊNH TUYẾN SỰ CỐ KHẨN CẤP (SEVERITY CRITICAL -> PAGERDUTY / ON-CALL)
    - match:
        severity: critical
      receiver: 'pagerduty-critical'
      continue: true

receivers:
  - name: 'slack-notifications'
    slack_configs:
      - channel: '#sre-platform-alerts'
        send_resolved: true
        title: '{{ template "slack.default.title" . }}'
        text: '{{ template "slack.default.text" . }}'

  - name: 'pagerduty-critical'
    pagerduty_configs:
      - service_key: 'dummy-test-key'
        severity: 'critical'

inhibit_rules:
  # NẾU TOÀN BỘ NODE ĐÃ CHẾT, ẨN CÁC CẢNH BÁO VỀ POD CRASH ĐỂ TRÁNH ALERT STORM
  - source_match:
      alertname: 'NodeDown'
    target_match:
      alertname: 'PodCrashLooping'
    equal: ['node']
```

---

## 4. Xác minh Thực tế từ Terminal (Verification)

```bash
# 1. Kiểm tra trạng thái Prometheus Operator và Alertmanager
kubectl get pods -n monitoring -l "app.kubernetes.io/name in (prometheus,alertmanager)"

# 2. Truy cập Prometheus Web UI qua Port-Forward
kubectl port-forward svc/prometheus-k8s -n monitoring 9090:9090
```

1. Mở trình duyệt tại `http://localhost:9090`.
2. Kiểm tra menu **Status** -> **Targets**:
   - Tìm kiếm `otel-collector-monitor`: Xác nhận endpoint `8889` hiển thị **State: UP** (Màu xanh).
3. Kiểm tra menu **Alerts**:
   - Xác nhận quy tắc `OrderServiceFastBurnRate` và `OrderServiceMediumBurnRate` đang ở trạng thái **Inactive** (Màu xanh - hệ thống đang khỏe mạnh).

---

## 5. Thử nghiệm Bắn Cảnh báo Giả lập (Alert Simulation)

Kiểm tra xem Alertmanager có tiếp nhận và phân loại đúng alert hay không bằng cách kích hoạt một alert giả lập qua API:

```bash
curl -X POST http://localhost:9093/api/v2/alerts \
  -H "Content-Type: application/json" \
  -d '[{
    "labels": {
      "alertname": "SimulatedOutageAlert",
      "service": "order-service",
      "severity": "critical"
    },
    "annotations": {
      "summary": "This is a simulated critical outage test",
      "runbook_url": "https://example.com/runbook"
    }
  }]'
```

Kiểm tra Alertmanager UI tại `http://localhost:9093`: Alert xuất hiện ngay lập tức trong bảng điều khiển và được gán nhãn `critical`.

---

## 6. Điều kiện hoàn thành Gate (Gate Check)

- [ ] Prometheus đang scrape thành công metrics từ OpenTelemetry Collector (Target UP).
- [ ] Quy tắc cảnh báo Multi-Burn-Rate được nạp đầy đủ vào bộ nhớ của Prometheus.
- [ ] Alertmanager đang chạy và định tuyến cảnh báo theo đúng nhãn `severity`.
- [ ] Cảnh báo chứa đầy đủ thông tin mô tả và liên kết tới tài liệu hướng dẫn xử lý (Runbook).

---

## 7. Dọn dẹp tài nguyên (Cleanup)

- Giữ nguyên stack giám sát để phục vụ việc xây dựng Dashboard ở bài 07.04 và kiểm thử k6 ở Module 09.
