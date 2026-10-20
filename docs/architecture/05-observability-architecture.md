# 05. Kiến trúc Observability

## Mục tiêu

Observability liên kết metrics, logs và traces để trả lời: người dùng bị ảnh hưởng thế nào, thành phần nào gây ra và thay đổi nào liên quan. Có telemetry không đồng nghĩa telemetry đúng hoặc đủ.

## Pipeline

```text
Application SDK / node agent
          -> OpenTelemetry Collector
             |       |       |
        Prometheus  Loki    Tempo
             \       |       /
                 Grafana
                   |
             Alertmanager
```

Prometheus thường scrape metrics theo pull model. Logs có thể do DaemonSet agent thu thập. Traces dùng OTLP tới Collector rồi Tempo.

## Chuẩn hóa dữ liệu

Resource attributes tối thiểu gồm `service.name`, `service.version`, `deployment.environment`, namespace và Pod. Log JSON có level, timestamp, message, trace ID và error type. Không dùng user/order ID làm Prometheus label vì cardinality cao.

## Request correlation

Một request tạo trace gồm span ở Gateway, Order, Inventory và DB. Log cùng request mang `trace_id`. Metrics không gắn trace cho mọi sample, nhưng exemplar có thể liên kết latency histogram tới trace đại diện nếu stack hỗ trợ.

## Sampling và retention

Sampling cân bằng điều tra với chi phí. Error traces có thể được ưu tiên theo policy. Xác định retention, storage, indexing và access control trước khi bật tải lớn.

## Verification

```bash
kubectl get pods -n observability
kubectl get servicemonitor -A
```

Kiểm tra Prometheus target UP, log có trace ID, Tempo tìm được trace và Grafana query cùng service/version. **Measured Result** cần request thật và timestamp.

## Troubleshooting

- Target DOWN: ServiceMonitor selector, TLS, auth, DNS hoặc NetworkPolicy.
- Log có nhưng không trace: context propagation hoặc Collector processor.
- Thiếu DB span: instrumentation client chưa bật.
- Cardinality tăng: label động hoặc route chưa chuẩn hóa.

## Production considerations

Tách quyền Grafana, mã hóa transport/storage, giới hạn query, bảo vệ Collector khỏi overload và theo dõi dropped telemetry. Monitoring backend có capacity và failure-mode riêng.
