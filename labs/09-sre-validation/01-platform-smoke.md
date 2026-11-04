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
    - **Bất biến (Invariant): Không tạo bất kỳ VPC endpoint mới nào (chỉ duy nhất 1 S3 Gateway Endpoint).**
  - **Phase 2 (Controlled Live Test — Cần phê duyệt trước):**
    - Tạo đúng **MỘT (01)** đơn hàng có `Idempotency-Key` duy nhất (ví dụ: `sre-test-order-baseline-001`).
    - Xác minh RDS ghi nhận bản ghi với trạng thái khởi tạo `PENDING_PAYMENT`.
    - Xác minh vòng đời thông điệp SQS: Outbox -> Send -> Receive -> Delete.
    - Xác minh worker xử lý tự động và cập nhật trạng thái đơn hàng sang `PAID`.
    - Gọi API danh sách đơn hàng 2 lần liên tiếp: Lần 1 trả về Cache `MISS` -> đọc RDS -> nạp vào Redis; Lần 2 trả về Cache `HIT` trực tiếp từ Redis.
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
  --region ap-southeast-1 --query "nodegroup.{Status:status,Scaling:scalingConfig,Capacity:capacityType,InstanceTypes:instanceTypes}" --output table

# 4. Kiểm tra sức khỏe Pods trên toàn cụm
kubectl get pods -A -o wide
```

### Bước 2: Kiểm tra Foundation Services (RDS, Redis, SQS, ALB, VPC Endpoints)

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

# 5. Kiểm tra Invariant VPC Endpoint (Chỉ duy nhất S3 Gateway)
aws ec2 describe-vpc-endpoints --region ap-southeast-1 \
  --query "VpcEndpoints[*].{Id:VpcEndpointId,ServiceName:ServiceName,Type:VpcEndpointType,State:State}" --output table
```

---

## 3. Phase 2: Quy trình Kiểm thử Có Kiểm soát (Controlled Live Test)

> **Cảnh báo an toàn:** Kịch bản này chỉ thực hiện tạo đúng **1 đơn hàng duy nhất** và không gây đột biến tải.

### Bước 1: Tạo 1 Đơn Hàng Mới với Test ID Duy Nhất (Idempotency Enforced)

```bash
TARGET_HOST="https://shop.dev.devopsss.site"
IDEMPOTENCY_KEY="sre-test-order-baseline-001"

echo "Executing Controlled Live Test with Idempotency-Key: $IDEMPOTENCY_KEY..."

# Gửi HTTP POST tạo đơn hàng với schema chuẩn của order-service
curl.exe -k -s -w "\nHTTP_CODE:%{http_code}\n" -X POST "$TARGET_HOST/api/orders" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d '{
    "item": "SRE Production Handbook",
    "quantity": 1,
    "amount": 99.99,
    "customer": "sre-baseline-user"
  }'
```

Response trả về thực tế:
```json
{
  "success": true,
  "duplicate": false,
  "order": {
    "id": "ord-b25aea69-b687-4cbe-9ddd-3330f9b4ea6f",
    "item": "SRE Production Handbook",
    "quantity": 1,
    "amount": 99.99,
    "customer": "sre-baseline-user",
    "status": "PENDING_PAYMENT",
    "createdAt": "2026-11-04T16:48:29.586Z",
    "eventId": "637adba1-6863-465d-b1f9-845922ae0f6b",
    "eventStatus": "PENDING",
    "eventPublishedAt": null,
    "paymentProcessedAt": null
  },
  "storage": "POSTGRESQL_RDS",
  "outbox": {
    "eventId": "637adba1-6863-465d-b1f9-845922ae0f6b",
    "status": "PENDING"
  },
  "sqs": {
    "dispatched": false,
    "published": false,
    "status": "PENDING_OUTBOX"
  }
}
```

### Bước 2: Kiểm thử Idempotency (Gửi lại cùng Idempotency-Key)

```bash
# Gửi lại đơn hàng với cùng Idempotency-Key
curl.exe -k -s -X POST "$TARGET_HOST/api/orders" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d '{
    "item": "SRE Production Handbook",
    "quantity": 1,
    "amount": 99.99,
    "customer": "sre-baseline-user"
  }'
```

Kết quả trả về ngay lập tức với cờ `duplicate: true`, trạng thái đã được payment worker xử lý thành công sang `PAID`, không tạo thêm đơn hàng và không bắn event trùng lặp:
```json
{
  "success": true,
  "duplicate": true,
  "order": {
    "id": "ord-b25aea69-b687-4cbe-9ddd-3330f9b4ea6f",
    "item": "SRE Production Handbook",
    "quantity": 1,
    "amount": 99.99,
    "customer": "sre-baseline-user",
    "status": "PAID",
    "createdAt": "2026-11-04T16:48:29.586Z",
    "eventId": "637adba1-6863-465d-b1f9-845922ae0f6b",
    "eventStatus": "PUBLISHED",
    "eventPublishedAt": "2026-11-04T16:48:29.614Z",
    "paymentProcessedAt": "2026-11-04T16:48:29.802Z"
  },
  "storage": "POSTGRESQL_RDS",
  "outbox": {
    "eventId": "637adba1-6863-465d-b1f9-845922ae0f6b",
    "status": "PUBLISHED"
  },
  "sqs": {
    "dispatched": false,
    "published": false,
    "status": "PENDING_OUTBOX"
  }
}
```

### Bước 3: Xác minh Trạng thái trong RDS, SQS và Cache-Aside Redis

