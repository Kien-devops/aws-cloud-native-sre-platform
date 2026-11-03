# 07.04 — Xây dựng Bảng điều khiển Grafana Dashboards Chuẩn SRE (Golden Signals & Error Budget)

> **Trạng thái:** Đã triển khai và kiểm chứng thực tế trên EKS Cluster (DEPLOYED & VERIFIED).<br>
> **Áp dụng cho:** Trực quan hóa 4 Tín hiệu Vàng (Golden Signals), giám sát tiêu hao Ngân sách Lỗi (Error Budget Burn Rate) và điều tra sự cố hợp nhất.

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:**
  - Triển khai **Grafana Server** trên EKS namespace `monitoring`.
  - Khai báo Datasources tự động (Datasources as Code): **Prometheus** (Metrics), **Loki** (Logs) và **Tempo** (Traces).
  - Triển khai bộ Dashboards cốt lõi của SRE thông qua GitOps / ConfigMap (Dashboards as Code):
    1. **SRE Golden Signals Dashboard (RED & USE):** Theo dõi Rate (RPS), Errors (5xx), Duration (p50/p95/p99) ở tầng dịch vụ và Utilization, Saturation ở tầng hạ tầng.
    2. **SLO & Error Budget Dashboard:** Hiển thị phần trăm ngân sách lỗi còn lại (Remaining Budget), tốc độ đốt ngân sách (Burn Rate), và dự báo thời gian cạn kiệt ngân sách (Time to Exhaustion).
  - Kích hoạt tính năng **Tempo-to-Loki & Loki-to-Tempo Derived Fields** để nhấp trực tiếp từ một span trong Trace sang xem log tương ứng trong Loki và ngược lại.
- **Nguyên tắc SRE:**
  - **Dashboards as Code (DaC):** Không tạo dashboard thủ công bằng cách bấm nhấp rồi để thất lạc cấu hình; mọi bảng điều khiển phải được định nghĩa bằng JSON và tự động nạp qua GitOps (Grafana Provisioning).
  - **Single Pane of Glass (Giao diện Hợp nhất):** Một sự cố phải được nhìn nhận đa chiều trên cùng một màn hình: Từ triệu chứng người dùng (Latency tăng) -> Lỗi ứng dụng (Log Exception) -> Điểm nghẽn phân tán (Trace Span ở Database).
  - **Glanceable Status in Under 5 Seconds:** Kỹ sư On-call chỉ cần nhìn vào dashboard trong 5 giây là biết ngay hệ thống đang xanh (Healthy) hay đang đốt Error Budget (Degraded).

---

## 2. Kiến trúc Provisioning Tự động của Grafana

```text
Kubernetes Namespace: monitoring
├── ConfigMap: grafana-datasources
│   └── datasources.yaml  --> /etc/grafana/provisioning/datasources/
│       ├── Prometheus (http://prometheus-kube-prometheus-prometheus:9090)
│       ├── Loki       (http://loki-gateway:80)
│       └── Tempo      (http://tempo:3200)
│
├── ConfigMap: grafana-dashboard-provider
│   └── provider.yaml     --> /etc/grafana/provisioning/dashboards/
│
└── ConfigMap: slo-error-budget-dashboard
    └── slo-error-budget.json --> /etc/grafana/dashboards/
```

---

## 3. Các bước Triển khai Chi tiết (Step-by-Step Walkthrough)

### Bước 1: Khai báo Datasources as Code

Tạo ConfigMap chứa khai báo 3 datasources chuẩn của platform với cấu hình liên kết chéo Trace-to-Log:
- **Prometheus:** Trỏ tới Service nội bộ `prometheus-kube-prometheus-prometheus.monitoring.svc.cluster.local:9090`.
- **Loki:** Trỏ tới `loki-gateway.monitoring.svc.cluster.local:80` kèm `derivedFields` trích xuất `trace_id` dẫn sang Tempo.
- **Tempo:** Trỏ tới `tempo.monitoring.svc.cluster.local:3200` kèm `tracesToLogs` liên kết ngược sang Loki.

Chạy lệnh 1-shot sau trên AWS CloudShell:

