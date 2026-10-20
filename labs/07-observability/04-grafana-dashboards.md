# 04.04 — Xây dựng Bảng điều khiển Grafana Dashboards Chuẩn SRE (Golden Signals & Error Budget)

> **Trạng thái:** Hướng dẫn thực hành chi tiết cấu hình Grafana Provisioning và Dashboards as Code.  
> **Áp dụng cho:** Trực quan hóa 4 Tín hiệu Vàng (Golden Signals), giám sát tiêu hao Ngân sách Lỗi (Error Budget Burn Rate) và điều tra sự cố hợp nhất.

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Khai báo Datasources tự động trong Grafana: **Prometheus** (Metrics), **Loki** (Logs) và **Tempo** (Traces).
  - Triển khai bộ 2 Dashboards cốt lõi của SRE:
    1. **SRE Golden Signals Dashboard (RED & USE):** Theo dõi Rate (RPS), Errors (5xx), Duration (p50/p95/p99) ở tầng dịch vụ và Utilization, Saturation ở tầng hạ tầng.
    2. **SLO & Error Budget Dashboard:** Hiển thị phần trăm ngân sách lỗi còn lại (Remaining Budget), tốc độ đốt ngân sách (Burn Rate), và dự báo thời gian cạn kiệt ngân sách (Time to Exhaustion).
  - Kích hoạt tính năng **Tempo-to-Loki Derived Fields** để nhấp trực tiếp từ một span trong Trace sang xem log tương ứng trong Loki.
- **Nguyên tắc SRE:**
  - **Dashboards as Code (DaC):** Không tạo dashboard thủ công bằng cách bấm nhấp rồi để thất lạc cấu hình; mọi bảng điều khiển phải được định nghĩa bằng JSON và tự động nạp qua GitOps (Grafana Provisioning).
  - **Single Pane of Glass (Giao diện Hợp nhất):** Một sự cố phải được nhìn nhận đa chiều trên cùng một màn hình: Từ triệu chứng người dùng (Latency tăng) -> Lỗi ứng dụng (Log Exception) -> Điểm nghẽn phân tán (Trace Span ở Database).
  - **Glanceable Status in Under 5 Seconds:** Kỹ sư On-call chỉ cần nhìn vào dashboard trong 5 giây là biết ngay hệ thống đang xanh (Healthy) hay đang đốt Error Budget (Degraded).

---

## 2. Kiến trúc Provisioning Tự động của Grafana

```text
gitops/platform/monitoring/grafana/
├── datasources/
│   └── datasources.yaml       # Tự động nạp Prometheus, Loki, Tempo
└── dashboards/
    ├── dashboard-provider.yaml
    ├── golden-signals.json    # RED & USE Metrics
    └── slo-error-budget.json  # SLI/SLO & Burn Rate
```

---

## 3. Các bước Khai báo Chi tiết (Manifest Walkthrough)

### Bước 1: Khai báo Datasources Tự động (Datasources as Code)

Tạo file `observability/grafana/datasources.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-datasources
  namespace: monitoring
  labels:
    grafana_datasource: "1"
data:
  datasources.yaml: |
    apiVersion: 1
    datasources:
      - name: Prometheus
        type: prometheus
        access: proxy
        url: http://prometheus-k8s.monitoring.svc.cluster.local:9090
        isDefault: true
        editable: false

      - name: Loki
        type: loki
        access: proxy
        url: http://loki-gateway.monitoring.svc.cluster.local
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
            datasourceUid: Loki
            filterByTraceID: true
            spanStartTimeShift: '-5m'
            spanEndTimeShift: '5m'
```

---

### Bước 2: Khai báo SLO & Error Budget Dashboard

Tạo file `observability/grafana/slo-dashboard-configmap.yaml` chứa các panels SRE trọng yếu:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: slo-error-budget-dashboard
  namespace: monitoring
  labels:
    grafana_dashboard: "1"