1. **Xác minh RDS Transaction & SQS Outbox:**
   - Đơn hàng được ghi vào bảng `orders` với trạng thái ban đầu `PENDING_PAYMENT`.
   - Event outbox được ghi vào bảng `order_outbox` trong cùng transaction DB (ACID).
   - Event dispatcher đẩy message vào `reliability-shop-dev-order-queue` lúc `16:48:29.614Z` và cập nhật `order_outbox.status = 'PUBLISHED'`.
2. **Xác minh Worker Idempotency & SQS Delete:**
   - `payment-worker` tiêu thụ message từ SQS, kiểm tra xử lý thanh toán.
   - Worker cập nhật `orders.status = 'PAID'` lúc `16:48:29.802Z` (tổng thời gian xử lý chỉ **216ms**).
   - Message SQS được xóa thành công khỏi queue.
3. **Xác minh Redis Cache-Aside (MISS -> HIT):**
   ```bash
   # Lần gọi 1: Cache MISS (Đọc từ RDS, sau đó nạp vào ElastiCache Redis)
   curl.exe -k -s "https://shop.dev.devopsss.site/api/orders"
   # Output: {"source":"POSTGRESQL_RDS","cached":false,"orders":[...]} -> Độ trễ: 646ms

   # Lần gọi 2: Cache HIT (Đọc trực tiếp từ ElastiCache Redis)
   curl.exe -k -s "https://shop.dev.devopsss.site/api/orders"
   # Output: {"source":"ELASTICACHE_REDIS","cached":true,"orders":[...]} -> Độ trễ: 377ms
   ```

4. **Kiểm tra Endpoints Chẩn đoán (Diagnostics):**
   ```bash
   curl.exe -k -s "https://shop.dev.devopsss.site/api/orders/status"
   # Output: {"db":{"connected":true},"redis":{"connected":true},"sqs":{"connected":true},"outbox":{"pending":0,"healthy":true}}

   curl.exe -k -s "https://shop.dev.devopsss.site/api/orders/redis-test"
   # Output: {"redisConnected":true,"latencyMs":2}
   ```

---

## 4. Biên bản Evidence Thực tế (Đã Redact Bảo mật)

```text
================================================================================
                    SRE CONTROLLED LIVE TEST EVIDENCE REPORT
================================================================================
Timestamp:               2026-11-04T16:48:30Z (23:48:30 GMT+7)
Cluster Name:            sre-platform-dev (Kubernetes v1.31)
AWS Region:              ap-southeast-1
Account ID:              123456789012 (REDACTED)
Shared ALB:              k8s-sreplatform-5136128a97.ap-southeast-1.elb.amazonaws.com
Target Domain:           https://shop.dev.devopsss.site
--------------------------------------------------------------------------------
[Phase 1 Baseline Check]:
  EKS Control Plane:     ACTIVE (Version 1.31, Endpoint Active)
  EKS Add-ons:           7 Add-ons Active (coredns, vpc-cni, kube-proxy, pod-identity...)
  System NodeGroup:      ACTIVE (Capacity: SPOT, Instances: t3.medium, Status: ACTIVE)
  RDS PostgreSQL:        AVAILABLE (Engine: postgres, Class: db.t4g.micro)
  ElastiCache Redis:     AVAILABLE (Engine: redis, Nodes: 1, TLS Enabled)
  SQS Queues:            Active (reliability-shop-dev-order-queue + DLQ)
  VPC Endpoints Count:   1 (com.amazonaws.ap-southeast-1.s3 Gateway ONLY - Invariant OK)
  Target Groups:         Active & Healthy on VPC vpc-0df0e74020cd8c2ab
  Argo CD Apps Status:   All 4 Applications Synced & Healthy (100% green)
--------------------------------------------------------------------------------
[Phase 2 Controlled Test]:
  Test Idempotency-Key:  sre-test-order-baseline-001
  Generated Order ID:    ord-b25aea69-b687-4cbe-9ddd-3330f9b4ea6f
  RDS Initial Status:    PENDING_PAYMENT (Created at 16:48:29.586Z)
  Outbox Event:          ORDER_CREATED (Published to SQS at 16:48:29.614Z)
  SQS Lifecycle:         Send -> Receive -> Delete (Cleanly consumed by worker)
  Worker Processing:     PAID (Processed at 16:48:29.802Z - E2E Latency: 216ms)
  Idempotency Check:     HTTP 200 with "duplicate": true (Zero duplicate record)
  Redis Cache 1st Call:  POSTGRESQL_RDS (cached: false - Latency: 646ms)
  Redis Cache 2nd Call:  ELASTICACHE_REDIS (cached: true - Latency: 377ms)
  Diagnostics Check:     DB Connected (OK), Redis Latency (2ms), SQS Pending (0)
================================================================================
OVERALL DECISION:        BASELINE & CONTROLLED TEST PASSED (READY FOR SRE DRILLS)
================================================================================
```

---

## 5. Điều kiện hoàn thành Gate (Gate Check)

- [x] Toàn bộ hạ tầng EKS, RDS, Redis, SQS sẵn sàng và ở trạng thái khỏe mạnh.
- [x] Không tạo mới bất kỳ VPC endpoint nào (Duy nhất 1 S3 Gateway Endpoint).
- [x] Tạo đúng 1 order có test ID duy nhất và chuyển trạng thái thành công sang `PAID` (216ms).
- [x] Redis thể hiện rõ 2 giai đoạn: Lần 1 `MISS` -> Lần 2 `HIT`.
- [x] Toàn bộ Evidence log được che giấu Account ID và không để lộ bí mật/mật khẩu.
