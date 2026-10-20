# 07.03 — Quản lý Nhật ký Tập trung (Grafana Loki) và Truy vết Phân tán (Grafana Tempo)

> **Trạng thái:** Hướng dẫn thực hành chi tiết cấu hình Loki, Tempo và liên kết tương quan Trace-to-Log.  
> **Áp dụng cho:** Lưu trữ nhật ký có cấu trúc (Structured Logging) và phân tích luồng truy vết phân tán (Distributed Tracing) xuyên qua microservices.

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Triển khai **Grafana Tempo** làm backend lưu trữ traces tập trung, tiếp nhận OTLP spans từ OpenTelemetry Collector trên cổng 4317.
  - Triển khai **Grafana Loki** làm backend lưu trữ nhật ký tập trung, hỗ trợ truy vấn LogQL hiệu năng cao dựa trên nhãn (Label-based indexing).
  - Thiết lập cơ chế **Trace-to-Log Correlation**: Nhúng `trace_id` vào mọi bản ghi log ứng dụng để khi điều tra một span chậm trên Tempo, kỹ sư SRE có thể nhảy trực tiếp sang xem toàn bộ logs liên quan trong Loki chỉ bằng 1 cú nhấp chuột.
  - Cấu hình lưu trữ chunks trên Amazon S3 có bật mã hóa dữ liệu tĩnh và vòng đời (Lifecycle) 7 ngày để tối ưu chi phí.
- **Nguyên tắc SRE:**
  - **Context Propagation Across Service Boundaries:** Trace context (`traceparent`, `tracestate`) bắt buộc phải được truyền qua HTTP Headers và metadata của SQS message để không bị đứt đoạn trace khi chuyển giao giữa các microservices.
  - **Index Only What You Need (Loki Cost Efficiency):** Không biến các trường có độ biến thiên cao (High Cardinality) như `user_id` hay `order_id` thành labels trong Loki; chỉ đánh chỉ mục cho `service`, `environment`, `level`.
  - **Root Cause Attribution:** Giảm thời gian điều tra sự cố từ 45 phút xuống dưới 2 phút nhờ khả năng đi thẳng từ Trace lỗi tới dòng log exception cụ thể.

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

## 3. Các bước Khai báo Chi tiết (Manifest Walkthrough)

### Bước 1: Khai báo Cấu hình Grafana Tempo

Tạo file `observability/tempo/tempo-config.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: tempo-config
  namespace: monitoring
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
```

Tạo file `observability/tempo/tempo-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tempo
  namespace: monitoring
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
```

---

### Bước 2: Khai báo Cấu hình Grafana Loki

Tạo file `observability/loki/loki-config.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: loki-config
  namespace: monitoring
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
```

Tạo file `observability/loki/loki-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: loki
  namespace: monitoring
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
spec:
  ports:
    - name: http
      port: 80
      targetPort: 3100
  selector:
    app.kubernetes.io/name: loki
```

Áp dụng vào cluster:
```bash
kubectl apply -f observability/tempo/tempo-config.yaml
kubectl apply -f observability/tempo/tempo-deployment.yaml
kubectl apply -f observability/loki/loki-config.yaml
kubectl apply -f observability/loki/loki-deployment.yaml
```

---

## 4. Xác minh và Kiểm thử Tương quan (Verification)

```bash
# 1. Kiểm tra trạng thái của các Pods Tempo và Loki
kubectl get pods -n monitoring -l "app.kubernetes.io/name in (tempo,loki)"

# 2. Kiểm tra API Readiness của Loki
kubectl run loki-test --rm -i --tty --image=curlimages/curl --restart=Never -- \
  curl -s http://loki-gateway.monitoring.svc.cluster.local/ready
# Kết quả mong đợi: ready

# 3. Kiểm tra API Status của Tempo
kubectl run tempo-test --rm -i --tty --image=curlimages/curl --restart=Never -- \
  curl -s http://tempo.monitoring.svc.cluster.local:3200/status
# Kết quả mong đợi: HTTP 200 OK
```

---

## 5. Truy vấn Mẫu với LogQL và TraceQL

### 5.1. Truy vấn Logs lỗi theo dịch vụ (LogQL)
```sql
{service="order-service", environment="dev"} |= "error" | json
```

### 5.2. Truy vấn Traces có độ trễ cao (TraceQL)
```sql
{ duration > 200ms && .service.name = "order-service" }
```

---

## 6. Điều kiện hoàn thành Gate (Gate Check)

- [ ] Cả 2 dịch vụ Tempo và Loki đều ở trạng thái `Running` và `Ready`.
- [ ] OpenTelemetry Collector kết nối thành công tới cổng `4317` của Tempo và endpoint `/otlp` của Loki.
- [ ] Không có lỗi `Connection refused` hoặc drop data trong log của Collector.
- [ ] Dữ liệu traces và logs có thể truy vấn được qua các cổng nội bộ.

---

## 7. Dọn dẹp tài nguyên (Cleanup)

- Giữ nguyên các thành phần này để làm Datasource cho Grafana ở bài 07.04.
