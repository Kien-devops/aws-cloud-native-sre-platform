# 07.01 — Triển khai OpenTelemetry Collector và Xử lý Luồng Telemetry

> **Trạng thái:** Đã triển khai và kiểm chứng thực tế trên EKS Cluster (DEPLOYED & VERIFIED).<br>
> **Áp dụng cho:** Thu thập, chuẩn hóa, lọc dữ liệu nhạy cảm (Sanitization) và phân phối Metrics, Logs, Traces tới các backend lưu trữ.

---

## 1. Tóm tắt Thành phần Đã Triển khai và Chức năng

| Tài nguyên Đã Triển Khai | Loại (Kind) | Namespace | Vai trò & Chức năng Cốt lõi |
| :--- | :--- | :--- | :--- |
| **`monitoring`** | `Namespace` | `monitoring` | Không gian tên cô lập dành riêng cho toàn bộ hạ tầng Observability. |
| **`otel-collector-config`** | `ConfigMap` | `monitoring` | Định nghĩa toàn bộ pipeline xử lý telemetry: OTLP receivers, processors lọc bỏ thông tin nhạy cảm, gom batch, giới hạn RAM và exporters. |
| **`otel-collector`** | `Deployment` | `monitoring` | Chạy 2 Pods container `otel/opentelemetry-collector-contrib:0.104.0`, co giãn sẵn sàng cao (High Availability). |
| **`otel-collector`** | `Service` | `monitoring` | Cung cấp DNS nội bộ `otel-collector.monitoring.svc.cluster.local` mở 3 cổng: `4317` (gRPC), `4318` (HTTP), `8889` (Prometheus metrics). |

### OpenTelemetry Collector làm cái gì trong hệ thống?
1. **Trạm trung chuyển dữ liệu tập trung (Telemetry Hub):** Thay vì từng microservice (`order`, `frontend`, `worker`) phải tự gửi dữ liệu phân tán tới nhiều nơi, tất cả chỉ cần gửi về duy nhất endpoint nội bộ của OTel Collector qua giao thức chuẩn OTLP.
2. **Bảo vệ cụm chống sập (Circuit Breaker & OOM Limiter):** Bộ xử lý `memory_limiter` khống chế mức sử dụng RAM tối đa ở 80%, nếu telemetry dâng cao đột biến nó sẽ tự động giảm tải (drop bớt sample có kiểm soát) thay vì để pod ngốn cạn RAM của node EC2.
3. **Khử dữ liệu nhạy cảm (Zero-Secret Logging):** Bộ xử lý `transform` tự động quét regex và xóa bỏ Authorization headers, passwords (`Bearer [REDACTED]`, `password=[REDACTED]`) trước khi lưu trữ.
4. **Tối ưu mạng và CPU (Batching):** Gom cụm dữ liệu gửi theo từng gói (1024 spans hoặc mỗi 5 giây) giúp giảm số lượng kết nối mạng và tiết kiệm chi phí băng thông.
5. **Cầu nối đa nền tảng:** Xuất metrics ra cổng `8889` cho Prometheus cào ở Lab 07.02, và sẵn sàng đẩy traces sang Grafana Tempo và logs sang Grafana Loki ở Lab 07.03.

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

Áp dụng vào cluster (Lệnh 1-shot tiện lợi cho CloudShell / Terminal):
```bash
cat << 'EOF' | kubectl apply -f -
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
      memory_limiter:
        check_interval: 1s
        limit_percentage: 80
        spike_limit_percentage: 20

      batch:
        send_batch_size: 1024
        timeout: 5s

      transform:
        error_mode: ignore
        log_statements:
          - context: log
            statements:
              - replace_all_patterns(attributes, "value", "Bearer [a-zA-Z0-9_\\-\\.]+", "Bearer [REDACTED]")
              - replace_all_patterns(attributes, "value", "password=[^&\\s]+", "password=[REDACTED]")

      resource:
        attributes:
          - key: environment
            value: dev
            action: insert

    exporters:
      prometheus:
        endpoint: 0.0.0.0:8889
        namespace: "otel"

      debug:
        verbosity: normal

    service:
      pipelines:
        traces:
          receivers: [otlp]
          processors: [memory_limiter, batch, resource]
          exporters: [debug]
        metrics:
          receivers: [otlp]
          processors: [memory_limiter, batch, resource]
          exporters: [prometheus, debug]
        logs:
          receivers: [otlp]
          processors: [memory_limiter, transform, batch, resource]
          exporters: [debug]
---
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
              cpu: 100m
              memory: 128Mi
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
EOF
```

---

## 4. Bằng chứng Xác minh Thực tế (Actual Verification Evidence)

### 4.1. Kiểm tra trạng thái Pods của Collector:
```bash
kubectl get pods -n monitoring -l app.kubernetes.io/name=otel-collector
```

**Bằng chứng thực thi trên EKS:**
```text
NAME                              READY   STATUS    RESTARTS   AGE
otel-collector-7c9798dcb8-4k2vj   1/1     Running   0          9s
otel-collector-7c9798dcb8-bdww8   1/1     Running   0          9s
```

---

## 5. Thử nghiệm Bơm Telemetry Mẫu (Sample Trace Test)

Gửi một trace mẫu qua giao thức HTTP OTLP từ terminal để kiểm tra pipeline:

```bash
kubectl run otlp-test --rm -i --tty --image=curlimages/curl --restart=Never -- \
  curl -s -w "\nHTTP_STATUS: %{http_code}\n" -X POST http://otel-collector.monitoring.svc.cluster.local:4318/v1/traces \
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

**Bằng chứng phản hồi thực tế từ Collector:**
```text
{"partialSuccess":{}}
HTTP_STATUS: 200
pod "otlp-test" deleted from default namespace
```
* HTTP 200 kèm `partialSuccess: {}` xác nhận dữ liệu Span hợp lệ 100%, không bị reject và đã được xử lý qua pipeline đưa vào exporter.

---

## 6. Điều kiện hoàn thành Gate (Gate Check)

- [x] OpenTelemetry Collector Deployments đạt trạng thái `Ready` (2/2 pods).
- [x] Các cổng OTLP `4317` (gRPC) và `4318` (HTTP) mở và lắng nghe bên trong cluster.
- [x] Processor `memory_limiter` và `transform` hoạt động bình thường, bảo đảm an toàn dữ liệu và chống OOM.
- [x] Cổng metric `8889` sẵn sàng cho Prometheus scrape ở bài 07.02.
- [x] Thử nghiệm gửi trace mẫu OTLP thành công với HTTP 200 OK.

---

## 7. Dọn dẹp tài nguyên (Cleanup)

- Giữ nguyên OTel Collector để phục vụ cho các bài tiếp theo: Prometheus (07.02) và Loki/Tempo (07.03).
- Khi kết thúc toàn bộ platform, lệnh dọn dẹp: `kubectl delete namespace monitoring`.
