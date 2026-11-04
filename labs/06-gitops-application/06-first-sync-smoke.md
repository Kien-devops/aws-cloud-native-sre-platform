# 06.06 — Đồng bộ Lần đầu (First Sync) và Kiểm thử Khói Toàn trình (End-to-End Smoke Test)

> **Trạng thái:** Hướng dẫn thực hành chi tiết trên Argo CD Web UI kết hợp kiểm thử giao dịch thực tế.  
> **Áp dụng cho:** Nghiệm thu toàn trình chuỗi liên kết: GitOps Sync → External Secrets → EKS Pods → ALB Ingress → Database/Redis/SQS.

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Khởi tạo **Argo CD Application** (`reliability-shop-dev`) trỏ tới thư mục `gitops/applications/reliability-shop/envs/dev/`.
  - Kích hoạt tiến trình đồng bộ lần đầu (**First Sync**) và quan sát quá trình tự động triển khai toàn bộ ứng dụng.
  - Xác nhận toàn bộ chuỗi phụ thuộc (Dependency Chain) vận hành trơn tru:
    1. **ESO** tự động đọc AWS Secrets Manager và tạo Kubernetes Secret `app-credentials`.
    2. **Pods** mount secret và kết nối thành công tới RDS PostgreSQL và ElastiCache Redis.
    3. **AWS Load Balancer Controller** phát hiện Ingress và tạo Application Load Balancer trên AWS.
    4. Target Group gắn các Pod IPs thành công và báo trạng thái `Healthy`.
  - Thực hiện bài **End-to-End Smoke Test** (Kiểm thử khói xuyên suốt một luồng giao dịch thật): Tạo đơn hàng qua API -> Lưu DB -> Đẩy SQS -> Worker xử lý -> Ghi cache Redis.
- **Nguyên tắc SRE:**
  - **Trust but Verify (Tin tưởng nhưng phải kiểm chứng):** Trạng thái `Healthy` màu xanh trên dashboard của Argo CD chưa chứng minh ứng dụng thực sự phục vụ được người dùng; bắt buộc phải có request HTTP thật đi qua toàn bộ các tầng.
  - **Golden Signals Baseline:** Ghi nhận mốc đo đạc ban đầu (Baseline) về độ trễ và tỷ lệ lỗi khi hệ thống chưa chịu tải lớn.
  - **Gate Zero-Tolerance:** Bất kỳ lỗi crash, secret không mount được, hoặc target group báo `Unhealthy` đều phải dừng lại và sửa triệt để trước khi chuyển sang Module 07 (Observability).

---

## 2. Thông số đầu vào (Input Parameters)

| Tham số | Giá trị mẫu | Ý nghĩa |
| :--- | :--- | :--- |
| **Argo Application Name**| `reliability-shop-dev` | Tên ứng dụng GitOps trong Argo CD |
| **Argo Project** | `reliability-shop` | Project bị cô lập quyền đã tạo ở bài 06.02 |
| **Sync Path** | `gitops/applications/reliability-shop/envs/dev` | Thư mục Overlay chứa cấu hình dev |
| **Destination Namespace**| `reliability-shop` | Namespace chứa workload microservices |
| **Public FQDN** | `https://shop.dev.sreplatform.yourdomain.com` | Địa chỉ kiểm thử giao dịch thật |

---

## 3. Các bước thực hiện chi tiết (Step-by-Step Walkthrough)

### Bước 1: Khai báo Application Manifest trong Git

Tạo file `gitops/applications/reliability-shop/application.yaml`:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: reliability-shop-dev
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: reliability-shop
  source:
    repoURL: 'https://github.com/my-org/aws-cloud-native-sre-platform.git'
    targetRevision: main
    path: gitops/applications/reliability-shop/envs/dev
  destination:
    server: 'https://kubernetes.default.svc'
    namespace: reliability-shop
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

Áp dụng vào cluster:
```bash
kubectl apply -f gitops/applications/reliability-shop/application.yaml
```

