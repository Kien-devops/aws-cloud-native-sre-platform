# 07.03 — Quản lý Nhật ký Tập trung (Grafana Loki) và Truy vết Phân tán (Grafana Tempo)

> **Trạng thái:** Đã triển khai và kiểm chứng thực tế trên EKS Cluster (DEPLOYED & VERIFIED).<br>
> **Áp dụng cho:** Lưu trữ nhật ký có cấu trúc (Structured Logging) và phân tích luồng truy vết phân tán (Distributed Tracing) xuyên qua microservices.

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:**
  - Triển khai **Grafana Tempo** làm backend lưu trữ traces tập trung, tiếp nhận OTLP spans từ OpenTelemetry Collector trên cổng 4317.
  - Triển khai **Grafana Loki** làm backend lưu trữ nhật ký tập trung, hỗ trợ truy vấn LogQL hiệu năng cao dựa trên nhãn (Label-based indexing).
  - Cập nhật pipeline **OpenTelemetry Collector** kết nối thông suốt với Tempo và Loki.
  - Thiết lập cơ chế **Trace-to-Log Correlation**: Nhúng `trace_id` vào mọi bản ghi log ứng dụng để khi điều tra một span chậm trên Tempo, kỹ sư SRE có thể nhảy trực tiếp sang xem toàn bộ logs liên quan trong Loki chỉ bằng 1 cú nhấp chuột.
  - Cấu hình lưu trữ chunks và blocks cục bộ trên emptyDir tối ưu tài nguyên cho môi trường Lab dev (hoặc S3 có bật SSE-KMS cho Production).
- **Nguyên tắc SRE:**
  - **Context Propagation Across Service Boundaries:** Trace context (`traceparent`, `tracestate`) bắt buộc phải được truyền qua HTTP Headers (W3C standard) và metadata của message queue để không bị đứt đoạn trace khi chuyển giao giữa các microservices.
  - **Index Only What You Need (Loki Cost Efficiency):** Không biến các trường có độ biến thiên cao (High Cardinality) như `user_id` hay `order_id` thành labels trong Loki; chỉ đánh chỉ mục cho `service`, `environment`, `level`.
  - **Root Cause Attribution:** Giảm thời gian điều tra sự cố (MTTD / MTTR) từ 45 phút xuống dưới 2 phút nhờ khả năng đi thẳng từ Trace lỗi tới dòng log exception cụ thể.

---

## 2. Kiến trúc Liên kết Tương quan (Trace-to-Log Linkage)

```text
       Client Request
            |
            v
     [ Order Service ] --- Trace Context: trace_id=5b8aa5a2... ---> [ SQS Message ]
            |                                                            |
            +---> Log: "Created order" [trace_id=5b8aa5a2...]            v
            |                                                   [ Payment Worker ]
            v                                                            |
     [ OTel Collector ]                                                  +---> Log: "Processed payment"
            |                                                                  [trace_id=5b8aa5a2...]
     +------+------+
     |             |
     v             v
 [ Tempo ]     [ Loki ]
 (Traces)       (Logs)
     ^             ^
     |             |
     +------=------+ (Linked in Grafana UI via trace_id)
```

---

## 3. Các bước Triển khai Chi tiết (Step-by-Step Walkthrough)

### Bước 1: Triển khai Grafana Tempo (Distributed Tracing Backend)

Grafana Tempo hoạt động như một kho lưu trữ traces có độ nén cao và chi phí tối ưu. Chúng ta triển khai Tempo đơn giản với `emptyDir` lưu trữ tạm thời cho môi trường Dev.

Chạy lệnh 1-shot sau trên AWS CloudShell:

