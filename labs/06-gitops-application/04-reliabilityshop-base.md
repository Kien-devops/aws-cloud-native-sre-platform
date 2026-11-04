# 06.04 — Xây dựng Khung Manifests Cơ sở (Kustomize Base) cho ReliabilityShop

> **Trạng thái:** Hướng dẫn thực hành chi tiết cấu trúc GitOps Base chuẩn SRE và AWS Well-Architected Framework.<br>
> **Áp dụng cho:** Định nghĩa kiến trúc microservices cốt lõi (`frontend`, `order-service`, `payment-worker`) kèm theo đầy đủ các chỉ tiêu bảo vệ độ tin cậy và phân quyền đám mây.

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Khai báo các Kubernetes manifests tiêu chuẩn trong thư mục `gitops/applications/reliability-shop/base/`.
  - Đảm bảo **EKS Pod Identity** hoạt động thông qua việc khai báo tường minh `ServiceAccount` (`reliability-shop-sa`) trong GitOps.
  - Phân tách ranh giới cấu hình rõ ràng:
    - **ConfigMap:** Chứa các endpoint hạ tầng không nhạy cảm (RDS Endpoint, ElastiCache Host, SQS Queue URL).
    - **ExternalSecret:** Chỉ chứa thông tin bí mật và khóa xác thực (`DB_PASSWORD`, `REDIS_AUTH`).
  - Cố định hình ảnh bằng **Image SHA Digest** (`@sha256:...`) thay vì mutable tags (`:latest`) để đảm bảo tính bất biến (Immutability).
  - Tích hợp **KEDA ScaledObject** để tự động co giãn `payment-worker` theo độ sâu hàng đợi SQS sau khi consumer đã đạt tính lũy quyền (Idempotent).
- **Nguyên tắc SRE:**
  - **Single Source of Truth in Git:** Mọi cấu hình triển khai phải nằm trên Git repository. **Nghiêm cấm dùng `kubectl apply` trực tiếp** trên cluster. Mọi thay đổi phải đi qua Pull Request và được Argo CD tự động hòa giải (Reconcile).
  - **No Unbounded Containers:** Mọi container chạy trên cluster bắt buộc phải có `requests.cpu`, `requests.memory` và `limits.memory` được định nghĩa rõ ràng.
  - **Idempotent Queue Autoscaling:** Chỉ bật KEDA scale worker khi consumer đã có cơ chế bảng `processed_events` để ngăn chặn double-processing khi nhiều worker cùng tiêu thụ message.

---

## 2. Cấu trúc Thư mục GitOps Base của ReliabilityShop

```text
gitops/applications/reliability-shop/base/
├── kustomization.yaml        # Kustomize root, configMapGenerator & image digests pin
├── service-account.yaml      # ServiceAccount liên kết EKS Pod Identity
├── external-secret.yaml      # Đồng bộ credentials từ AWS Secrets Manager qua ESO
├── ingress.yaml              # Ingress dùng chung ALB (sre-platform group)
└── reliability-shop-app.yaml # Deployments, Services & Liveness/Readiness probes
```

---

## 3. Các bước Khai báo Chi tiết (Manifest Walkthrough)

### Bước 1: Khai báo ServiceAccount và EKS Pod Identity

Tạo và theo dõi ServiceAccount trong GitOps để các Pod (`order-service`, `payment-worker`) tự động kế thừa quyền IAM (SQS, KMS) từ EKS Pod Identity Association:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: reliability-shop-sa
  namespace: reliability-shop
  labels:
    app.kubernetes.io/part-of: reliability-shop
