# Triển khai nền tảng Observability

> Cấu hình và kết quả trong tài liệu là ví dụ thiết kế. Cần kiểm tra phiên bản chart, retention và chi phí trước khi áp dụng.

## Mục tiêu

Thu thập ba tín hiệu liên quan: metrics cho xu hướng, logs cho chi tiết sự kiện và traces cho đường đi một request. Prometheus, Loki, Tempo, Grafana và OpenTelemetry phải có ownership, retention, capacity và quyền truy cập rõ ràng.

## Vấn đề thực tế

Có dữ liệu không đồng nghĩa quan sát được hệ thống. Label cardinality cao làm Prometheus tốn bộ nhớ; log không có `trace_id` khiến không nối được với trace; collector đầy queue làm mất telemetry. Lưu vô hạn cũng tăng chi phí và rủi ro dữ liệu nhạy cảm.

## Cơ chế và luồng

```text
Application SDK -> OTel Collector -> metrics/logs/traces backend
Prometheus scrape/exporter -> rules -> Alertmanager
Loki + Tempo + Prometheus -> Grafana dashboard/explore
```

Collector nên có batch, retry và giới hạn queue. Metrics cần tên, đơn vị và label ổn định. Logs nên structured JSON và được redacted. Trace propagation phải giữ `traceparent` qua API Gateway, queue và service.

## Ví dụ ReliabilityShop

Một request đặt hàng đi qua frontend, API Gateway, order, inventory và payment. Grafana phải mở được trace xuyên các service, tìm log cùng `trace_id`, đồng thời so sánh histogram latency với tỷ lệ lỗi và saturation.

## Thiết kế triển khai dự kiến

1. Cài chart/operator qua GitOps, pin version và values.
2. Chọn storage class, PVC, retention và resource requests.
3. Khai báo ServiceMonitor/PodMonitor, recording rules và alert routes.
4. Thiết lập Grafana datasource, SSO, folder và dashboard version hóa.
5. Kiểm tra backpressure, mất dữ liệu, restore và cardinality.

## Verification minh họa

```bash
kubectl get pods -n monitoring
kubectl get servicemonitor,podmonitor -A
kubectl port-forward -n monitoring svc/prometheus 9090:9090
```

**Expected (minh họa):** target được scrape; query có dữ liệu mới; trace và log chứa cùng `trace_id`; alert test tới đúng receiver. Kết quả phải kèm timestamp và phiên bản.

## Troubleshooting

Không có metrics: kiểm tra selector, ServiceMonitor namespace, target health và network policy. Không có traces: kiểm tra SDK exporter, OTLP endpoint, sampling và queue. Grafana lỗi query: kiểm tra datasource URL, TLS và quyền. Disk đầy: xem retention, WAL, compaction và tốc độ ingest trước khi tăng PVC.

## Lưu ý production

Tách dữ liệu theo môi trường, mã hóa khi truyền/lưu, giới hạn truy cập dashboard và lọc PII/secrets. Đặt SLO cho pipeline telemetry; telemetry mất không được làm ứng dụng lỗi. Tính chi phí theo ingest, lưu trữ, truy vấn và số series; thử restore trước khi coi hệ thống có khả năng phục hồi.

## Nguồn chính thức

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Grafana Loki](https://grafana.com/docs/loki/latest/)