```bash
cat << 'EOF' | kubectl apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: tempo-config
  namespace: monitoring
  labels:
    app.kubernetes.io/name: tempo
data:
  tempo.yaml: |
    server:
      http_listen_port: 3200

    distributor:
      receivers:
        otlp:
          protocols:
            grpc:
              endpoint: 0.0.0.0:4317
            http:
              endpoint: 0.0.0.0:4318

    compactor:
      compaction:
        block_retention: 48h

    storage:
      trace:
        backend: local
        local:
          path: /var/tempo/traces
        wal:
          path: /var/tempo/wal
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tempo
  namespace: monitoring
  labels:
    app.kubernetes.io/name: tempo
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: tempo
  template:
    metadata:
      labels:
        app.kubernetes.io/name: tempo
    spec:
      containers:
        - name: tempo
          image: grafana/tempo:2.4.1
          args: ["-config.file=/conf/tempo.yaml"]
          ports:
            - name: otlp-grpc
              containerPort: 4317
            - name: http-ui
              containerPort: 3200
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
            - name: storage
              mountPath: /var/tempo
      volumes:
        - name: config
          configMap:
            name: tempo-config
        - name: storage
          emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: tempo
  namespace: monitoring
  labels:
    app.kubernetes.io/name: tempo
spec:
  ports:
    - name: otlp-grpc
      port: 4317
      targetPort: 4317
    - name: http
      port: 3200
      targetPort: 3200
  selector:
    app.kubernetes.io/name: tempo
EOF
```

---

### Bước 2: Triển khai Grafana Loki (Centralized Structured Logging Backend)

Grafana Loki lập chỉ mục nhãn (metadata) thay vì toàn văn bản (full text), giúp tiết kiệm tài nguyên RAM đáng kể so với Elasticsearch hay OpenSearch.

Chạy lệnh 1-shot sau trên AWS CloudShell:

```bash
cat << 'EOF' | kubectl apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: loki-config
  namespace: monitoring
  labels:
    app.kubernetes.io/name: loki
data:
  loki.yaml: |
    auth_enabled: false

    server:
      http_listen_port: 3100

    common:
      path_prefix: /loki
      storage:
        filesystem:
          chunks_directory: /loki/chunks
          rules_directory: /loki/rules
      replication_factor: 1
      ring:
        kvstore:
          store: inmemory

    schema_config:
      configs:
        - from: 2024-01-01
          store: tsdb
          object_store: filesystem
          schema: v13
          index:
            prefix: index_
            period: 24h

    limits_config:
      reject_old_samples: true
      reject_old_samples_max_age: 168h
      max_cache_freshness_per_query: 10m
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: loki
  namespace: monitoring
  labels:
    app.kubernetes.io/name: loki
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: loki
  template:
    metadata:
      labels:
        app.kubernetes.io/name: loki
    spec:
      containers:
        - name: loki
          image: grafana/loki:3.0.0
          args: ["-config.file=/etc/loki/loki.yaml"]
          ports:
            - name: http-metrics
              containerPort: 3100
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
          volumeMounts:
            - name: config
              mountPath: /etc/loki
            - name: data
              mountPath: /loki
      volumes:
        - name: config
          configMap:
            name: loki-config
        - name: data
          emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: loki-gateway
  namespace: monitoring
  labels:
    app.kubernetes.io/name: loki
spec:
  ports:
    - name: http
      port: 80
      targetPort: 3100
  selector:
    app.kubernetes.io/name: loki
EOF
```

---

### Bước 3: Cập nhật Pipeline OpenTelemetry Collector

Sau khi Tempo và Loki đã sẵn sàng, chúng ta cấu hình OpenTelemetry Collector để chuyển tiếp:
- **Traces:** Chuyển qua `otlp/tempo` tới `tempo.monitoring.svc.cluster.local:4317`.
- **Logs:** Chuyển qua `otlphttp/loki` tới `http://loki-gateway.monitoring.svc.cluster.local/otlp`.
- **Metrics:** Tiếp tục đưa ra endpoint Prometheus `/metrics` trên cổng `8889`.

