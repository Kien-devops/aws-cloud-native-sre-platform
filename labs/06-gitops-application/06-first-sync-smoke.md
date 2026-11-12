# 06.06 — First Sync & End-to-End Smoke Validation

> **Phạm vi:** Application Smoke Gate | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Full-Stack Path Verification:** Kiểm chứng trọn vẹn đường đi dữ liệu thực tế: `ALB Ingress -> frontend -> order-service -> RDS PostgreSQL (Outbox) -> SQS -> payment-worker -> Redis Cache`.

---

## 2. Bảng Kiểm tra Smoke Test

| Bước Kiểm tra | Thành phần Tham gia | Kết quả Mong đợi |
| :--- | :--- | :--- |
| **1. Health Endpoint** | ALB + `frontend` | `GET /health` trả về `HTTP 200` |
| **2. Order Create (Write)** | `order-service` + RDS + SQS | Tạo đơn hàng trả về `PENDING_PAYMENT`, ghi bảng `orders` & `order_outbox` |
| **3. Async Worker** | `payment-worker` + SQS | Tiêu thụ message, cập nhật trạng thái thành `PAID`, xóa message khỏi queue |
| **4. Cache-Aside (Read)** | `order-service` + Redis | Lần gọi 1: `MISS` (đọc RDS -> nạp Redis); Lần gọi 2: `HIT` (`< 2ms`) |

---

## 3. Chiến lược Tagging & Labels

| Tag / Metadata | Giá trị | Mục đích |
| :--- | :--- | :--- |
| `traceId` | OTel W3C Trace Context | Truy vết xuyên suốt từ HTTP request tới SQS worker trên Tempo |

---

## 4. Tham chiếu IaC / GitOps
- [sre/incidents/drill-canary-abort.md](../../sre/incidents/drill-canary-abort.md)

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
- **PASS:** 100% Pods `Running`, Shared ALB Target Groups `Healthy`, tạo đơn hàng test hoàn tất vòng đời `PENDING_PAYMENT -> PAID` và Cache Hit hoạt động chính xác.
