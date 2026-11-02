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

## 2. Cấu trúc Thư mục GitOps Base của ReliabilityShop

```text
gitops/applications/reliability-shop/
├── application.yaml          # Argo CD Application trỏ tới base (prune: true, selfHeal: true)
└── base/
    ├── external-secret.yaml      # Đồng bộ credentials từ AWS Secrets Manager qua ESO
    ├── ingress.yaml              # Ingress gia nhập sre-platform group (shop.dev.devopsss.site)
    └── reliability-shop-app.yaml # Deployments, Services, ServiceAccount cho 5 microservices
```

---

## 3. Các bước Khai báo Chi tiết (Manifest Walkthrough)

### Bước 1: Khai báo ServiceAccount và EKS Pod Identity

Để các workload (`order-service`, `payment-worker`) có quyền gửi/nhận message qua AWS SQS và giải mã KMS mà không cần hardcode credentials, ta sử dụng **EKS Pod Identity**:

1. Tạo ServiceAccount `reliability-shop-sa` trong namespace `reliability-shop`.
2. Tạo IAM Role `sre-platform-dev-app-role` với trust policy cho `pods.eks.amazonaws.com` và inline policy cấp quyền `sqs:*`, `kms:Decrypt`, `kms:GenerateDataKey`.
3. Tạo Pod Identity Association liên kết role này với ServiceAccount `reliability-shop-sa`.

---

### Bước 2: Khai báo Microservices Core trong `reliability-shop-app.yaml`

File `reliability-shop-app.yaml` định nghĩa đầy đủ 5 dịch vụ theo kiến trúc BFF (Backend-For-Frontend):

1. **`frontend` (Reverse Proxy & SRE Storefront):** Nhận HTTPS traffic từ ALB tại cổng 8080, đóng vai trò reverse proxy định tuyến nội bộ qua CoreDNS tới các backend services.
2. **`order-service` (Orders & Real Caching):**
   - Kết nối trực tiếp RDS PostgreSQL 16.9.
   - Kết nối Amazon ElastiCache Redis 7.1 qua giao thức mã hóa TLSv1.3 (`REDIS_AUTH`).
   - Sử dụng Cache-Aside pattern (kiểm tra Redis cache `reliabilityshop:orders:list` trước, nếu cache miss thì đọc PostgreSQL và ghi đè cache).
   - Phát event đơn hàng thật vào AWS SQS Queue (`SendMessageCommand`).
3. **`payment-worker` (Async SQS Consumer):**
   - Vòng lặp Long-Polling tiêu thụ message thật từ AWS SQS Queue (`ReceiveMessageCommand`).
   - Cập nhật trạng thái đơn hàng trong PostgreSQL thành `PAID_VIA_SQS_WORKER`.
   - Xóa message khỏi hàng đợi sau khi xử lý thành công (`DeleteMessageCommand`).
4. **`inventory-service` & `auth-service`:** Quản lý kho hàng và phát hành xác thực JWT.

Tất cả các Deployment đều chạy với:
```yaml
      serviceAccountName: reliability-shop-sa
      terminationGracePeriodSeconds: 30
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: ScheduleAnyway
          labelSelector:
            matchLabels:
              app.kubernetes.io/name: order-service
```

---

### Bước 3: Khai báo ExternalSecret (`external-secret.yaml`)

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: reliability-shop-credentials
  namespace: reliability-shop
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: sre-platform-cluster-secret-store
    kind: ClusterSecretStore
  target:
    name: app-credentials
    creationPolicy: Owner
  dataFrom:
    - extract:
        key: /sre-platform/dev/reliability-shop/credentials
```

---

### Bước 4: Khai báo Ingress Chia sẻ ALB (`ingress.yaml`)

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: reliability-shop-ingress
  namespace: reliability-shop
  labels:
    app.kubernetes.io/instance: reliability-shop
  annotations:
    kubernetes.io/ingress.class: alb
    # DÙNG CHUNG ALB VỚI ARGOCD (FinOps Shared Ingress)
    alb.ingress.kubernetes.io/group.name: sre-platform
    alb.ingress.kubernetes.io/group.order: "10"
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/security-groups: sg-067f16ca5bd986a83
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:ap-southeast-1:620306387033:certificate/6af0c1dd-cbf4-4560-84b7-51e7cda7a69a
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}, {"HTTPS": 443}]'
    alb.ingress.kubernetes.io/ssl-redirect: '443'
    alb.ingress.kubernetes.io/healthcheck-path: /health
    alb.ingress.kubernetes.io/healthcheck-interval-seconds: '15'
    alb.ingress.kubernetes.io/healthcheck-timeout-seconds: '5'
    alb.ingress.kubernetes.io/healthy-threshold-count: '2'
    alb.ingress.kubernetes.io/unhealthy-threshold-count: '2'
spec:
  ingressClassName: alb
  rules:
    - host: shop.dev.devopsss.site
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend
                port:
                  number: 80
```
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
