# 07.02 — Thiết lập Prometheus, ServiceMonitors và Quy tắc Cảnh báo Tốc độ Tiêu hao Ngân sách Lỗi (Burn-Rate Alerting)

> **Trạng thái:** Đã triển khai và kiểm chứng thực tế trên EKS Cluster (DEPLOYED & VERIFIED).<br>
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

## 3. Các bước Khai báo Chi tiết (Step-by-Step Walkthrough)

### Bước 1: Cài đặt Prometheus Stack qua Helm (`kube-prometheus-stack`)

Để sử dụng được các Custom Resources (`ServiceMonitor`, `PrometheusRule`), trước tiên chúng ta triển khai `kube-prometheus-stack` vào namespace `monitoring`:

```bash
# 1. Thêm Helm repo chính thức của Prometheus Community
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# 2. Cài đặt Prometheus và Alertmanager với cấu hình tối ưu tài nguyên cho môi trường Dev
cat << 'EOF' > /tmp/prometheus-values.yaml
prometheus:
  prometheusSpec:
    serviceMonitorSelectorNilUsesHelmValues: false
    podMonitorSelectorNilUsesHelmValues: false
    ruleSelectorNilUsesHelmValues: false
    resources:
      requests:
        cpu: 100m
        memory: 256Mi
      limits:
        cpu: 500m
        memory: 512Mi
alertmanager:
  alertmanagerSpec:
    resources:
      requests:
        cpu: 50m
        memory: 64Mi
      limits:
        cpu: 200m
        memory: 128Mi
# Tạm thời tắt Grafana (Grafana sẽ được triển khai cùng Dashboards as Code ở bài 07.04)
grafana:
  enabled: false
EOF

helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --values /tmp/prometheus-values.yaml
```

---

### Bước 2: Khai báo ServiceMonitor Scrape Metrics từ OTel Collector

Sau khi Operator đã sẵn sàng, chúng ta cấu hình `ServiceMonitor` để Prometheus tự động cào metrics từ cổng `8889` của `otel-collector` cứ mỗi 15 giây:

```bash
cat << 'EOF' | kubectl apply -f -
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
EOF
```

---

### Bước 3: Khai báo Quy tắc Cảnh báo Multi-Burn-Rate (SLO Alert Rules)

Áp dụng quy tắc cảnh báo Google SRE Burn-Rate vào Kubernetes thông qua `PrometheusRule`:

```bash
cat << 'EOF' | kubectl apply -f -
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
            runbook_url: "https://github.com/Kien-devops/aws-cloud-native-sre-platform/blob/main/sre/runbooks/high-error-rate.md"

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
            runbook_url: "https://github.com/Kien-devops/aws-cloud-native-sre-platform/blob/main/sre/runbooks/high-error-rate.md"
EOF
```

---

### Bước 4: Cấu hình Alertmanager Routing và Inhibition Rules

Alertmanager mặc định được cấu hình thông qua Secret hoặc `AlertmanagerConfig`. Dưới đây là cấu hình định tuyến thông báo theo độ nghiêm trọng (`critical` -> On-call, `warning` -> Ticket):

```bash
cat << 'EOF' | kubectl apply -f -
apiVersion: monitoring.coreos.com/v1alpha1
kind: AlertmanagerConfig
metadata:
  name: sre-alert-routing
  namespace: monitoring
  labels:
    release: prometheus
spec:
  route:
    groupBy: ['alertname', 'service', 'severity']
    groupWait: 30s
    groupInterval: 5m
    repeatInterval: 4h
    receiver: 'default-webhook'
    routes:
      - matchers:
          - name: severity
            value: critical
        receiver: 'critical-pager'
  receivers:
    - name: 'default-webhook'
      webhookConfigs:
        - url: 'http://localhost:8080/webhook'
          sendResolved: true
    - name: 'critical-pager'
      webhookConfigs:
        - url: 'http://localhost:8080/pager'
          sendResolved: true
EOF
```

---

## 4. Xác minh Thực tế (Verification)

### 4.1. Kiểm tra trạng thái Pods của Prometheus Stack:
```bash
kubectl get pods -n monitoring -l "app.kubernetes.io/name in (prometheus,alertmanager,prometheus-operator)"
```

**Kỳ vọng:** Các Pod `prometheus-prometheus-kube-prometheus-prometheus-0` và `alertmanager-prometheus-kube-prometheus-alertmanager-0` ở trạng thái `Running` (2/2 READY).

---

### 4.2. Kiểm tra Prometheus Targets cào metrics OTel Collector:
```bash
kubectl run prom-check --rm -i --tty --image=curlimages/curl --restart=Never -- \
  curl -s http://prometheus-operated.monitoring.svc.cluster.local:9090/api/v1/targets | grep -o '"scrapePool":"serviceMonitor/monitoring/otel-collector-monitor/0"[^}]*'
```
**Kỳ vọng:** Trả về `"health":"up"`, xác nhận Prometheus đang cào chỉ số thành công từ `otel-collector:8889`.

---

## 5. Thử nghiệm Bắn Cảnh báo Giả lập (Alert Simulation Drill)

Kiểm tra xem Alertmanager có tiếp nhận và phân loại đúng alert hay không bằng cách gửi một alert giả lập qua API nội bộ:

```bash
kubectl run am-test --rm -i --tty --image=curlimages/curl --restart=Never -- \
  curl -s -X POST http://alertmanager-operated.monitoring.svc.cluster.local:9093/api/v2/alerts \
  -H "Content-Type: application/json" \
  -d '[{
    "labels": {
      "alertname": "SimulatedOutageAlert",
      "service": "order-service",
      "severity": "critical"
    },
    "annotations": {
      "summary": "This is a simulated critical outage test",
      "runbook_url": "https://github.com/Kien-devops/aws-cloud-native-sre-platform/blob/main/sre/runbooks/high-error-rate.md"
    }
  }]'
```

Xác minh alert đã vào bộ nhớ của Alertmanager bằng lệnh:
```bash
kubectl run am-check --rm -i --tty --image=curlimages/curl --restart=Never -- \
  curl -s http://alertmanager-operated.monitoring.svc.cluster.local:9093/api/v2/alerts | grep -o '"alertname":"SimulatedOutageAlert"[^}]*'
```

**Bằng chứng phản hồi thực tế trên CloudShell:**
```text
"alertname":"SimulatedOutageAlert","service":"order-service","severity":"critical"
```
👉 Alertmanager ghi nhận cảnh báo `SimulatedOutageAlert` thành công với nhãn `severity: critical` và gắn kèm link runbook xử lý sự cố.

---

## 6. Điều kiện hoàn thành Gate (Gate Check)

- [x] `kube-prometheus-stack` triển khai thành công trên namespace `monitoring` (Pods Prometheus, Alertmanager, Operator đều `Running`).
- [x] `ServiceMonitor/otel-collector-monitor` được Prometheus nhận diện và scrape endpoint `8889` thành công (`Target UP`).
- [x] `PrometheusRule/reliability-shop-slo-alerts` được nạp đầy đủ (Fast burn 14.4x và Medium burn 6x).
- [x] Alertmanager tiếp nhận và phân loại cảnh báo theo đúng nhãn `severity: critical`.
- [x] Mọi cảnh báo đều có liên kết Runbook hợp lệ phục vụ kỹ sư On-call.

---

## 7. Dọn dẹp tài nguyên (Cleanup)

- Giữ nguyên Prometheus và Alertmanager để phục vụ cho các bài tiếp theo: Grafana Dashboards as Code (07.04) và SLO Testing (09.02).
