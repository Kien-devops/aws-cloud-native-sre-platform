# 09.01 — Phase 1 & 2: Live Baseline (Read-Only) & Controlled Live Test

> **Trạng thái:** Quy trình kiểm chứng thực tế tại chỗ (Live Operational Verification).<br>
> **Áp dụng cho:** Thiết lập đường cơ sở (Baseline) chỉ đọc và thực thi bài kiểm thử có kiểm soát 1 đơn hàng duy nhất trước khi can thiệp vào mã nguồn hoặc triển khai.

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:**
  - **Phase 1 (Live Baseline, Read-Only):**
    - Kiểm tra sức khỏe toàn diện EKS cluster, managed node groups, managed add-ons, Argo CD, Pods và target groups trên Shared ALB.
    - Kiểm tra trạng thái RDS PostgreSQL, ElastiCache Redis, SQS queue & DLQ, ECR repositories, Pod Identity associations và Security Group matrix.
    - Thu thập bằng chứng (evidence) và thực hiện **Redaction tuyệt đối** (che giấu Account ID thật, token, mật khẩu).
    - **Bất biến (Invariant): Không tạo bất kỳ VPC endpoint mới nào.**
  - **Phase 2 (Controlled Live Test — Cần phê duyệt trước):**
    - Tạo đúng **MỘT (01)** đơn hàng có `test_order_id` duy nhất (ví dụ: `test-order-baseline-001`).
    - Xác minh RDS ghi nhận bản ghi với trạng thái khởi tạo `PENDING_PAYMENT`.
    - Xác minh vòng đời thông điệp SQS: Send -> Receive -> Delete.
    - Xác minh worker xử lý và cập nhật trạng thái đơn hàng sang `PAID`.
    - Gọi API danh sách đơn hàng 2 lần liên tiếp: Lần 1 trả về Cache `MISS` -> đọc RDS -> ghi nhận cache; Lần 2 trả về Cache `HIT` từ Redis.
    - Lưu lại toàn bộ timestamps, logs, và metrics; **tuyệt đối không đọc hoặc in ra giá trị secret**.
- **Nguyên tắc SRE:**
  - **No Assumption Without Proof:** Không phỏng đoán trạng thái của cluster; mọi kết luận phải dựa trên câu lệnh query AWS API và HTTP responses thực tế.
  - **Safety Gate:** Phase 1 và Phase 2 là điều kiện tiên quyết (Prerequisite Gate). Tuyệt đối chưa sửa code trong `app3`, chưa push git, chưa deploy cho tới khi baseline và controlled live test hoàn tất.

---

## 2. Phase 1: Quy trình Kiểm tra Live Baseline (Read-Only)

### Bước 1: Kiểm tra EKS, Add-ons, Nodes và Pods

```bash
# 1. Kiểm tra trạng thái EKS Cluster
aws eks describe-cluster --name sre-platform-dev --region ap-southeast-1 \
  --query "cluster.{Name:name,Status:status,Version:version,Endpoint:endpoint}" --output table

# 2. Kiểm tra Add-ons
aws eks list-addons --cluster-name sre-platform-dev --region ap-southeast-1 --output table

# 3. Kiểm tra NodeGroup và EC2 Instances
aws eks describe-nodegroup --cluster-name sre-platform-dev --nodegroup-name sre-platform-dev-system-nodes \
  --region ap-southeast-1 --query "nodegroup.{Status:status,Scaling:scalingConfig,Capacity:capacityType}" --output table

# 4. Kiểm tra sức khỏe Pods trên toàn cụm
kubectl get pods -A -o wide
```

### Bước 2: Kiểm tra Foundation Services (RDS, Redis, SQS, ECR, ALB)

```bash
# 1. Kiểm tra RDS PostgreSQL
aws rds describe-db-instances --db-instance-identifier sre-platform-dev-pg --region ap-southeast-1 \
  --query "DBInstances[0].{DB:DBInstanceIdentifier,Status:DBInstanceStatus,Engine:Engine,Class:DBInstanceClass}" --output table

# 2. Kiểm tra ElastiCache Redis
aws elasticache describe-cache-clusters --region ap-southeast-1 \
  --query "CacheClusters[*].{Id:CacheClusterId,Status:CacheClusterStatus,Engine:Engine,Nodes:NumCacheNodes}" --output table

# 3. Kiểm tra SQS Main Queue & DLQ
aws sqs list-queues --region ap-southeast-1 --queue-name-prefix reliability-shop-dev --output table

# 4. Kiểm tra Target Group Health trên Shared ALB
aws elbv2 describe-target-groups --region ap-southeast-1 --query "TargetGroups[*].{Name:TargetGroupName,Port:Port,VpcId:VpcId}" --output table
```

---

## 3. Phase 2: Quy trình Kiểm thử Có Kiểm soát (Controlled Live Test)

> **Cảnh báo an toàn:** Kịch bản này chỉ thực hiện tạo đúng **1 đơn hàng duy nhất** và không gây đột biến tải.

### Bước 1: Tạo 1 Đơn Hàng Mới với Test ID Duy Nhất (Idempotency Enforced)

```bash
TARGET_HOST="https://shop.dev.devopsss.site"
IDEMPOTENCY_KEY="sre-test-order-$(date +%s)"

echo "Executing Controlled Live Test with Idempotency-Key: $IDEMPOTENCY_KEY..."

# Gửi HTTP POST tạo đơn hàng với header Idempotency-Key
CREATE_RES=$(curl -s -w "\n%{http_code}" -X POST "$TARGET_HOST/api/orders" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d '{
    "userId": "sre-baseline-user",
    "items": [
      {
        "productId": "prod-sre-001",
        "name": "SRE Production Handbook",
        "price": 99.99,
        "quantity": 1
      }
    ],
    "totalAmount": 99.99
  }')

HTTP_CODE=$(echo "$CREATE_RES" | tail -n1)
BODY=$(echo "$CREATE_RES" | head -n -1)

echo "HTTP Code: $HTTP_CODE"
echo "Response Body: $BODY"
```

