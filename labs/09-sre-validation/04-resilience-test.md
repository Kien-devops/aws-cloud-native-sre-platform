# 09.04 — Kiểm thử Tính Phục hồi và Khả năng Chịu lỗi (Resilience & Self-Healing Testing)

> **Trạng thái:** Hướng dẫn thực hành chi tiết kịch bản chèn lỗi có kiểm soát dưới tải nền liên tục.  
> **Áp dụng cho:** Đánh giá tính hữu hiệu của PodDisruptionBudget (PDB), Graceful Shutdown, Cache Fallback và khả năng tự phục hồi (Self-Healing).

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Đánh giá khả năng chịu lỗi của nền tảng khi một thành phần bị hỏng **dưới điều kiện hệ thống đang chịu tải liên tục** (k6 background traffic: 30 VUs ~ 50 RPS).
  - Thực hiện 3 bài kiểm tra phục hồi cốt lõi:
    1. **Bài test 1: Đột ngột xóa 1 Pod (Pod Kill Test):** Kiểm tra xem PodDisruptionBudget và ALB Target Group có kịp thời cô lập pod lỗi và định tuyến sang pod còn lại mà không làm rớt request của người dùng hay không.
    2. **Bài test 2: Xác minh Tắt êm dịu (Graceful Shutdown & Connection Draining):** Chứng minh ứng dụng xử lý trọn vẹn tín hiệu `SIGTERM`, không ngắt đột ngột các kết nối TCP đang mở.
    3. **Bài test 3: Sự cố Mất Kết nối Redis Cache (Dependency Outage):** Cố tình ngắt kết nối Redis để kiểm chứng cơ chế **Graceful Degradation** (ứng dụng tự động chuyển sang đọc trực tiếp từ PostgreSQL, chấp nhận latency tăng nhưng giữ vững 100% Availability).
- **Nguyên tắc SRE:**
  - **Fail in Steady State:** Không kiểm thử phục hồi trên hệ thống tĩnh (Idle); bắt buộc phải có lưu lượng request thật đang chạy qua thì mới đo đạc được tỷ lệ rớt gói.
  - **Defense against Cascading Failures:** Sự cố ở tầng Cache hoặc Worker phụ trợ không bao giờ được phép kéo sập toàn bộ dịch vụ cốt lõi (Core Order API).
  - **Quantified Impact (Đo lường bằng số liệu):** Mọi thí nghiệm phải ghi nhận rõ số lượng request bị lỗi (Error Count), thời gian phục hồi (Recovery Time tính bằng giây) và mức tiêu hao Error Budget.

---

## 2. Chuẩn bị Tài nguyên Phục hồi (`PodDisruptionBudget`)

Đảm bảo `order-service` có PDB bảo vệ trong cluster:

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: order-service-pdb
  namespace: reliability-shop
spec:
  minAvailable: 1 # Luôn đảm bảo có ít nhất 1 pod sống sót trong mọi tình huống bảo trì/eviction
  selector:
    matchLabels:
      app.kubernetes.io/name: order-service
