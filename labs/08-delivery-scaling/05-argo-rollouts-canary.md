# 08.05 — Phát hành An toàn theo Chiến lược Canary với Argo Rollouts và Phân tích Metric Tự động

> **Trạng thái:** Hướng dẫn thực hành chi tiết cấu hình Argo Rollouts và Prometheus AnalysisTemplate.  
> **Áp dụng cho:** Phát hành phiên bản ứng dụng từng bước (Canary Progressive Delivery) và tự động dừng phát hành nếu vi phạm chỉ số SLO.

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Thay thế Kubernetes `Deployment` thông thường bằng đối tượng **Argo Rollouts (`Rollout`)** cho microservice `order-service`.
  - Cấu hình chiến lược phân luồng lưu lượng từng bước (**Weighted Canary Strategy**): `5%` -> Tạm dừng 2 phút để phân tích -> `20%` -> Tạm dừng 5 phút -> `50%` -> `100%`.
  - Tích hợp **AnalysisTemplate**: Tự động truy vấn Prometheus cứ sau mỗi 30 giây để đo đạc hai tiêu chí cốt lõi:
    1. **Tỷ lệ thành công (Success Rate):** `>= 99.5%` (Error Rate `<= 0.5%`).
    2. **Độ trễ phân vị p95:** `< 300ms`.
  - Tự động quyết định thăng cấp (**Auto-Promotion**) nếu toàn bộ bài kiểm tra đạt chỉ tiêu, hoặc tự động hủy bỏ (**Auto-Abort / Instant Rollback**) đưa 100% traffic về phiên bản cũ nếu phát hiện lỗi.
- **Nguyên tắc SRE:**
  - **Blast Radius Reduction:** Khi một phiên bản mới có bug ẩn, chỉ tối đa 5% người dùng bị ảnh hưởng trong vòng vài phút trước khi hệ thống tự động phát hiện và ngăn chặn.
  - **Objective Decision Making (Không phán đoán bằng cảm tính):** Quyết định promote hay rollback phiên bản mới hoàn toàn dựa vào số liệu máy tính đo đạc từ Prometheus, loại bỏ hoàn toàn yếu tố chủ quan của con người.
  - **Zero Downtime During Traffic Shift:** Sử dụng 2 Kubernetes Services riêng biệt (`order-service-stable` và `order-service-canary`) để điều tiết traffic mượt mà.

---

## 2. Sơ đồ Luồng Chuyển dịch Lưu lượng Canary

```text
       Ingress / ALB
             |
     +-------+-------+
     |               |
   (95%)            (5%)
     |               |
     v               v
 [ Stable Service ] [ Canary Service ]
 (Version 1.0.0)    (Version 1.1.0 - New)
     |               |
     v               v
  [ Pods v1 ]     [ Pods v2 ]
                     |
         [ AnalysisTemplate ] <--- Quét Prometheus liên tục
         - Error Rate <= 0.5%?
         - p95 Latency <= 300ms?
                     |
         +-----------+-----------+
         | (Đạt)                 | (Lỗi)
         v                       v
     Tăng 20% -> 50%       Auto-Abort & Rollback
```

---

## 3. Các bước Khai báo Chi tiết (Manifest Walkthrough)

### Bước 1: Khai báo `AnalysisTemplate` Đánh giá Chất lượng Phiên bản

Tạo file `gitops/applications/reliability-shop/base/order-service/analysis-template.yaml`:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: order-success-rate-check
  namespace: reliability-shop
spec:
  metrics:
    # CHỈ SỐ 1: TỶ LỆ LỖI KHÔNG QUÁ 0.5%
    - name: error-rate-check
      interval: 30s
      successCondition: result[0] <= 0.005
      failureLimit: 2 # Thất bại 2 lần liên tiếp thì kích hoạt Abort ngay lập tức
      provider:
        prometheus:
          address: http://prometheus-k8s.monitoring.svc.cluster.local:9090
          query: |
            sum(rate(http_requests_total{service="order-service", status=~"5.."}[1m]))
            /
            sum(rate(http_requests_total{service="order-service"}[1m]))

    # CHỈ SỐ 2: ĐỘ TRỄ P95 KHÔNG QUÁ 300MS
    - name: p95-latency-check
      interval: 30s
      successCondition: result[0] <= 0.300
      failureLimit: 2
      provider:
        prometheus:
          address: http://prometheus-k8s.monitoring.svc.cluster.local:9090
          query: |
            histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{service="order-service"}[1m])) by (le))
