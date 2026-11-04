# Prometheus và chiến lược cảnh báo

## 1. Luồng metric

~~~text
Pod / AWS exporter -> ServiceMonitor -> Prometheus -> rules -> Alertmanager -> on-call
                                            |
                                            +-> Grafana
~~~

Prometheus pull metric; Alertmanager grouping, inhibition và routing; Grafana quan sát, không thay thế alert.

## 2. Quy ước metric

- Counter: `http_server_requests_seconds_count`, `orders_total`.
- Histogram: `http_server_requests_seconds_bucket`.
- Gauge: `queue_depth`, `db_connections_active`.
- Label ổn định: `service`, `route`, `method`, `status_code`, `environment`.
- Không dùng `user_id`, `trace_id`, `order_id` làm label.

~~~yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: order-service
  namespace: monitoring
spec:
  namespaceSelector:
    matchNames: [reliability-shop]
  selector:
    matchLabels:
      app.kubernetes.io/name: order-service
  endpoints:
    - port: metrics
      path: /metrics
      interval: 30s
~~~

## 3. Alert theo triệu chứng người dùng

~~~yaml
groups:
  - name: reliabilityshop
    rules:
      - alert: OrderServiceHighErrorRate
        expr: |
          sum(rate(http_server_requests_seconds_count{service="order",status_code=~"5.."}[5m]))
          /
          sum(rate(http_server_requests_seconds_count{service="order"}[5m])) > 0.02
        for: 10m
        labels:
          severity: page
          service: order
        annotations:
          summary: "Order Service có tỷ lệ lỗi 5xx cao"
          runbook_url: "https://example.invalid/runbooks/order-high-error-rate"
~~~

CPU cao chỉ page khi có tác động hoặc nguy cơ cạn tài nguyên. Dùng inhibition để chặn alert con khi dependency chung đã lỗi.

## 4. Xác minh

~~~bash
promtool check rules prometheus-rules.yaml
promtool test rules prometheus-rules.test.yaml
kubectl -n monitoring get prometheusrules,servicemonitors
~~~

| Kết quả | Nội dung |
| --- | --- |
| **Expected** | Target UP; alert Pending rồi Firing sau `for`; route đúng receiver; tự resolve. |
| **Measured** | Chưa đo. Lưu output promtool, target status, timeline và notification ID đã ẩn dữ liệu nhạy cảm. |

## 5. Troubleshooting và production

| Triệu chứng | Kiểm tra |
| --- | --- |
| Target DOWN | Service selector, port name, NetworkPolicy, TLS, /metrics |
| Không thấy ServiceMonitor | serviceMonitorSelector, namespace selector |
| Rule không firing | PromQL, label, dữ liệu, for, clock skew |
| Không có notification | Route, matcher, inhibition, receiver secret |
| Prometheus dùng nhiều RAM | Cardinality, retention, scrape interval, query |

- Chạy HA Prometheus/Alertmanager và persistent storage.
- Dùng remote write/object storage khi cần retention dài.
- Mọi page phải có owner, runbook, severity và tiêu chí resolve.
