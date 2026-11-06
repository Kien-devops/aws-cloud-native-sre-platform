# Observability & Monitoring Platform GitOps

**Metrics, logs, traces và dashboards trong một điểm nạp GitOps.**

[GitOps](../../README.md) / [Platform](../README.md) / Monitoring · [Cấu hình tham khảo](../../../observability/README.md)

> [!IMPORTANT]
> Tiền tố `00`–`07` phục vụ điều hướng, không bảo đảm thứ tự readiness. Loki/Tempo hiện dùng `emptyDir`; dữ liệu mất khi Pod được thay thế. Prometheus Operator/CRD và ESO là prerequisite bên ngoài module.

## 1. Tổng quan & Triết lý Thiết kế

Thư mục này quản lý toàn bộ hạ tầng **Giám sát & Khả năng quan sát (Observability)** của nền tảng EKS theo chuẩn GitOps.

Tên file được nhóm theo trách nhiệm. Sơ đồ dưới thể hiện dependency logic để kiểm tra khi bootstrap:

```
[00-Namespace]
      │
      ▼
[01-Secrets] (AWS Secrets Manager)
      │
      ▼
[02-Agent thu thập] (OTel Collector)
      │
      ▼
[03-Storage Backends] (Loki & Tempo)
      │
      ▼
[04-Dashboards Config] ──► [05-Grafana Core] ──► [06-ALB Ingress]
                                                         │
                                                         ▼
                                            [07-Prometheus Rules]
```

---

## 2. Giải thích chi tiết từng File (Mỗi file làm gì?)

| Thứ tự | Tên File | Thành phần (Kind) | Chức năng & Vai trò trong hệ thống |
| :---: | :--- | :--- | :--- |
| **00** | [`00-namespace.yaml`](00-namespace.yaml) | `Namespace` | Khởi tạo không gian tên cô lập `monitoring` và gán nhãn nhận diện `app.kubernetes.io/part-of: sre-platform`. Mọi tài nguyên khác đều phải nằm trong namespace này. |
| **01** | [`01-grafana-secret.yaml`](01-grafana-secret.yaml) | `ExternalSecret` | Tự động đồng bộ tài khoản và mật khẩu admin của Grafana từ AWS Secrets Manager (`/sre-platform/dev/grafana/credentials`) về Kubernetes Secret `grafana-admin-credentials`. **Không lưu mật khẩu dạng plaintext trên Git**. |
| **02** | [`02-otel-collector.yaml`](02-otel-collector.yaml) | `ConfigMap`<br>`Deployment`<br>`Service` | Trạm thu thập dữ liệu trung tâm (Telemetry Hub):<br>• Nhận dữ liệu Traces/Metrics/Logs từ microservices qua cổng OTLP `4317` (gRPC) và `4318` (HTTP).<br>• Lọc bỏ dữ liệu nhạy cảm (redact JWT Bearer tokens, passwords).<br>• Đẩy Traces tới Tempo, Logs tới Loki, và mở cổng `8889` cho Prometheus cào Metrics. |
| **03** | [`03-loki-tempo.yaml`](03-loki-tempo.yaml) | `ConfigMap`<br>`Deployment`<br>`Service` | Hệ thống lưu trữ dữ liệu chuyên dụng:<br>• **Grafana Loki:** Lưu trữ log phân tán, hỗ trợ truy vấn LogQL.<br>• **Grafana Tempo:** Lưu trữ vết phân tán (Distributed Traces), hỗ trợ truy vấn TraceQL. |
| **04** | [`04-grafana-dashboards.yaml`](04-grafana-dashboards.yaml) | `ConfigMap` | Cấu hình Dashboards as Code:<br>• Tự động đăng ký 3 Data Sources: Prometheus, Loki, Tempo (tích hợp tính năng Trace-to-Logs và Derived Fields qua TraceID).<br>• Tự động nạp sẵn Dashboard **SRE — Golden Signals & Error Budget** mà không cần cấu hình bằng tay trên UI. |
| **05** | [`05-grafana-core.yaml`](05-grafana-core.yaml) | `Deployment`<br>`Service` | Instance máy chủ Grafana (v10.4.0):<br>• Đọc thông tin đăng nhập trực tiếp từ Secret `grafana-admin-credentials` (tạo từ bước 01).<br>• Mount tự động các ConfigMaps dashboards từ bước 04. |
| **06** | [`06-grafana-ingress.yaml`](06-grafana-ingress.yaml) | `Ingress` | Cung cấp định tuyến bên ngoài qua AWS Application Load Balancer (ALB):<br>• Tham gia chung nhóm ALB `sre-platform` (Group order: 30) cùng với Argo CD và Reliability Shop để tối ưu chi phí.<br>• Tự động chuyển hướng HTTP sang HTTPS, gắn chứng chỉ ACM cho tên miền `grafana.dev.devopsss.site`. |
| **07** | [`07-prometheus-rules.yaml`](07-prometheus-rules.yaml) | `ServiceMonitor`<br>`PrometheusRule`<br>`AlertmanagerConfig` | Giám sát & Cảnh báo SRE thông minh:<br>• `ServiceMonitor`: Hướng dẫn Prometheus định kỳ 15s cào metric OTel Collector.<br>• `PrometheusRule`: Cảnh báo **Multi-Window Multi-Burn-Rate** khi tốc độ đốt Error Budget vượt ngưỡng quy định (14.4x cho Critical, 6x cho Warning).<br>• `AlertmanagerConfig`: Định tuyến cảnh báo đến Webhook/Pager. |

---

## 3. Lợi ích khi tổ chức theo cấu trúc này

1. **Dễ đọc & Dễ tìm:** Nhìn vào danh sách file là biết ngay file nào làm việc gì, không bị lẫn lộn giữa cấu hình Grafana lõi với Dashboards JSON.
2. **Review Git Diff rõ ràng:** Khi bạn thêm sửa một bảng điều khiển (Dashboard) mới, Git chỉ thay đổi file `04-grafana-dashboards.yaml`, hoàn toàn không ảnh hưởng tới Deployment (`05-grafana-core.yaml`) hay Ingress (`06-grafana-ingress.yaml`).
3. **Dependency dễ nhận diện:** Khi bootstrap, kiểm tra CRD, secret và backend readiness riêng; Kustomize không chờ từng file sẵn sàng trước khi xử lý file kế tiếp.

---

## 4. Kiểm tra & Vận hành

### Render kiểm tra cú pháp cục bộ:
```powershell
kubectl kustomize gitops/platform/monitoring
```

### Kiểm tra trạng thái hoạt động trên EKS:
```powershell
# Kiểm tra Pods
kubectl get pods -n monitoring

# Kiểm tra Ingress
kubectl get ingress -n monitoring

# Kiểm tra đồng bộ Secret từ AWS Secrets Manager
kubectl get externalsecret -n monitoring
```
