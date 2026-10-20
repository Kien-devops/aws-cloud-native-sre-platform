# 03.02 - Amazon SQS và DLQ

## Mục tiêu

Tạo queue xử lý bất đồng bộ, dead-letter queue và redrive policy cho worker.

## Input

- Tên queue chính/DLQ, Region, retention, visibility timeout.
- Thời gian xử lý tối đa của worker và ngưỡng retry.
- KMS key và IAM role đọc/ghi queue.

## Console steps

1. Mở **Amazon SQS > Queues > Create queue**; tạo DLQ trước.
2. Chọn **Standard** trừ khi nghiệp vụ cần FIFO; đặt retention và encryption.
3. Tạo queue chính, đặt **Visibility timeout** lớn hơn thời gian xử lý bình thường.
4. Trong **Dead-letter queue**, bật redrive và chọn DLQ; giới hạn `maxReceiveCount`.
5. Gắn tags môi trường/owner/cost-center; không ghi secret vào message mẫu.

## Verify

- Queue chính trỏ đúng DLQ, Region và KMS.
- Ghi URL/ARN, visibility timeout, retention và `maxReceiveCount`.
- Message thử nghiệm được xóa sau kiểm tra.

## Output

- **Expected:** queue, DLQ và redrive policy hoạt động đúng.
- **Measured Result:** Chưa thực hiện; ghi queue attributes đã redact.

Queue URL/ARN, DLQ URL/ARN, redrive policy, encryption, retention và timestamp.

## Gate

Producer có `SendMessage`, worker có receive/delete/change-visibility tối thiểu; DLQ alert/retention đã xác định.

## Cleanup

Purge message thử nghiệm, không xóa queue đang được workload dùng.

