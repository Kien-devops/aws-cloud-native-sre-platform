# 09.03 — k6 In-Cluster Load & Performance Testing

> **Phạm vi:** Performance Baseline & Capacity Validation | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **In-Cluster & Edge Load Testing:** Kiểm chứng hiệu năng toàn bộ chuỗi ALB -> Microservices -> RDS/Redis/SQS dưới tải đồng thời cao, xác định ngưỡng chịu tải và kích hoạt HPA/KEDA/Karpenter tự động.

---

## 2. Đặc tả Kịch bản & Kết quả Chuẩn (`performance/k6/`)

| Kịch bản | File Script | Tham số Tải | Kết quả Gate Đạt Chuẩn |
| :--- | :--- | :--- | :--- |
| **Smoke** | `performance/k6/smoke/smoke.js` | `1–5 VUs`, `1m` | `0%` errors |
| **Load (Baseline)** | `performance/k6/sre-load-test.js` | `50–68 RPS`, `2,712 transactions` | `0.00%` HTTP 5xx, P95 `134.8ms` (`< 500ms`), P99 `215ms` |
| **Spike / Stress** | `spike.js` / `stress.js` | Ramp-up đột biến | HPA & KEDA scale pods mượt, không `OOMKilled` |

---

## 3. Chiến lược Tagging & Labels
- Mọi đơn hàng tạo bởi k6 có thể gắn metadata `source: k6-load-test` để dễ thống kê hoặc dọn dẹp sau test.

---

## 4. Tham chiếu IaC / GitOps
- [performance/README.md](../../performance/README.md)
- [performance/k6/sre-load-test.js](../../performance/k6/sre-load-test.js)

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
- **PASS:** `http_req_failed < 1%` (thực tế `0.00%`), `http_req_duration P95 < 500ms`, không có Pod restart hay connection pool exhaustion trên RDS/Redis.
