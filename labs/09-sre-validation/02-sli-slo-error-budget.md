# 09.02 — SLI, SLO & Error Budget Policy

> **Phạm vi:** Reliability Targets & Governance | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Quantifiable Reliability:** Định nghĩa rõ chỉ số đo lường (SLI) và mục tiêu cam kết (SLO) làm căn cứ kích hoạt cảnh báo hoặc đóng băng release khi Error Budget cạn kiệt.

---

## 2. Đặc tả Bảng SLI / SLO (`reliability-shop`)

| Chỉ số | Định nghĩa SLI | Mục tiêu SLO (30 ngày) | Kết quả Đo đạc Thực tế |
| :--- | :--- | :--- | :--- |
| **Availability** | Tỷ lệ HTTP requests không trả về `5xx` | `>= 99.9%` (Error Budget: `43.2 phút/tháng`) | `100.00%` (0.00% 5xx) |
| **Latency (P95)** | Thời gian phản hồi tại phân vị 95 | `<= 500 ms` | `134.8 ms` (Dưới tải k6) |
| **Async Durability** | Tỷ lệ đơn hàng xử lý không mất dữ liệu | `100%` (Zero Data Loss qua Outbox + DLQ) | `100%` |

---

## 3. Chính sách Error Budget

| Mức Tiêu thụ Error Budget | Hành động Bắt buộc |
| :--- | :--- |
| `< 50%` | Triển khai tính năng bình thường qua GitOps |
| `50% – 80%` | Tăng cường kiểm thử Canary & rà soát latency |
| `> 100%` | **Feature Freeze**: Ngừng deploy tính năng mới, ưu tiên 100% cho reliability fixes |

---

## 4. Tham chiếu IaC / GitOps
- [sre/slos/service-slos.yaml](../../sre/slos/service-slos.yaml)
- [sre/slos/error-budget/policy.md](../../sre/slos/error-budget/policy.md)

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
- **PASS:** Grafana Error Budget Dashboard hiển thị đầy đủ dữ liệu SLI từ Prometheus, không vi phạm ngưỡng burn-rate.
