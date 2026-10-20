# 07.01 — Triển khai OpenTelemetry Collector và Xử lý Luồng Telemetry

> **Trạng thái:** Hướng dẫn thực hành chi tiết cấu hình OpenTelemetry Operator và OTel Collector.  
> **Áp dụng cho:** Thu thập, chuẩn hóa, lọc dữ liệu nhạy cảm (Sanitization) và phân phối Metrics, Logs, Traces tới các backend lưu trữ.

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Triển khai **OpenTelemetry Collector** trên EKS Cluster theo mô hình kết hợp: **DaemonSet** (thu thập node metrics và container logs) và **Deployment** (tiếp nhận OTLP traces và metrics từ ứng dụng).
  - Cấu hình các Pipeline chuẩn mực:
    - **Receivers:** `otlp` (giao thức gRPC 4317 và HTTP 4318), `filelog` (đọc stdout/stderr của pods).
    - **Processors:** `memory_limiter` (chống OOM collector), `batch` (gom nhóm gửi theo đợt), `transform / redaction` (lọc bỏ secret, PII, token nhạy cảm trước khi xuất dữ liệu), `resource` (gắn metadata `service.name`, `environment`, `k8s.pod.name`).
    - **Exporters:** `prometheus` (expose port 8889 để Prometheus scrape), `otlp/tempo` (đẩy traces sang Grafana Tempo), `loki` (đẩy logs sang Grafana Loki).
- **Nguyên tắc SRE:**
  - **Telemetry Backpressure & Circuit Breaking:** Bộ thu thập dữ liệu (Collector) không bao giờ được phép làm sập ứng dụng chính khi backend telemetry gặp sự cố; cơ chế Queueing và Dropping có kiểm soát phải được kích hoạt.
  - **Memory Limiter Guardrail:** Cấu hình `memory_limiter` bắt buộc để tránh Collector ngốn cạn RAM của worker nodes.
  - **Strict PII & Credential Masking:** Dữ liệu nhạy cảm (Authorization headers, passwords, thẻ tín dụng) phải bị xóa/mã hóa ngay tại processor của collector trước khi được lưu trữ vào bất kỳ log storage nào.

---

## 2. Kiến trúc Luồng Dữ liệu OpenTelemetry

```text
       [ ReliabilityShop Microservices ]
  (Instrumentation via OpenTelemetry SDK)
                      |
           OTLP (gRPC:4317 / HTTP:4318)
                      |
                      v
    +------------------------------------+
    | OpenTelemetry Collector (Agent)   |
    |                                    |
    | Processors:                        |
    | 1. memory_limiter (Hard: 80% RAM)  |
    | 2. transform (Redact Secrets/PII)  |
    | 3. batch (Send every 5s / 1000 items)
    | 4. resource (Add k8s attributes)   |
    +-----+--------------+-------------+-+
          |              |             |
       Metrics         Logs          Traces
          |              |             |
          v              v             v
    [ Prometheus ]   [ Loki ]      [ Tempo ]
```

---

## 3. Các bước Khai báo Chi tiết (Manifest Walkthrough)

### Bước 1: Khai báo Cấu hình OpenTelemetry Collector ConfigMap

Tạo file `observability/opentelemetry/collector-config.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: otel-collector-config
  namespace: monitoring
data:
  config.yaml: |
    receivers:
      otlp:
        protocols:
          grpc:
            endpoint: 0.0.0.0:4317
          http:
            endpoint: 0.0.0.0:4318

    processors:
      # BẢO VỆ COLLECTOR KHỎI OOM (SRE Resilience)
      memory_limiter:
        check_interval: 1s
        limit_percentage: 80
        spike_limit_percentage: 20

      # GOM NHÓM ĐỂ TỐI ƯU HÓA MẠNG VÀ CPU
      batch:
        send_batch_size: 1024
        timeout: 5s

      # LỌC BỎ THÔNG TIN NHẠY CẢM (Zero-Secret Logging)
      transform:
        error_mode: ignore
        log_statements:
          - context: log
            statements:
              - replace_all_patterns(attributes, "value", "Bearer [a-zA-Z0-9_\\-\\.]+", "Bearer [REDACTED]")
              - replace_all_patterns(attributes, "value", "password=[^&\\s]+", "password=[REDACTED]")

      # BỔ SUNG METADATA HẠ TẦNG KUBERNETES
      resource:
        attributes:
          - key: environment
            value: dev
            action: insert

    exporters:
      # EXPORT METRICS ĐỂ PROMETHEUS SCRAPE
      prometheus:
        endpoint: 0.0.0.0:8889
        namespace: "otel"

      # EXPORT TRACES SANG GRAFANA TEMPO
      otlp/tempo:
        endpoint: tempo.monitoring.svc.cluster.local:4317
        tls:
          insecure: true

      # EXPORT LOGS SANG GRAFANA LOKI
      otlphttp/loki:
        endpoint: http://loki-gateway.monitoring.svc.cluster.local/otlp
        tls:
          insecure: true

    service:
      pipelines:
        traces:
          receivers: [otlp]
          processors: [memory_limiter, transform, batch, resource]
          exporters: [otlp/tempo]
        metrics:
          receivers: [otlp]
          processors: [memory_limiter, batch, resource]
          exporters: [prometheus]
        logs:
          receivers: [otlp]
          processors: [memory_limiter, transform, batch, resource]
          exporters: [otlphttp/loki]
```