```bash
cat << 'EOF' | kubectl apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-datasources
  namespace: monitoring
  labels:
    app.kubernetes.io/name: grafana
data:
  datasources.yaml: |
    apiVersion: 1
    datasources:
      - name: Prometheus
        type: prometheus
        access: proxy
        url: http://prometheus-kube-prometheus-prometheus.monitoring.svc.cluster.local:9090
        isDefault: true
        editable: false

      - name: Loki
        type: loki
        access: proxy
        url: http://loki-gateway.monitoring.svc.cluster.local
        uid: loki
        editable: false
        jsonData:
          derivedFields:
            - datasourceUid: tempo
              matcherRegex: "trace_id=(\\w+)"
              name: TraceID
              url: '$${__value.raw}'

      - name: Tempo
        type: tempo
        access: proxy
        url: http://tempo.monitoring.svc.cluster.local:3200
        uid: tempo
        editable: false
        jsonData:
          tracesToLogs:
            datasourceUid: loki
            filterByTraceID: true
            spanStartTimeShift: '-5m'
            spanEndTimeShift: '5m'
EOF
```

---

### Bước 2: Khai báo Dashboard Provider & SRE SLO Dashboard as Code

Tạo Provider chỉ định Grafana tự động nạp toàn bộ dashboard JSON từ thư mục `/etc/grafana/dashboards`:

