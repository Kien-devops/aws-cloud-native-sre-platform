# 03.03 (02) — Khởi tạo Hàng đợi Bất đồng bộ Amazon SQS và Dead-Letter Queue (DLQ)

> **Trạng thái:** Hướng dẫn thực hành chi tiết trên AWS Management Console (Console-first).  
> **Áp dụng cho:** Kiến trúc giao tiếp bất đồng bộ (Asynchronous Decoupling) giữa `order-service` và `payment-worker`.

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Tạo hàng đợi **Dead-Letter Queue (DLQ)** trước (`reliability-shop-dev-order-dlq`) để gom giữ các thông điệp bị lỗi sau nhiều lần thử lại (Retry Exhaustion).
  - Khởi tạo hàng đợi chính **Amazon SQS Standard Queue** (`reliability-shop-dev-order-queue`) với cơ chế **Redrive Policy** tự động chuyển tiếp message sang DLQ sau khi vượt quá số lần nhận tối đa (`maxReceiveCount = 3`).
  - Thiết lập **Visibility Timeout** (Thời gian ẩn message) lớn hơn thời gian xử lý thông thường của worker (ví dụ: 30 giây) để tránh xử lý trùng lặp (Duplicate Processing).
  - Bật mã hóa SSE-SQS hoặc KMS để bảo vệ nội dung message giao dịch.
- **Nguyên tắc SRE:**
  - **Graceful Degradation & Queue Buffering:** Khi dịch vụ thanh toán (Payment Gateway hoặc Worker) bị sập hoặc nghẽn, Order API vẫn tiếp nhận đơn hàng thành công và đẩy vào SQS, bảo vệ trải nghiệm của khách hàng (Zero user-facing 500 errors).
  - **Poison Message Isolation:** Những message lỗi format hoặc gây crash worker không được phép làm nghẽn toàn bộ hàng đợi; chúng phải được cách ly vào DLQ để kỹ sư điều tra mà không làm ảnh hưởng đến các đơn hàng hợp lệ khác.
  - **KEDA Scalability Signal:** Chỉ số độ sâu hàng đợi (`ApproximateNumberOfMessagesVisible`) và tuổi của message lâu nhất (`ApproximateAgeOfOldestMessage`) là tín hiệu chuẩn mực để Kubernetes Event-driven Autoscaling (KEDA) tự động scale số lượng worker pods.

---

## 2. Thông số đầu vào (Input Parameters)

| Tham số | Dead-Letter Queue (DLQ) | Hàng đợi Chính (Main Queue) |
| :--- | :--- | :--- |
| **Queue Name** | `reliability-shop-dev-order-dlq` | `reliability-shop-dev-order-queue` |
| **Queue Type** | `Standard` | `Standard` |
| **Visibility Timeout** | 30 giây | 30 giây (gấp 3 lần p99 latency của worker) |
| **Message Retention** | `14 days` (tối đa để phân tích sự cố) | `4 days` (96 giờ) |
| **Delivery Delay** | 0 giây | 0 giây |
| **Maximum Message Size** | 256 KB | 256 KB |
| **Redrive Policy** | - | `maxReceiveCount` = 3 (chuyển sang DLQ sau 3 lần lỗi) |

---

## 3. Các bước thực hiện chi tiết trên AWS Console (Console Steps)

### Bước 1: Khởi tạo Dead-Letter Queue (DLQ) trước

*(Quy tắc SRE: Luôn tạo DLQ trước để có sẵn đích đến cho hàng đợi chính)*

1. Đăng nhập vào **AWS Console**, chọn Region `ap-southeast-1`.
2. Nhập `SQS` vào ô tìm kiếm -> Chọn dịch vụ **Simple Queue Service**.
3. Nhấp vào nút cam **Create queue**.
4. **Configuration:**
   - **Type:** Chọn **Standard** (Mặc định: thông lượng gần như không giới hạn).
   - **Name:** Nhập `reliability-shop-dev-order-dlq`.
5. **Configuration settings:**
   - **Visibility timeout:** `30 seconds`.
   - **Message retention period:** Chọn `14 days` (cho phép lưu giữ message lỗi 2 tuần để điều tra sự cố).
   - **Maximum message size:** `256 KB`.
   - **Receive message wait time:** `20 seconds` (Bật Long Polling để giảm số lượng request trống và tiết kiệm chi phí gọi API SQS).
6. **Encryption:**
   - Chọn **Amazon SQS key (SSE-SQS)** (miễn phí) hoặc **AWS Key Management Service key (SSE-KMS)** (chọn `alias/sre-platform-dev-main`).