```

---

### Bước 2: Tách bạch Cấu hình (ConfigMap qua Kustomize) và Bí mật (ExternalSecret)

#### 1. Cấu hình sinh ConfigMap trong `kustomization.yaml`:

```yaml
configMapGenerator:
  - name: app-config
    namespace: reliability-shop
    literals:
      - NODE_ENV=production
      - AWS_REGION=ap-southeast-1
      - SQS_QUEUE_NAME=reliability-shop-dev-order-queue
      - DB_HOST=sre-platform-dev-pg.c1ky6i8iomcn.ap-southeast-1.rds.amazonaws.com
      - DB_PORT=5432
      - DB_NAME=reliability_shop
      - DB_SSL=true
      - REDIS_HOST=master.sre-platform-dev-redis.qspmd1.apse1.cache.amazonaws.com
      - REDIS_PORT=6379
      - REDIS_TLS=true
```

#### 2. ExternalSecret đồng bộ Credentials từ AWS Secrets Manager (`external-secret.yaml`):

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: app-credentials
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
        key: sre-platform-dev-app-credentials
```

Các Pods tiêu thụ cấu hình an toàn bằng cách:
* Biến môi trường endpoint phi nhạy cảm được nạp qua `envFrom: - configMapRef: name: app-config`.
* Mật khẩu (`DB_USER`, `DB_PASSWORD`, `REDIS_AUTH`) được nạp qua `env: - name: ... valueFrom: secretKeyRef: name: app-credentials`.

---

### Bước 3: Khai báo Ingress Chia sẻ ALB (`ingress.yaml`)

Ingress cấu hình host routing chia sẻ cùng ALB `k8s-sreplatform-5136128a97` với Argo CD nhằm tối ưu chi phí (FinOps):

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
    alb.ingress.kubernetes.io/group.name: sre-platform
    alb.ingress.kubernetes.io/group.order: "10"
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/security-groups: sg-067f16ca5bd986a83
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:ap-southeast-1:123456789012:certificate/6af0c1dd-cbf4-4560-84b7-51e7cda7a69a
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}, {"HTTPS": 443}]'
    alb.ingress.kubernetes.io/ssl-redirect: '443'
    alb.ingress.kubernetes.io/healthcheck-path: /health
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
                  number: 8080
```

---

### Bước 4: Khai báo KEDA ScaledObject cho Worker (`keda-scaledobject.yaml`)

Tự động co giãn số lượng `payment-worker` pods theo số lượng message đang chờ xử lý trong SQS Queue:

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: payment-worker-scaler
  namespace: reliability-shop
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: payment-worker
  minReplicaCount: 1
  maxReplicaCount: 10
  cooldownPeriod: 30
  pollingInterval: 15
  triggers:
    - type: aws-sqs-queue
      metadata:
        queueURL: https://sqs.ap-southeast-1.amazonaws.com/123456789012/reliability-shop-dev-order-queue
        queueLength: "5"
        awsRegion: "ap-southeast-1"
        identityOwner: "pod"
```

---

### Bước 5: Pin Image bằng SHA Digest và Khai báo Workloads

Trong file `reliability-shop-app.yaml`, toàn bộ container images bắt buộc phải được pin bằng **SHA256 Digest**:

```yaml
# Ví dụ Container trong Deployment:
containers:
  - name: app
    image: 123456789012.dkr.ecr.ap-southeast-1.amazonaws.com/reliabilityshop/order-service@sha256:4a8b7f1e63d...
    imagePullPolicy: IfNotPresent
    envFrom:
      - configMapRef:
          name: reliability-shop-config
      - secretRef:
          name: app-credentials
    resources:
      requests:
        cpu: 100m
        memory: 128Mi
      limits:
        cpu: 500m
        memory: 256Mi
```

---

## 4. Điều kiện hoàn thành Gate (Gate Check)

- [ ] `ServiceAccount` (`reliability-shop-sa`) được định nghĩa trong GitOps và đồng bộ thành công.
- [ ] Không có thông tin nhạy cảm (passwords, tokens) trong ConfigMap.
- [ ] Ingress sử dụng đúng annotation `group.name: sre-platform`.
- [ ] Toàn bộ images được ghim (pinned) bằng SHA Digest bất biến.
- [ ] KEDA ScaledObject kích hoạt thành công và trỏ đúng URL của SQS Queue.