```

---

## 3. Các bước Thực hiện Diễn tập (Step-by-Step Drills)

### Thí nghiệm 1: Đột ngột Tiêu diệt Pod (Pod Kill Drill dưới Tải)

1. **Khởi chạy tải nền từ Terminal 1:**
   ```bash
   # Chạy k6 tải liên tục trong 5 phút
   docker run --rm -i grafana/k6:latest run - < performance/k6/sre-load-test.js
   ```
2. **Tiêu diệt Pod từ Terminal 2 (sau khi k6 chạy được 1 phút):**
   ```bash
   # Lấy tên một pod bất kỳ của order-service
   TARGET_POD=$(kubectl get pods -n reliability-shop -l app.kubernetes.io/name=order-service -o jsonpath='{.items[0].metadata.name}')
   echo "==> Killing active pod: $TARGET_POD"
   kubectl delete pod $TARGET_POD -n reliability-shop --now
   ```
3. **Quan sát Phản ứng của Hệ thống:**
   - Kubernetes ReplicaSet lập tức khởi tạo một Pod thay thế trong vòng 2 giây.
   - ALB Target Group phát hiện target cũ bị ngắt và tự động chuyển hướng 100% request sang Pod thứ hai đang sống.
   - **Kết quả k6:** Kiểm tra tổng kết k6 sau khi kết thúc:
     - Số lượng lỗi HTTP 5xx: `<= 2 requests` (hoặc `0`).
     - Tỷ lệ thành công: `> 99.9%`.

---

### Thí nghiệm 2: Đánh sập Redis Cache và Kiểm chứng Graceful Degradation

1. **Chặn kết nối tới Redis:**
   - Vào **EC2 Console** -> **Security Groups** -> Chọn `sre-platform-dev-db-sg`.
   - Tab **Inbound rules** -> Nhấp **Edit inbound rules**.
   - Tạm thời xóa bỏ (hoặc sửa port) của rule cho phép cổng `6379`.
   - Nhấp **Save rules**.
2. **Gửi Request Kiểm tra qua Terminal:**
   ```bash
   # Gửi request xem sản phẩm
   curl -i https://shop.dev.sreplatform.yourdomain.com/api/v1/products
   ```
3. **Quan sát Kết quả:**
   - Request vẫn trả về mã: `HTTP/2 200 OK`.
   - Mở logs của `order-service`:
     ```bash
     kubectl logs -n reliability-shop -l app.kubernetes.io/name=order-service --tail=20
     ```
     Xuất hiện log cảnh báo thông minh:  
     `WARN: Redis connection timeout. Gracefully falling back to PostgreSQL database query.`
   - Độ trễ tăng nhẹ từ `4ms` lên `18ms` (do đọc DB thay vì RAM Cache), **nhưng người dùng hoàn toàn không bị báo lỗi 500!**
4. **Khôi phục lại rule Redis trong Security Group:** Hệ thống tự động tái kết nối Redis cache mà không cần restart pods.

---

### Thí nghiệm 3: Kiểm chứng SRE Correctness & Idempotent Consumer

1. **Kiểm thử Xử lý Trùng lặp (Duplicate Message Test):**
   - Bơm 2 message SQS có cùng một `event_id` (`duplicate-event-001`) vào hàng đợi `reliability-shop-dev-order-queue`.
   - **Kết quả mong đợi:** Worker chỉ thực hiện tính tiền/cập nhật DB đúng **1 lần duy nhất** nhờ ràng buộc khóa chính trên bảng `processed_events(event_id UNIQUE)`. Message thứ 2 được nhận diện là duplicate và được xóa an toàn mà không double-charge khách hàng.
2. **Kiểm thử Khi Cơ sở dữ liệu Gặp Lỗi (DB Error Retain Message):**
   - Mô phỏng DB bị lock hoặc mất kết nối tạm thời khi worker đang cập nhật order.
   - **Bất biến SRE:** Worker **tuyệt đối KHÔNG gọi `DeleteMessage`** khi DB transaction thất bại.
   - Message tự động trở lại hàng đợi sau khi hết `VisibilityTimeout` (30 giây) để retry.
3. **Kiểm thử Transactional Outbox khi SQS Lỗi:**
   - Giả lập lỗi quyền hoặc timeout khi gửi SQS message trong luồng tạo order.
   - Do Order và Outbox Event nằm trong cùng 1 ACID transaction, event được bảo toàn an toàn trong bảng `order_outbox` và sẽ được Outbox Relay tiến hành retry sau đó (Zero Event Loss).

---

### Thí nghiệm 4: Poison Message & Cách ly vào Dead-Letter Queue (DLQ)

1. **Gửi một Poison Message có format lỗi cố ý:**
   ```bash
   # Gửi một message lỗi JSON parse hoặc thiếu trường bắt buộc
   aws sqs send-message \
     --queue-url "https://sqs.ap-southeast-1.amazonaws.com/123456789012/reliability-shop-dev-order-queue" \
     --message-body '{"bad_payload":"corrupted_data_poison_pill"}' \
     --region ap-southeast-1
   ```
2. **Quan sát Vòng đời Retry:**
   - Worker nhận message lần 1 -> Lỗi parse -> Không delete -> Hết 30s visibility timeout.
   - Worker nhận message lần 2 -> Tiếp tục lỗi.
   - Worker nhận message lần 3 -> Tiếp tục lỗi.
3. **Xác minh Cách ly vào DLQ:**
   - Sau 3 lần nhận thất bại (`maxReceiveCount = 3`), SQS tự động chuyển tiếp message sang `reliability-shop-dev-order-dlq`.
   - Hàng đợi chính `reliability-shop-dev-order-queue` trở lại sạch sẽ, không bị nghẽn các đơn hàng bình thường khác.
   - CloudWatch Alarm `sre-platform-dev-dlq-messages-visible` kích hoạt trạng thái **ALARM**.

---

## 4. Báo cáo Nghiệm thu Tính Phục hồi (Resilience Scorecard)

```text
=== RESILIENCE & FAULT TOLERANCE TEST REPORT ===
Timestamp:               2026-10-21T03:00:00Z
Background Traffic:      50 RPS (30 Concurrent Users)

--- TEST 1: SUDDEN POD TERMINATION ---
Fault Injected:          SIGKILL on 1 active replica
Pod Recovery Time:       3.2 seconds (Replacement pod Ready)
Dropped Requests:        0 requests dropped (ALB draining worked)
Availability SLI Impact: 100% maintained (Zero degradation)
Result:                  PASSED

--- TEST 2: REDIS CACHE OUTAGE ---
Fault Injected:          Security Group blocking port 6379
Application Reaction:    Fallback to PostgreSQL read-path
Availability SLI:        100% (No 500 errors observed)
Latency Impact:          p95 increased from 24ms to 42ms (Within SLO < 300ms)
Result:                  PASSED (Graceful degradation confirmed)

OVERALL DECISION:        RESILIENCE TEST PASSED
```

---

## 5. Điều kiện hoàn thành Gate (Gate Check)

- [ ] Việc tiêu diệt đột ngột một pod không làm sập ứng dụng và không gây vi phạm SLO Availability.
- [ ] Cơ chế Cache-Aside Fallback hoạt động đúng: mất Redis không làm ngắt quãng dịch vụ bán hàng.
- [ ] Báo cáo nghiệm thu Resilience Scorecard được ghi nhận thành công.

---

## 6. Dọn dẹp tài nguyên (Cleanup)

- Đảm bảo Security Group của Database đã được khôi phục nguyên vẹn các rules mở cổng cho Redis (6379) và PostgreSQL (5432).