```bash
cat << 'EOF' | kubectl apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-dashboard-provider
  namespace: monitoring
  labels:
    app.kubernetes.io/name: grafana
data:
  provider.yaml: |
    apiVersion: 1
    providers:
      - name: 'sre-platform-dashboards'
        orgId: 1
        folder: 'SRE Platform'
        type: file
        disableDeletion: false
        updateIntervalSeconds: 10
        allowUiUpdates: true
        options:
          path: /etc/grafana/dashboards
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: slo-error-budget-dashboard
  namespace: monitoring
  labels:
    app.kubernetes.io/name: grafana
data:
  slo-error-budget.json: |
    {
      "title": "SRE — Golden Signals & Error Budget",
      "tags": ["sre", "slo", "golden-signals"],
      "timezone": "browser",
      "refresh": "10s",
      "schemaVersion": 38,
      "panels": [
        {
          "id": 1,
          "title": "Availability SLI (Target: >= 99.9%)",
          "type": "gauge",
          "gridPos": { "h": 6, "w": 6, "x": 0, "y": 0 },
          "fieldConfig": {
            "defaults": {
              "min": 90,
              "max": 100,
              "unit": "percent",
              "thresholds": {
                "mode": "absolute",
                "steps": [
                  { "color": "red", "value": null },
                  { "color": "yellow", "value": 99.0 },
                  { "color": "green", "value": 99.9 }
                ]
              }
            }
          },
          "targets": [
            {
              "datasource": { "type": "prometheus", "uid": "prometheus" },
              "expr": "(1 - (sum(rate(otel_http_server_duration_milliseconds_count{http_status_code=~\"5..\"}[30d])) or sum(rate(http_requests_total{status=~\"5..\"}[30d])) or vector(0)) / (sum(rate(otel_http_server_duration_milliseconds_count[30d])) or sum(rate(http_requests_total[30d])) or vector(1))) * 100",
              "legendFormat": "SLI Availability"
            }
          ]
        },
        {
          "id": 2,
          "title": "Remaining Error Budget (%)",
          "type": "stat",
          "gridPos": { "h": 6, "w": 6, "x": 6, "y": 0 },
          "fieldConfig": {
            "defaults": {
              "min": 0,
              "max": 100,
              "unit": "percent",
              "thresholds": {
                "mode": "absolute",
                "steps": [
                  { "color": "red", "value": null },
                  { "color": "yellow", "value": 20 },
                  { "color": "green", "value": 50 }
                ]
              }
            }
          },
          "targets": [
            {
              "datasource": { "type": "prometheus", "uid": "prometheus" },
              "expr": "clamp_min((1 - ((sum(increase(otel_http_server_duration_milliseconds_count{http_status_code=~\"5..\"}[30d])) or sum(increase(http_requests_total{status=~\"5..\"}[30d])) or vector(0)) / (((sum(increase(otel_http_server_duration_milliseconds_count[30d])) or sum(increase(http_requests_total[30d])) or vector(1))) * 0.001))) * 100, 0)",
              "legendFormat": "Remaining Budget"
            }
          ]
        },
        {
          "id": 3,
          "title": "Total Request Rate (RPS)",
          "type": "stat",
          "gridPos": { "h": 6, "w": 6, "x": 12, "y": 0 },
          "fieldConfig": {
            "defaults": {
              "unit": "reqps",
              "color": { "mode": "palette-classic" }
            }
          },
          "targets": [
            {
              "datasource": { "type": "prometheus", "uid": "prometheus" },
              "expr": "sum(rate(otel_http_server_duration_milliseconds_count[1m])) or sum(rate(http_requests_total[1m])) or vector(0)",
              "legendFormat": "Total RPS"
            }
          ]
        },
        {
          "id": 4,
          "title": "HTTP 5xx Error Rate",
          "type": "stat",
          "gridPos": { "h": 6, "w": 6, "x": 18, "y": 0 },
          "fieldConfig": {
            "defaults": {
              "unit": "reqps",
              "thresholds": {
                "mode": "absolute",
                "steps": [
                  { "color": "green", "value": null },
                  { "color": "red", "value": 0.1 }
                ]
              }
            }
          },
          "targets": [
            {
              "datasource": { "type": "prometheus", "uid": "prometheus" },
              "expr": "sum(rate(otel_http_server_duration_milliseconds_count{http_status_code=~\"5..\"}[1m])) or sum(rate(http_requests_total{status=~\"5..\"}[1m])) or vector(0)",
              "legendFormat": "5xx RPS"
            }
          ]
        },
        {
          "id": 5,
          "title": "Current Error Budget Burn Rate (1h Window)",
          "type": "timeseries",
          "gridPos": { "h": 8, "w": 12, "x": 0, "y": 6 },
          "fieldConfig": {
            "defaults": {
              "unit": "short",
              "thresholds": {
                "mode": "absolute",
                "steps": [
                  { "color": "green", "value": null },
                  { "color": "orange", "value": 1.0 },
                  { "color": "red", "value": 14.4 }
                ]
              }
            }
          },
          "targets": [
            {
              "datasource": { "type": "prometheus", "uid": "prometheus" },
              "expr": "((sum(rate(otel_http_server_duration_milliseconds_count{http_status_code=~\"5..\"}[1h])) or sum(rate(http_requests_total{status=~\"5..\"}[1h])) or vector(0)) / (sum(rate(otel_http_server_duration_milliseconds_count[1h])) or sum(rate(http_requests_total[1h])) or vector(1))) / 0.001",
              "legendFormat": "Burn Rate (1h Window)"
            }
          ]
        },
        {
          "id": 6,
          "title": "HTTP Latency Quantiles (p50, p90, p95, p99)",
          "type": "timeseries",
          "gridPos": { "h": 8, "w": 12, "x": 12, "y": 6 },
          "fieldConfig": {
            "defaults": {
              "unit": "s"
            }
          },
          "targets": [
            {
              "datasource": { "type": "prometheus", "uid": "prometheus" },
              "expr": "(histogram_quantile(0.99, sum(rate(otel_http_server_duration_milliseconds_bucket[5m])) by (le)) / 1000) or histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))",
              "legendFormat": "p99 Latency"
            },
            {
              "datasource": { "type": "prometheus", "uid": "prometheus" },
              "expr": "(histogram_quantile(0.95, sum(rate(otel_http_server_duration_milliseconds_bucket[5m])) by (le)) / 1000) or histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))",
              "legendFormat": "p95 Latency"
            },
            {
              "datasource": { "type": "prometheus", "uid": "prometheus" },
              "expr": "(histogram_quantile(0.50, sum(rate(otel_http_server_duration_milliseconds_bucket[5m])) by (le)) / 1000) or histogram_quantile(0.50, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))",
              "legendFormat": "p50 Latency"
            }
          ]
        }
      ]
    }
EOF
```

---

### Bước 3: Triển khai Grafana Server

Triển khai Grafana Deployment và Service, tự động gắn kết các ConfigMaps:

```bash
cat << 'EOF' | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: grafana
  namespace: monitoring
  labels:
    app.kubernetes.io/name: grafana
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: grafana
  template:
    metadata:
      labels:
        app.kubernetes.io/name: grafana
    spec:
      containers:
        - name: grafana
          image: grafana/grafana:10.4.0
          ports:
            - name: http
              containerPort: 3000
          env:
            - name: GF_SECURITY_ADMIN_USER
              value: "admin"
            - name: GF_SECURITY_ADMIN_PASSWORD
              value: "admin123"
            - name: GF_USERS_ALLOW_SIGN_UP
              value: "false"
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 512Mi
          volumeMounts:
            - name: datasources
              mountPath: /etc/grafana/provisioning/datasources
            - name: dashboard-provider
              mountPath: /etc/grafana/provisioning/dashboards
            - name: dashboards
              mountPath: /etc/grafana/dashboards
      volumes:
        - name: datasources
          configMap:
            name: grafana-datasources
        - name: dashboard-provider
          configMap:
            name: grafana-dashboard-provider
        - name: dashboards
          configMap:
            name: slo-error-budget-dashboard
---
apiVersion: v1
kind: Service
metadata:
  name: grafana
  namespace: monitoring
  labels:
    app.kubernetes.io/name: grafana
spec:
  ports:
    - name: http
      port: 80
      targetPort: 3000
  selector:
    app.kubernetes.io/name: grafana
EOF

# Chờ Pod Grafana sẵn sàng
kubectl rollout status deployment/grafana -n monitoring --timeout=60s
```

---

### Bước 4: Xác minh Trạng thái & API Grafana (Verification)

Kiểm tra Pod và truy vấn trực tiếp vào API Datasources và Dashboards của Grafana:

```bash
# 1. Kiểm tra Pod Grafana
kubectl get pods -n monitoring -l app.kubernetes.io/name=grafana

# 2. Kiểm tra API Health của Grafana
kubectl run grafana-test --rm -i --tty --image=curlimages/curl --restart=Never -- \
  curl -s http://grafana.monitoring.svc.cluster.local/api/health

# 3. Kiểm tra danh sách Datasources đã được Provisioning tự động
kubectl run grafana-ds-test --rm -i --tty --image=curlimages/curl --restart=Never -- \
  curl -s -u admin:admin123 http://grafana.monitoring.svc.cluster.local/api/datasources | grep -o '"name":"[^"]*"'

# 4. Kiểm tra Dashboard SRE đã được nạp tự động
kubectl run grafana-db-test --rm -i --tty --image=curlimages/curl --restart=Never -- \
  curl -s -u admin:admin123 http://grafana.monitoring.svc.cluster.local/api/search | grep -o '"title":"[^"]*"'
```

---

### Bước 5: Triển khai Ingress chia sẻ ALB (Host: grafana.dev.devopsss.site)

Để truy cập trực tiếp Grafana qua HTTPS trên Internet mà **không tốn thêm chi phí tạo ALB mới**, chúng ta sử dụng tính năng **ALB Ingress Grouping** (`alb.ingress.kubernetes.io/group.name: sre-platform`), chia sẻ chung Application Load Balancer với **Argo CD** (`argocd.dev.devopsss.site`) và **Reliability Shop** (`shop.dev.devopsss.site`).

```bash
cat << 'EOF' | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: grafana-ingress
  namespace: monitoring
  labels:
    app.kubernetes.io/name: grafana
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/group.name: sre-platform
    alb.ingress.kubernetes.io/group.order: "30"
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/security-groups: sg-067f16ca5bd986a83
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:ap-southeast-1:620306387033:certificate/6af0c1dd-cbf4-4560-84b7-51e7cda7a69a
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}, {"HTTPS": 443}]'
    alb.ingress.kubernetes.io/ssl-redirect: "443"
    alb.ingress.kubernetes.io/healthcheck-path: /api/health
    alb.ingress.kubernetes.io/healthcheck-protocol: HTTP
    alb.ingress.kubernetes.io/healthcheck-interval-seconds: "15"
    alb.ingress.kubernetes.io/healthcheck-timeout-seconds: "5"
    alb.ingress.kubernetes.io/healthy-threshold-count: "2"
    alb.ingress.kubernetes.io/unhealthy-threshold-count: "2"
    alb.ingress.kubernetes.io/success-codes: "200"
spec:
  ingressClassName: alb
  rules:
    - host: grafana.dev.devopsss.site
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: grafana
                port:
                  number: 80
EOF
```