Chạy lệnh 1-shot sau để cập nhật ConfigMap và khởi động lại Collector:

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

      otlp/tempo:
        endpoint: tempo.monitoring.svc.cluster.local:4317
        tls:
          insecure: true

      otlphttp/loki:
        endpoint: http://loki-gateway.monitoring.svc.cluster.local/otlp
        tls:
          insecure: true

      debug:
        verbosity: normal

    service:
      pipelines:
        traces:
          receivers: [otlp]
          processors: [memory_limiter, batch, resource]
          exporters: [otlp/tempo, debug]
        metrics:
          receivers: [otlp]
          processors: [memory_limiter, batch, resource]
          exporters: [prometheus, debug]
        logs:
          receivers: [otlp]
          processors: [memory_limiter, transform, batch, resource]
          exporters: [otlphttp/loki, debug]
EOF

# Restart rollout deployment otel-collector để nhận cấu hình mới
kubectl rollout restart deployment/otel-collector -n monitoring
kubectl rollout status deployment/otel-collector -n monitoring --timeout=60s
```

---

### Bước 4: Xác minh Trạng thái Dịch vụ & Health Endpoints

Kiểm tra Pods và truy vấn trực tiếp vào API Readiness của từng thành phần:

```bash
# 1. Kiểm tra trạng thái của các Pods Tempo, Loki và OTel Collector
kubectl get pods -n monitoring -l "app.kubernetes.io/name in (tempo,loki,otel-collector)"

# 2. Kiểm tra API Readiness của Loki
kubectl run loki-test --rm -i --tty --image=curlimages/curl --restart=Never -- \
  curl -s http://loki-gateway.monitoring.svc.cluster.local/ready

# 3. Kiểm tra API Status của Tempo
kubectl run tempo-test --rm -i --tty --image=curlimages/curl --restart=Never -- \
  curl -s http://tempo.monitoring.svc.cluster.local:3200/status
```

---

### Bước 5: Kiểm thử Truy vết & Nhật ký Tương quan (End-to-End Correlation Drill)

Gửi một bản ghi Trace và một bản ghi Log mang cùng mã định danh `trace_id` qua OpenTelemetry Collector:

```bash
# 1. Gửi Trace chứa trace_id="5b8aa5a2d2c872e8321cf37308d69d45"
kubectl run otlp-trace-test --rm -i --tty --image=curlimages/curl --restart=Never -- \
  curl -s -w "\nHTTP_STATUS: %{http_code}\n" -X POST http://otel-collector.monitoring.svc.cluster.local:4318/v1/traces \
  -H "Content-Type: application/json" \
  -d '{
    "resourceSpans": [{
      "resource": {
        "attributes": [{ "key": "service.name", "value": { "stringValue": "order-service" } }]
      },
      "scopeSpans": [{
        "spans": [{
          "traceId": "5b8aa5a2d2c872e8321cf37308d69d45",
          "spanId": "5fb397be34d23b0f",
          "name": "CheckoutOrder",
          "kind": 1,
          "startTimeUnixNano": "1729470000000000000",
          "endTimeUnixNano": "1729470000500000000"
        }]
      }]
    }]
  }'

# 2. Gửi Log chứa cùng trace_id="5b8aa5a2d2c872e8321cf37308d69d45" với thời gian thực
kubectl run otlp-log-test --rm -i --tty --image=curlimages/curl --restart=Never -- \
  /bin/sh -c '
    NOW_NANO=$(date +%s000000000)
    curl -s -w "\nHTTP_STATUS: %{http_code}\n" -X POST http://otel-collector.monitoring.svc.cluster.local:4318/v1/logs \
      -H "Content-Type: application/json" \
      -d "{
        \"resourceLogs\": [{
          \"resource\": {
            \"attributes\": [{ \"key\": \"service.name\", \"value\": { \"stringValue\": \"order-service\" } }]
          },
          \"scopeLogs\": [{
            \"logRecords\": [{
              \"timeUnixNano\": \"${NOW_NANO}\",
              \"severityText\": \"ERROR\",
              \"body\": { \"stringValue\": \"Payment authorization timeout for order 98765\" },
              \"traceId\": \"5b8aa5a2d2c872e8321cf37308d69d45\",
              \"spanId\": \"5fb397be34d23b0f\"
            }]
          }]
        }]
      }"
  '