7. **Tags:** Thêm `Environment` = `dev`, `Project` = `sre-platform`, `Component` = `payment-dlq`.
8. Nhấp nút **Create queue**.
9. Sao chép lại **URL** và **ARN** của DLQ vừa tạo.

---

### Bước 2: Khởi tạo Hàng đợi Chính và Gắn Redrive Policy

1. Quay lại trang **Queues** -> Nhấp nút cam **Create queue**.
2. **Configuration:**
   - **Type:** Chọn **Standard**.
   - **Name:** Nhập `reliability-shop-dev-order-queue`.
3. **Configuration settings:**
   - **Visibility timeout:** `30 seconds`.
   - **Message retention period:** `4 days`.
   - **Receive message wait time:** `20 seconds` (Long Polling).
4. **Encryption:**
   - Chọn tương tự như DLQ (SSE-SQS hoặc SSE-KMS).
5. **Dead-letter queue (Cấu hình tự động cách ly lỗi):**
   - Gạt công tắc sang **Enabled** (Bật).
   - **Select an existing queue:** Chọn `reliability-shop-dev-order-dlq`.
   - **Maximum receives:** Nhập `3`.
   *(Nghĩa là: Nếu một worker lấy message ra xử lý nhưng gặp lỗi hoặc crash 3 lần liên tiếp, SQS sẽ tự động di chuyển message đó sang DLQ)*.
6. **Tags:** Thêm `Environment` = `dev`, `Project` = `sre-platform`, `Component` = `order-queue`.
7. Nhấp nút **Create queue**.

---

## 4. Xác minh và Kiểm thử Gửi/Nhận Message (Verification)

### 4.1. Thử nghiệm gửi message từ SQS Console
1. Trong danh sách Queues, chọn `reliability-shop-dev-order-queue`.
2. Nhấp vào nút **Send and receive messages** ở góc trên bên phải.
3. **Send message:**
   - Tại ô **Message body**, dán payload JSON mô phỏng đơn hàng:
     ```json
     {
       "order_id": "ORD-2026-TEST-001",
       "user_id": "usr-12345",
       "amount": 99.50,
       "currency": "USD",
       "timestamp": "2026-10-21T01:50:00Z"
     }
     ```
   - Nhấp nút cam **Send message**.
4. **Receive messages:**
   - Cuộn xuống phần **Receive messages** -> Nhấp nút **Poll for messages**.
   - Xác nhận message vừa gửi xuất hiện trong bảng.
   - Nhấp vào ID message để xem chi tiết nội dung payload.
   - Chọn message -> Nhấp **Delete** để xóa message thử nghiệm.

### 4.2. Kiểm tra bằng AWS CLI
```bash
# Kiểm tra thuộc tính hàng đợi chính và liên kết RedrivePolicy
aws sqs get-queue-attributes \
  --queue-url $(aws sqs get-queue-url --queue-name reliability-shop-dev-order-queue --query 'QueueUrl' --output text) \
  --attribute-names All \
  --output table
```

---

## 5. Chuyển giao sang IaC (Terraform Snippet)

```hcl
# Dead-Letter Queue
resource "aws_sqs_queue" "order_dlq" {
  name                      = "reliability-shop-dev-order-dlq"
  message_retention_seconds = 1209600 # 14 ngày
  sqs_managed_sse_enabled   = true

  tags = {
    Environment = "dev"
    Project     = "sre-platform"
  }
}

# Main Queue trỏ sang DLQ
resource "aws_sqs_queue" "order_queue" {
  name                       = "reliability-shop-dev-order-queue"
  visibility_timeout_seconds = 30
  message_retention_seconds  = 345600 # 4 ngày
  receive_wait_time_seconds  = 20
  sqs_managed_sse_enabled    = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.order_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Environment = "dev"
    Project     = "sre-platform"
  }
}
```

---

## 6. Điều kiện hoàn thành Gate (Gate Check)

- [ ] Cả 2 hàng đợi (`reliability-shop-dev-order-queue` và `reliability-shop-dev-order-dlq`) được tạo thành công.
- [ ] Tính năng Redrive Policy được kích hoạt với `maxReceiveCount = 3` trỏ chính xác về DLQ.
- [ ] Thử nghiệm gửi và nhận message mẫu qua Console thành công.
- [ ] Không có secret hay token nhạy cảm nào được truyền vào message body.

---

## 7. Dọn dẹp tài nguyên (Cleanup)

1. Vào **SQS Console** -> Chọn `reliability-shop-dev-order-queue` -> Nhấp **Actions** -> **Purge** (nếu chỉ muốn làm sạch message tồn đọng).
2. Khi hủy hoàn toàn lab:
   - Xóa `reliability-shop-dev-order-queue`.
   - Xóa `reliability-shop-dev-order-dlq`.