```

---

### Bước 2: Khai báo Hai Services (Stable & Canary)

Tạo file `gitops/applications/reliability-shop/base/order-service/rollout-services.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: order-service-stable
  namespace: reliability-shop
spec:
  type: ClusterIP
  ports:
    - port: 8080
      targetPort: 8080
      name: http
  selector:
    app.kubernetes.io/name: order-service
---
apiVersion: v1
kind: Service
metadata:
  name: order-service-canary
  namespace: reliability-shop
spec:
  type: ClusterIP
  ports:
    - port: 8080
      targetPort: 8080
      name: http
  selector:
    app.kubernetes.io/name: order-service
```

---

### Bước 3: Khai báo Đối tượng `Rollout` Thay thế Deployment

Tạo file `gitops/applications/reliability-shop/base/order-service/rollout.yaml`:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: order-service
  namespace: reliability-shop
spec:
  replicas: 4
  strategy:
    canary:
      # LIÊN KẾT TÀI NGUYÊN SERVICES
      stableService: order-service-stable
      canaryService: order-service-canary
      # PHÂN TÍCH TỰ ĐỘNG BẰNG PROMETHEUS TRONG QUÁ TRÌNH PHÁT HÀNH
      analysis:
        templates:
          - templateName: order-success-rate-check
        args:
          - name: service-name
            value: order-service
      # CÁC BƯỚC DỊCH CHUYỂN LƯU LƯỢNG
      steps:
        - setWeight: 5
        - pause: { duration: 2m }
        - setWeight: 20
        - pause: { duration: 5m }
        - setWeight: 50
        - pause: { duration: 10m }
  selector:
    matchLabels:
      app.kubernetes.io/name: order-service
  template:
    metadata:
      labels:
        app.kubernetes.io/name: order-service
    spec:
      containers:
        - name: app
          image: <ACCOUNT_ID>.dkr.ecr.ap-southeast-1.amazonaws.com/reliabilityshop/order-service:git-v1.0.0
          ports:
            - containerPort: 8080
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi
```

Áp dụng vào cluster:
```bash
kubectl apply -f gitops/applications/reliability-shop/base/order-service/analysis-template.yaml
kubectl apply -f gitops/applications/reliability-shop/base/order-service/rollout-services.yaml
kubectl apply -f gitops/applications/reliability-shop/base/order-service/rollout.yaml
```

---

## 4. Xác minh và Theo dõi Tiến trình Canary (Verification)

Sử dụng plugin `kubectl argo rollouts` từ terminal để theo dõi trực quan:

```bash
# Theo dõi trực tiếp trạng thái của Rollout
kubectl argo rollouts get rollout order-service -n reliability-shop --watch
```

**Giao diện hiển thị trực quan trong Terminal:**
```text
NAME                                         KIND        STATUS     AGE  INFO
⟳ order-service                              Rollout     Progressing 1m   
├──# revision:2                                                              
│  ├──⧉ order-service-75b48bc4b              ReplicaSet  Healthy    10s  canary
│  │  └──□ order-service-75b48bc4b-xxxxx     Pod         Running    10s  ready
│  └──α order-success-rate-check-1           AnalysisRun  Running    5s   ✔ 1
└──# revision:1                                                              
   └──⧉ order-service-68d75474ff             ReplicaSet  Healthy    25m  stable
      ├──□ order-service-68d75474ff-aaaaa    Pod         Running    25m  ready
      ├──□ order-service-68d75474ff-bbbbb    Pod         Running    25m  ready
      └──□ order-service-68d75474ff-ccccc    Pod         Running    25m  ready
```

**Diễn giải:**
- Revision 2 (Canary) nhận 1 Pod tương đương ~5% lưu lượng.
- Phép phân tích `order-success-rate-check` đang chạy kiểm tra Prometheus mỗi 30 giây (ký hiệu `✔ 1`).
- Nếu sau 2 phút phép đo tiếp tục thành công, Rollouts tự động nâng trọng số lên 20%.

---

## 5. Điều kiện hoàn thành Gate (Gate Check)

- [ ] Đối tượng `Rollout` và `AnalysisTemplate` hoạt động bình thường trong namespace `reliability-shop`.
- [ ] Phép đo Prometheus Metric được kích hoạt tự động trong quá trình thăng cấp.
- [ ] Lưu lượng mạng dịch chuyển từng bước chính xác theo các tỷ lệ 5% -> 20% -> 50% -> 100%.

---

## 6. Dọn dẹp tài nguyên (Cleanup)

- Duy trì cấu hình Rollout để thực hiện bài diễn tập Auto-Rollback khi phát hiện phiên bản lỗi ở bài 08.06.