Response trả về thực tế:
```json
{
  "success": true,
  "orderId": "ord-2435262e-d7af-414d-b2a9-b7e6ada32de0",
  "status": "PENDING_PAYMENT",
  "eventStatus": "PUBLISHED"
}
```

### Bước 2: Kiểm thử Idempotency (Gửi lại cùng Idempotency-Key)

```bash
# Gửi lại đơn hàng với cùng Idempotency-Key
DUP_RES=$(curl -s -X POST "$TARGET_HOST/api/orders" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d '{"userId":"sre-baseline-user","items":[],"totalAmount":99.99}')

echo "Duplicate Request Response: $DUP_RES"
```

Kết quả trả về ngay lập tức với cờ `duplicate: true`, không tạo thêm đơn hàng và không bắn thêm event thừa:
```json
{
  "success": true,
  "orderId": "ord-2435262e-d7af-414d-b2a9-b7e6ada32de0",
  "status": "PAID",
  "eventStatus": "PUBLISHED",
  "duplicate": true
}
```

### Bước 3: Xác minh Trạng thái trong RDS, SQS và Cache-Aside Redis

1. **Xác minh RDS Transaction & SQS Outbox:**
   - Đơn hàng được ghi vào bảng `orders` với trạng thái ban đầu `PENDING_PAYMENT`.
   - Event outbox được ghi vào bảng `order_outbox` trong cùng transaction DB (ACID).
   - Event dispatcher đẩy message vào `reliability-shop-dev-order-queue` và cập nhật `order_outbox.status = 'PUBLISHED'`.
2. **Xác minh Worker Idempotency & SQS Delete:**
   - `payment-worker` tiêu thụ message, kiểm tra bảng `processed_events(event_id UNIQUE)`.
   - Worker cập nhật `orders.status = 'PAID'` và ghi log `[Order Worker] Payment processed for order ord-...`.
   - Message SQS chỉ được xóa (`deleteMessage`) sau khi DB commit thành công 100%.
3. **Xác minh Redis Cache-Aside (MISS -> HIT):**
   ```bash
   # Lần gọi 1: Cache MISS (Đọc từ RDS, sau đó nạp vào ElastiCache Redis)
   curl -s "$TARGET_HOST/api/orders?page=1&limit=10"
   # Output: {"source":"POSTGRESQL_RDS","cacheStatus":"MISS",...}

   # Lần gọi 2: Cache HIT (Đọc trực tiếp từ ElastiCache Redis siêu tốc)
   curl -s "$TARGET_HOST/api/orders?page=1&limit=10"
   # Output: {"source":"ELASTICACHE_REDIS","cacheStatus":"HIT",...}
   ```

---

## 4. Biên bản Evidence Mẫu (Đã Redact Bảo mật)

```text
================================================================================
                    SRE CONTROLLED LIVE TEST EVIDENCE REPORT
================================================================================
Timestamp:               2026-11-03T08:15:20Z
Cluster Name:            sre-platform-dev (v1.31)
AWS Region:              ap-southeast-1
Account ID:              *** (REDACTED)
Shared ALB:              k8s-sreplatform-5136128a97 (Active)
Target Domains:          shop.dev.devopsss.site / argocd.dev.devopsss.site
--------------------------------------------------------------------------------
[Phase 1 Baseline Check]:
  EKS Control Plane:     ACTIVE
  System NodeGroup:      ACTIVE (3 Nodes: 10.0.10.x, 10.0.11.x)
  RDS PostgreSQL:        AVAILABLE (Private IP: 10.0.20.98)
  ElastiCache Redis:     AVAILABLE (TLS Enabled, In-VPC)
  SQS Queues:            Active (Main Queue + DLQ maxReceives=3)
  VPC Endpoints Count:   1 (S3 Gateway Endpoint ONLY - Zero new endpoint created)
--------------------------------------------------------------------------------
[Phase 2 Controlled Test]:
  Test Order ID:         test-order-baseline-1793658200
  RDS Initial Status:    PENDING_PAYMENT (Recorded in orders table)
  Outbox Event:          OrderCreated (Recorded in order_outbox table)
  SQS Lifecycle:         Send (OK) -> Receive (OK) -> Delete (OK)
  Idempotency Check:     Processed in processed_events table
  Worker Status Update:  PAID (Verified via PostgreSQL query)
  Redis Cache 1st Call:  MISS (Fetched from RDS in 12ms)
  Redis Cache 2nd Call:  HIT (Fetched from ElastiCache in 1.4ms)
================================================================================
OVERALL DECISION:        BASELINE & CONTROLLED TEST PASSED (PROCEED TO APP3 FIX)
================================================================================
```

---

## 5. Điều kiện hoàn thành Gate (Gate Check)

- [ ] Toàn bộ hạ tầng EKS, RDS, Redis, SQS sẵn sàng và ở trạng thái khỏe mạnh.
- [ ] Không tạo mới bất kỳ VPC endpoint nào.
- [ ] Tạo đúng 1 order có test ID duy nhất và chuyển trạng thái thành công sang `PAID`.
- [ ] Redis thể hiện rõ 2 giai đoạn: Lần 1 `MISS` -> Lần 2 `HIT`.
- [ ] Toàn bộ Evidence log được che giấu Account ID và không để lộ bí mật/mật khẩu.
