# 03.02 — Amazon SQS Queues & Dead-Letter Queue (DLQ)

> **Phạm vi:** Asynchronous Messaging & Poison-Pill Isolation | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Environment Isolation:** Mỗi môi trường (`dev`, `staging`, `prod`) sử dụng cặp Queue + DLQ riêng biệt, tránh xung đột consumer giữa các namespace trên cùng EKS cluster.
- **Poison Pill Protection:** Cấu hình Redrive Policy `maxReceiveCount = 3` — thông điệp lỗi quá 3 lần tự động chuyển sang DLQ để bảo vệ `payment-worker` khỏi crash loop.
- **Encryption at Rest:** Bật SSE-KMS với khóa `alias/sre-platform-dev-main`.

---

## 2. Đặc tả Tài nguyên (Resource Inventory & Config)

| Môi trường | Main Queue Name | Dead-Letter Queue (DLQ) | Tham số Cấu hình Cốt lõi |
| :--- | :--- | :--- | :--- |
| **Dev** | `reliability-shop-dev-order-queue` | `reliability-shop-dev-order-dlq` | Type: `Standard`, Visibility Timeout: `30s`, Retention: `4 days` (Main) / `14 days` (DLQ), `maxReceiveCount = 3`, KMS: `alias/sre-platform-dev-main` |
| **Staging** | `reliability-shop-staging-order-queue` | `reliability-shop-staging-order-dlq` | Tương tự cấu hình Dev, cô lập KEDA scaler theo môi trường |
| **Prod** | `reliability-shop-prod-order-queue` | `reliability-shop-prod-order-dlq` | Tương tự cấu hình Dev, có CloudWatch Alarm cảnh báo DLQ > 0 |

---

## 3. Chiến lược Tagging & Labels

| Tag Key | Tag Value | Mục đích |
| :--- | :--- | :--- |
| `Name` | `reliability-shop-<env>-order-{queue,dlq}` | Định danh hàng đợi |
| `Project` | `sre-platform` | Phân bổ chi phí |
| `Environment` | `dev` \| `staging` \| `prod` | Cô lập môi trường |

---

## 4. Tham chiếu IaC / GitOps
- [05-messaging.tf](../../iac/terraform/envs/dev/05-messaging.tf) — Khai báo `order_queue`, `order_dlq` và `redrive_policy`.
- [keda-scaledobject.yaml](../../gitops/applications/reliability-shop/base/keda-scaledobject.yaml) — KEDA scale `payment-worker` theo queue length.

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
```bash
aws sqs list-queues --queue-name-prefix reliability-shop --region ap-southeast-1
```
- **PASS:** Có đủ Queue & DLQ cô lập theo môi trường, `RedrivePolicy` cấu hình `maxReceiveCount = 3`, bật KMS encryption.