---

### Bước 2: Theo dõi Đồng bộ Lần đầu trên Argo CD Web UI

1. Mở trình duyệt truy cập `https://localhost:8080` (Argo CD Web UI).
2. Nhấp vào Application `reliability-shop-dev`.
3. Nhấp nút **SYNC** -> Chọn **SYNCHRONIZE** để bắt đầu kéo cấu hình từ Git về.
4. **Quan sát Sơ đồ Cây Tài nguyên (Resource Tree):**
   - **Tầng 1 (Secrets):** `ExternalSecret` chuyển sang trạng thái xanh (`SecretSynced`), kéo theo Kubernetes Secret `app-credentials` xuất hiện.
   - **Tầng 2 (Workloads):** Deployment `order-service` và `payment-worker` tạo ReplicaSets và Pods.
   - **Tầng 3 (Networking):** `Ingress` được tạo -> AWS Load Balancer Controller tiếp nhận và khởi tạo ALB trên AWS.
5. Chờ 2-3 phút cho đến khi tất cả các hộp tài nguyên đều hiển thị biểu tượng trái tim màu xanh lá cây (**Healthy**).

---

### Bước 3: Đối chiếu Trạng thái trên AWS Management Console

1. Mở **AWS Secrets Manager Console**:
   - Kiểm tra CloudTrail Event History để xác nhận Role của ESO đã thực hiện lệnh `GetSecretValue` thành công.
2. Mở **Amazon EC2 Console** -> **Target Groups**:
   - Tìm Target Group của ứng dụng (`k8s-reliabil-orderapi-...`).
   - Tab **Targets**: Xác nhận 2 Pod IPs của `order-service` đều có trạng thái **Healthy**.

---

### Bước 4: Thực thi Bộ Kiểm thử Khói SRE Toàn trình (End-to-End SRE Verification Suite)

Chạy các lệnh kiểm thử sau từ terminal máy trạm hoặc trình duyệt:

#### 1. Kiểm tra Endpoint Sức khỏe HTTP/HTTPS & Chứng chỉ SSL
```bash
curl -Iv https://shop.dev.devopsss.site/health
```
**Kết quả mong đợi:** HTTP status code `200 OK`, chứng chỉ SSL hợp lệ issued bởi Amazon ACM cho `*.dev.devopsss.site`.

#### 2. Kiểm thử Chẩn đoán Trực tiếp RDS PostgreSQL (`/api/orders/db-test`)
```bash
curl -s https://shop.dev.devopsss.site/api/orders/db-test
```
**Kết quả mong đợi:**
```json
{
  "dbConnected": true,
  "latencyMs": 3,
  "databaseName": "reliability_shop",
  "currentUser": "sre_admin",
  "pgVersion": "PostgreSQL 16.9 ...",
  "host": "sre-platform-dev-pg.c1ky6i8iomcn.ap-southeast-1.rds.amazonaws.com"
}
```

#### 3. Kiểm thử Chẩn đoán Trực tiếp Amazon ElastiCache Redis (`/api/orders/redis-test`)
```bash
curl -s https://shop.dev.devopsss.site/api/orders/redis-test
```
**Kết quả mong đợi:**
```json
{
  "redisConnected": true,
  "pingResponse": "PONG",
  "latencyMs": 3,
  "testKey": "sre_test_...",
  "retrievedValue": "RELIABILITY_SHOP_ACTIVE",
  "host": "master.sre-platform-dev-redis...cache.amazonaws.com",
  "port": 6379,
  "tlsMode": "TLSv1.3 In-Transit Encrypted",
  "authMode": "Redis AUTH via External Secrets (AES-256)"
}
```