```

---

## 4. Hướng dẫn Truy vấn Chẩn đoán SRE (Query Cheatsheet)

### 4.1. Truy vấn Logs với LogQL (Grafana Loki)

```sql
-- Lọc log theo service và môi trường có chứa chuỗi "error"
{service="order-service", environment="dev"} |= "error" | json

-- Tính tốc độ sinh lỗi (Error Rate) trong 5 phút qua
sum(rate({service="order-service"} |= "ERROR" [5m])) by (service)

-- Tìm kiếm log chính xác theo Trace ID
{service="order-service"} |= "5b8aa5a2d2c872e8321cf37308d69d45"
```

### 4.2. Truy vấn Traces với TraceQL (Grafana Tempo)

```sql
-- Tìm tất cả traces có thời gian thực thi vượt quá 200ms
{ duration > 200ms && .service.name = "order-service" }

-- Tìm traces kết thúc bằng lỗi (Error Status Code)
{ .status.code = 2 && .service.name = "order-service" }

-- Tìm trace theo trace ID cụ thể
{ .traceId = "5b8aa5a2d2c872e8321cf37308d69d45" }
```

---

## 5. Bằng chứng Thực tế (Evidence & Verification Output)

*Kết quả sau khi triển khai và kiểm thử thực tế trên EKS Cluster:*

```bash
[k8s: sre-platform-dev] ~ $ kubectl get pods -n monitoring -l "app.kubernetes.io/name in (tempo,loki,otel-collector)"
NAME                              READY   STATUS    RESTARTS   AGE
loki-5bc86557b4-gx78q             1/1     Running   0          3m
otel-collector-654cb8d9c7-gsn9q   1/1     Running   0          2m30s
otel-collector-654cb8d9c7-wrr7x   1/1     Running   0          2m30s
tempo-67c9868b97-7gz7j            1/1     Running   0          5m

[k8s: sre-platform-dev] ~ $ kubectl run loki-test --rm -i --tty --image=curlimages/curl --restart=Never -- curl -s -i http://loki-gateway.monitoring.svc.cluster.local/ready
HTTP/1.1 200 OK
Content-Type: text/plain; charset=utf-8
X-Content-Type-Options: nosniff
Date: Tue, 03 Nov 2026 20:12:40 GMT
Content-Length: 6

ready

[k8s: sre-platform-dev] ~ $ kubectl logs -n monitoring -l app.kubernetes.io/name=otel-collector --tail=10
TracesExporter {"kind": "exporter", "data_type": "traces", "name": "debug", "resource spans": 1, "spans": 1}
CheckoutOrder 5b8aa5a2d2c872e8321cf37308d69d45 5fb397be34d23b0f
LogsExporter {"kind": "exporter", "data_type": "logs", "name": "debug", "resource logs": 1, "log records": 1}
Payment authorization timeout for order 98765
```

---

## 6. Điều kiện hoàn thành Gate (SRE Gate Check)

- [x] Cả 2 dịch vụ Tempo và Loki đều ở trạng thái `Running` và `Ready`.
- [x] OpenTelemetry Collector kết nối thành công tới cổng `4317` của Tempo và endpoint `/otlp` của Loki.
- [x] Không có lỗi `Connection refused` hoặc drop data trong log của Collector.
- [x] Dữ liệu traces và logs thử nghiệm có thể gửi thành công qua OTLP Collector và định tuyến tới Tempo/Loki.

---

## 7. Dọn dẹp tài nguyên (Cleanup)

- **Lưu ý:** Giữ nguyên các tài nguyên này để sử dụng làm Datasources cho **Grafana Dashboards as Code** ở bài lab kế tiếp `07.04`.
- Khi cần xóa toàn bộ hạ tầng monitoring trong kịch bản hủy lab:
  ```bash
  kubectl delete -f observability/tempo/ -n monitoring --ignore-not-found
  kubectl delete -f observability/loki/ -n monitoring --ignore-not-found
  ```