---

### Bước 2: Khai báo Deployment và Service cho OTel Collector

Tạo file `observability/opentelemetry/collector-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: otel-collector
  namespace: monitoring
  labels:
    app.kubernetes.io/name: otel-collector
spec:
  replicas: 2
  selector:
    matchLabels:
      app.kubernetes.io/name: otel-collector
  template:
    metadata:
      labels:
        app.kubernetes.io/name: otel-collector
    spec:
      containers:
        - name: otel-collector
          image: otel/opentelemetry-collector-contrib:0.104.0
          args: ["--config=/conf/config.yaml"]
          resources:
            requests:
              cpu: 200m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
          volumeMounts:
            - name: config
              mountPath: /conf
          ports:
            - name: otlp-grpc
              containerPort: 4317
            - name: otlp-http
              containerPort: 4318
            - name: metrics
              containerPort: 8889
      volumes:
        - name: config
          configMap:
            name: otel-collector-config
---
apiVersion: v1
kind: Service
metadata:
  name: otel-collector
  namespace: monitoring
  labels:
    app.kubernetes.io/name: otel-collector
spec:
  type: ClusterIP
  ports:
    - name: otlp-grpc
      port: 4317
      targetPort: 4317
    - name: otlp-http
      port: 4318
      targetPort: 4318
    - name: prometheus-metrics
      port: 8889
      targetPort: 8889
  selector:
    app.kubernetes.io/name: otel-collector
```

Áp dụng vào cluster:
```bash
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f observability/opentelemetry/collector-config.yaml
kubectl apply -f observability/opentelemetry/collector-deployment.yaml
```

---

## 4. Xác minh (Verification)

Chạy lệnh kiểm tra tiến trình hoạt động của OTel Collector:

```bash
# 1. Kiểm tra trạng thái Pods của Collector
kubectl get pods -n monitoring -l app.kubernetes.io/name=otel-collector

# 2. Kiểm tra log khởi động xem các pipelines có active không
kubectl logs -n monitoring -l app.kubernetes.io/name=otel-collector --tail=50
```

**Kết quả mong đợi:**
- Log xuất hiện thông điệp xác nhận:  
  `Everything is ready. Begin running and processing data.`  
  `Starting GRPC server on endpoint 0.0.0.0:4317`  
  `Starting HTTP server on endpoint 0.0.0.0:4318`  
  `Starting Prometheus exporter on endpoint 0.0.0.0:8889`

---

## 5. Thử nghiệm Bơm Telemetry Mẫu (Sample Trace Test)

Gửi một trace mẫu qua giao thức HTTP OTLP từ terminal để kiểm tra pipeline:

```bash
kubectl run otlp-test --rm -i --tty --image=curlimages/curl --restart=Never -- \
  curl -s -X POST http://otel-collector.monitoring.svc.cluster.local:4318/v1/traces \
  -H "Content-Type: application/json" \
  -d '{
    "resourceSpans": [{
      "resource": {
        "attributes": [{ "key": "service.name", "value": { "stringValue": "smoke-test" } }]
      },
      "scopeSpans": [{
        "spans": [{
          "traceId": "5b8aa5a2d2c872e8321cf37308d69d45",
          "spanId": "5fb397be34d23b0f",
          "name": "HealthCheckSpan",
          "kind": 1,
          "startTimeUnixNano": "1729470000000000000",
          "endTimeUnixNano": "1729470000050000000"
        }]
      }]
    }]
  }'
```

**Kết quả mong đợi:** Lệnh curl trả về HTTP code `200` với body rỗng `{}` (chứng minh Collector đã nhận, xử lý qua processor và đưa vào export queue thành công).

---

## 6. Điều kiện hoàn thành Gate (Gate Check)

- [ ] OpenTelemetry Collector Deployments đạt trạng thái `Ready` (2/2 pods).
- [ ] Các cổng OTLP `4317` và `4318` mở và lắng nghe bên trong cluster.
- [ ] Processor `memory_limiter` và `transform` hoạt động bình thường, bảo đảm an toàn dữ liệu.
- [ ] Cổng metric `8889` sẵn sàng cho Prometheus scrape ở bài 07.02.

---

## 7. Dọn dẹp tài nguyên (Cleanup)

- Không xóa OTel Collector nếu chuẩn bị triển khai các backend lưu trữ ở các bài tiếp theo.
- Khi dọn dẹp: `kubectl delete -f observability/opentelemetry/collector-deployment.yaml`.
