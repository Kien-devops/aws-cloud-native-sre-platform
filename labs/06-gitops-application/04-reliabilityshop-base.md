# 06.04 — Xây dựng Khung Manifests Cơ sở (Kustomize Base) cho ReliabilityShop

> **Trạng thái:** Hướng dẫn thực hành chi tiết cấu trúc Kustomize Base chuẩn SRE.  
> **Áp dụng cho:** Định nghĩa kiến trúc microservices cốt lõi (`order-service`, `inventory-service`, `payment-worker`) kèm theo đầy đủ các chỉ tiêu bảo vệ độ tin cậy.

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Khai báo các Kubernetes manifests tiêu chuẩn theo mô hình **Kustomize Base** trong thư mục `gitops/applications/reliability-shop/base/`.
  - Thiết lập đầy đủ các thông số SRE bắt buộc cho từng dịch vụ:
    - **Resource Requests & Limits:** Ngăn ngừa hiện tượng tranh chấp tài nguyên (Noisy Neighbors) và OOMKilled.
    - **Probes Độc lập (Startup, Liveness, Readiness):** Phân tách rõ ràng giữa kiểm tra trạng thái khởi động, phát hiện deadlock (Liveness), và kiểm tra năng lực tiếp nhận traffic (Readiness).
    - **Graceful Shutdown:** Cấu hình `terminationGracePeriodSeconds: 30` và connection draining để không đánh rơi request của khách hàng trong quá trình rolling update.
    - **Topology Spread Constraints:** Bắt buộc Kubernetes phân bổ các replicas đều nhau trên **nhiều Availability Zones** (`maxSkew: 1`).
- **Nguyên tắc SRE:**
  - **No Unbounded Containers:** Mọi container chạy trên cluster bắt buộc phải có `requests.cpu`, `requests.memory` và `limits.memory` được định nghĩa rõ ràng.
  - **Fail-Fast vs. Graceful Handling:** Khởi động nhanh (Fast Startup) nhưng tắt êm dịu (Graceful Draining) để bảo vệ các kết nối TCP và các giao dịch đang dở dang.
  - **DRY (Don't Repeat Yourself) qua Kustomize:** Tầng Base chứa toàn bộ logic kiến trúc; các biến số theo môi trường (replicas, domain, DB host) sẽ được ghi đè ở tầng Overlay.

---

## 2. Cấu trúc Thư mục Kustomize Base

```text
gitops/applications/reliability-shop/base/
├── kustomization.yaml
├── namespace.yaml
├── order-service/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── configmap.yaml
├── inventory-service/
│   ├── deployment.yaml
│   └── service.yaml
└── payment-worker/
    └── deployment.yaml
```

---

## 3. Các bước Khai báo Chi tiết (Manifest Walkthrough)

### Bước 1: Khai báo Namespace có ResourceQuota

Tạo file `gitops/applications/reliability-shop/base/namespace.yaml`:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: reliability-shop
  labels:
    name: reliability-shop
    environment: dev
    managed-by: gitops
```

---

### Bước 2: Khai báo `order-service` Chuẩn SRE

Tạo file `gitops/applications/reliability-shop/base/order-service/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-service
  labels:
    app.kubernetes.io/name: order-service
    app.kubernetes.io/part-of: reliability-shop
spec:
  replicas: 2
  selector:
    matchLabels:
      app.kubernetes.io/name: order-service
  template:
    metadata:
      labels:
        app.kubernetes.io/name: order-service
    spec:
      terminationGracePeriodSeconds: 30
      # PHÂN BỔ ĐA AVAILABILITY ZONE (SRE Resilience)
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: DoNotSchedule
          labelSelector:
            matchLabels:
              app.kubernetes.io/name: order-service
      containers:
        - name: app
          image: <ACCOUNT_ID>.dkr.ecr.ap-southeast-1.amazonaws.com/reliabilityshop/order-service:git-v1.0.0
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 8080
              name: http
          # ĐỊNH NGHĨA TÀI NGUYÊN (SRE Capacity Planning)
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi
          # HEALTH CHECK PROBES ĐỘC LẬP
          startupProbe:
            httpGet:
              path: /health
              port: 8080
            failureThreshold: 15
            periodSeconds: 2
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
            timeoutSeconds: 2
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /ready
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 5
            timeoutSeconds: 2
            successThreshold: 1
            failureThreshold: 2
          # BIẾN MÔI TRƯỜNG & SECRETS
          envFrom:
            - configMapRef:
                name: order-config
            - secretRef:
                name: app-credentials # Được sinh tự động bởi ESO (Module 05)
```

Tạo file `gitops/applications/reliability-shop/base/order-service/service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: order-service
  labels:
    app.kubernetes.io/name: order-service
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

### Bước 3: Khai báo `payment-worker` (Async SQS Consumer)

Tạo file `gitops/applications/reliability-shop/base/payment-worker/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payment-worker
  labels:
    app.kubernetes.io/name: payment-worker
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: payment-worker
  template:
    metadata:
      labels:
        app.kubernetes.io/name: payment-worker
    spec:
      terminationGracePeriodSeconds: 45
      containers:
        - name: worker
          image: <ACCOUNT_ID>.dkr.ecr.ap-southeast-1.amazonaws.com/reliabilityshop/payment-worker:git-v1.0.0
          resources:
            requests:
              cpu: 50m
              memory: 64Mi
            limits:
              cpu: 250m
              memory: 128Mi
          env:
            - name: SQS_QUEUE_URL
              value: "https://sqs.ap-southeast-1.amazonaws.com/<ACCOUNT_ID>/reliability-shop-dev-order-queue"
          envFrom:
            - secretRef:
                name: app-credentials
```

---

### Bước 4: Tạo Tệp `kustomization.yaml` Gốc của Base

Tạo file `gitops/applications/reliability-shop/base/kustomization.yaml`:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - namespace.yaml
  - order-service/deployment.yaml
  - order-service/service.yaml
  - payment-worker/deployment.yaml
```

---

## 4. Xác minh Cú pháp Kustomize Cục bộ (Verification)

Chạy lệnh kiểm tra tính hợp lệ của Kustomize Base từ terminal trước khi commit vào Git:

```bash
# Biên dịch thử Kustomize Base
kubectl kustomize gitops/applications/reliability-shop/base/
```

**Kết quả mong đợi:**
- Toàn bộ YAML hợp lệ được in ra màn hình stdout mà không phát sinh bất kỳ lỗi cú pháp nào.
- Các blocks `topologySpreadConstraints` và `resources` xuất hiện đầy đủ trong các Pod templates.

---

## 5. Điều kiện hoàn thành Gate (Gate Check)

- [ ] Cấu trúc thư mục Kustomize Base được tạo chuẩn mực.
- [ ] 100% containers có định nghĩa Resource Requests/Limits rõ ràng.
- [ ] 3 loại probes (Startup, Liveness, Readiness) được thiết lập đúng các thông số thresholds.
- [ ] Lệnh `kubectl kustomize` biên dịch thành công.

---

## 6. Dọn dẹp tài nguyên (Cleanup)

- Không áp dụng trực tiếp tệp Base vào cluster bằng `kubectl apply`. Tệp Base sẽ được kế thừa bởi các Overlays ở bài tiếp theo.