---

### Bước 6: Truy cập Giao diện Grafana Web UI

Bạn có thể truy cập Grafana theo 2 cách:

1. **Truy cập trực tiếp qua HTTPS (Khuyến nghị):**
   - URL: **`https://grafana.dev.devopsss.site`**
   - Đăng nhập: tài khoản `admin` / mật khẩu `admin123`.

2. **Truy cập nội bộ qua Port-Forward (Nếu cần debug):**
   ```bash
   kubectl port-forward svc/grafana -n monitoring 3000:80
   ```
   - Mở trình duyệt tại `http://localhost:3000`.

**Các bước khám phá SRE trên giao diện Grafana:**
- Vào menu **Dashboards** -> thư mục **SRE Platform** -> mở dashboard **SRE — Golden Signals & Error Budget**:
  - Xác nhận bảng **Availability SLI** và **Remaining Error Budget (%)** hiển thị trực quan.
  - Xác nhận **Total Request Rate** và **HTTP 5xx Error Rate** sẵn sàng tiếp nhận metrics từ microservices.
- Vào menu **Explore**:
  - Chọn datasource **Tempo** -> Run Query để khám phá traces.
  - Nhấp vào một span -> nhấp link **Loki logs** để nhảy thẳng sang luồng logs tương ứng với cùng `trace_id`.

---

## 5. Bằng chứng Thực tế (Evidence & Verification Output)

*Kết quả sau khi triển khai và kiểm thử thực tế trên EKS Cluster:*

```bash
[k8s: sre-platform-dev] ~ $ kubectl get ingress -n monitoring grafana-ingress
NAME              CLASS   HOSTS                      ADDRESS                                                                  PORTS   AGE
grafana-ingress   alb     grafana.dev.devopsss.site  k8s-sreplatform-5136128a97-1808240041.ap-southeast-1.elb.amazonaws.com   80      1m

[k8s: sre-platform-dev] ~ $ curl -s -i https://grafana.dev.devopsss.site/api/health
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8

{
  "commit": "03f502a94d17f7dc4e6c34acdf8428aedd986e4c",
  "database": "ok",
  "version": "10.4.0"
}
```

[k8s: sre-platform-dev] ~ $ kubectl run grafana-ds-test --rm -i --tty --image=curlimages/curl --restart=Never -- curl -s -u admin:admin123 http://grafana.monitoring.svc.cluster.local/api/datasources | grep -o '"name":"[^"]*"'
"name":"Loki"
"name":"TraceID"
"name":"Prometheus"
"name":"Tempo"

[k8s: sre-platform-dev] ~ $ kubectl run grafana-db-test --rm -i --tty --image=curlimages/curl --restart=Never -- curl -s -u admin:admin123 http://grafana.monitoring.svc.cluster.local/api/search | grep -o '"title":"[^"]*"'
"title":"SRE Platform"
"title":"SRE — Golden Signals & Error Budget"
```

---

## 6. Điều kiện hoàn thành Gate (SRE Gate Check)

- [x] Grafana kết nối thành công tới cả 3 datasources: Prometheus, Loki, Tempo.
- [x] Dashboard SRE Golden Signals và Error Budget nạp tự động qua ConfigMap mà không cần import thủ công (Zero Click Provisioning).
- [x] Tính năng liên kết Trace-to-Log hoạt động trơn tru qua `trace_id`.
- [x] Sẵn sàng cung cấp số liệu trực quan cho các bài kiểm thử tải k6 ở Module 09.

---

## 7. Dọn dẹp tài nguyên (Cleanup)

- Duy trì stack Grafana để phục vụ việc quan sát xuyên suốt toàn bộ các pha thử nghiệm còn lại của nền tảng SRE.
- Khi cần xóa toàn bộ hạ tầng monitoring trong kịch bản hủy lab:
  ```bash
  kubectl delete deployment/grafana service/grafana -n monitoring --ignore-not-found
  kubectl delete configmap grafana-datasources grafana-dashboard-provider slo-error-budget-dashboard -n monitoring --ignore-not-found
  ```