data:
  slo-error-budget.json: |
    {
      "title": "SRE — Order API SLO & Error Budget",
      "refresh": "10s",
      "panels": [
        {
          "title": "Availability SLI (Target: >= 99.9%)",
          "type": "gauge",
          "gridPos": { "h": 6, "w": 6, "x": 0, "y": 0 },
          "targets": [
            {
              "expr": "(1 - (sum(rate(http_requests_total{service=\"order-service\", status=~\"5..\"}[30d])) / sum(rate(http_requests_total{service=\"order-service\"}[30d])))) * 100"
            }
          ]
        },
        {
          "title": "Remaining Error Budget (%)",
          "type": "stat",
          "gridPos": { "h": 6, "w": 6, "x": 6, "y": 0 },
          "targets": [
            {
              "expr": "(1 - (sum(increase(http_requests_total{service=\"order-service\", status=~\"5..\"}[30d])) / (sum(increase(http_requests_total{service=\"order-service\"}[30d])) * 0.001))) * 100"
            }
          ]
        },
        {
          "title": "Current Error Budget Burn Rate (1h Window)",
          "type": "timeseries",
          "gridPos": { "h": 8, "w": 12, "x": 0, "y": 6 },
          "targets": [
            {
              "expr": "(sum(rate(http_requests_total{service=\"order-service\", status=~\"5..\"}[1h])) / sum(rate(http_requests_total{service=\"order-service\"}[1h]))) / 0.001",
              "legendFormat": "Burn Rate (1h)"
            }
          ]
        },
        {
          "title": "HTTP Latency Quantiles (p50, p90, p95, p99)",
          "type": "timeseries",
          "gridPos": { "h": 8, "w": 12, "x": 12, "y": 6 },
          "targets": [
            {
              "expr": "histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{service=\"order-service\"}[5m])) by (le))",
              "legendFormat": "p99 Latency"
            },
            {
              "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{service=\"order-service\"}[5m])) by (le))",
              "legendFormat": "p95 Latency"
            },
            {
              "expr": "histogram_quantile(0.50, sum(rate(http_request_duration_seconds_bucket{service=\"order-service\"}[5m])) by (le))",
              "legendFormat": "p50 Latency"
            }
          ]
        }
      ]
    }
```

Áp dụng vào cluster:
```bash
kubectl apply -f observability/grafana/datasources.yaml
kubectl apply -f observability/grafana/slo-dashboard-configmap.yaml
```

---

## 4. Xác minh và Khám phá trên Grafana Web UI (Verification)

Mở Port-Forward tới Grafana Server:

```bash
kubectl port-forward svc/grafana -n monitoring 3000:80
```

1. Mở trình duyệt tại `http://localhost:3000` (Đăng nhập: `admin` / mật khẩu quản trị).
2. Kiểm tra **Connections** -> **Data sources**:
   - Xác nhận có đủ 3 datasources: `Prometheus` (Default), `Loki`, và `Tempo`.
   - Nhấp vào từng datasource -> Nhấp nút **Save & test** ở cuối trang -> Nhận thông báo màu xanh `Data source is working`.
3. Kiểm tra **Dashboards** -> Mở dashboard **SRE — Order API SLO & Error Budget**:
   - Gauge **Availability SLI** hiển thị trên 99.9%.
   - Stat **Remaining Error Budget** hiển thị 100% (chưa có lỗi).
   - Biểu đồ **HTTP Latency** hiển thị các đường phân vị p50, p95, p99 theo thời gian thực.

---

## 5. Thử nghiệm Điều tra Xuyên Suốt (Trace-to-Log Correlation Drill)

1. Trong Grafana, vào menu **Explore** -> Chọn datasource **Tempo**.
2. Nhấp nút **Run query** để tải danh sách các trace gần nhất.
3. Nhấp vào một Trace ID cụ thể để mở sơ đồ thác nước (Waterfall Span Graph).
4. Nhấp vào một span của `order-service` -> Kéo xuống mục **Logs for this span**:
   - Nhấp nút **Loki logs**:
   - Grafana tự động mở cửa sổ bên cạnh (Split View), truyền `trace_id` vào LogQL và hiển thị chính xác các dòng log sinh ra trong quá trình xử lý span đó!

---

## 6. Điều kiện hoàn thành Gate (Gate Check)

- [ ] Grafana kết nối thành công tới cả 3 datasources: Prometheus, Loki, Tempo.
- [ ] Dashboard SRE Golden Signals và Error Budget nạp tự động qua ConfigMap mà không cần import thủ công.
- [ ] Tính năng liên kết Trace-to-Log hoạt động trơn tru qua `trace_id`.
- [ ] Sẵn sàng cung cấp số liệu trực quan cho các bài kiểm thử tải k6 ở Module 09.

---

## 7. Dọn dẹp tài nguyên (Cleanup)

- Duy trì stack Grafana để phục vụ việc quan sát xuyên suốt toàn bộ các pha thử nghiệm còn lại của nền tảng.