#### 4. Kiểm thử Hàng đợi AWS SQS Pipeline (`/api/orders/sqs-test`)
```bash
curl -s https://shop.dev.devopsss.site/api/orders/sqs-test
```
**Kết quả mong đợi:** Trả về AWS SQS `MessageId` thật:
```json
{
  "operation": "SQS_SEND_MESSAGE",
  "queueUrl": "https://sqs.ap-southeast-1.amazonaws.com/***/reliability-shop-dev-order-queue",
  "sqsDispatched": true,
  "messageId": "62c74d83-9e33-4903-ba6e-90b5c49ed47d",
  "kmsEncrypted": true,
  "podIdentity": "Active (sre-platform-dev-app-role)"
}
```

#### 5. Kiểm tra Nhật ký Xử lý của Payment Worker (`/api/worker/stats`)
```bash
curl -s https://shop.dev.devopsss.site/api/worker/stats
```
**Kết quả mong đợi:**
```json
{
  "worker": "payment-worker",
  "isPolling": true,
  "messagesProcessed": 6,
  "lastProcessed": {
    "messageId": "62c74d83-9e33-4903-ba6e-90b5c49ed47d",
    "orderId": "test-ord-0064"
  },
  "recentLogs": [
    "🗑️ Deleted message from SQS queue",
    "✔ Updated order in PostgreSQL to status=PAID_VIA_SQS_WORKER",
    "📬 Consumed message from SQS"
  ]
}
```

#### 6. Kiểm tra Cơ chế Cache-Aside (Cache Hit vs Cache Miss trên Redis)
```bash
# Lần 1: Cache Miss -> Đọc DB và nạp Redis Cache
curl -s https://shop.dev.devopsss.site/api/orders | grep -o '"source":"[^"]*"'

# Lần 2 (ngay sau đó): Cache Hit -> Đọc trực tiếp từ ElastiCache Redis (< 2ms)
curl -s https://shop.dev.devopsss.site/api/orders | grep -o '"source":"[^"]*"'
```
**Kết quả mong đợi:**
- Lần 1: `"source":"POSTGRESQL_RDS (Cache Miss -> DB Queried & Cached)"`
- Lần 2: `"source":"ELASTICACHE_REDIS (Cache Hit)"`

---

## 4. Báo cáo Nghiệm thu Kiểm thử Khói (Smoke Test Report)

Lưu lại nội dung sau vào hồ sơ nghiệm thu:

```text
=== RELIABILITYSHOP END-TO-END SMOKE TEST REPORT ===
Timestamp:            2026-11-03T03:30:00Z
Target Application:   reliability-shop (GitOps v1.0.5)
Storefront URL:       https://shop.dev.devopsss.site
Argo CD URL:          https://argocd.dev.devopsss.site
Shared ALB:           k8s-sreplatform-5136128a97 (Active)
GitOps Sync Status:   SYNCED / HEALTHY (Argo CD v2.11.3)
Secrets Sync:         CONFIRMED (ESO synced from AWS Secrets Manager)
Target Group Health:  100% Targets Healthy (Frontend & Argo CD)
PostgreSQL 16.9:      CONFIRMED (Query Latency = 3 ms)
ElastiCache Redis:    CONFIRMED (TLSv1.3 + Redis AUTH, Cache-Aside Verified)
AWS SQS Queue:        CONFIRMED (Real MessageId dispatched & consumed)
Smoke Test Decision:  PASSED (All systems nominal)
```

---

## 5. Điều kiện hoàn thành Gate (Gate Check)

- [ ] Ứng dụng `reliability-shop-dev` đạt trạng thái `Synced` và `Healthy` trên Argo CD.
- [ ] 100% Targets trong Target Group của ALB hiển thị trạng thái `Healthy`.
- [ ] Request tạo đơn hàng thực tế qua public URL thành công và trả về mã HTTP 201.
- [ ] Dữ liệu giao dịch được xác nhận đã ghi nhận xuyên suốt qua PostgreSQL, SQS và Redis.
- [ ] Sẵn sàng bước sang Phase 07: Xây dựng hệ thống quan sát toàn diện (Observability Stack).
