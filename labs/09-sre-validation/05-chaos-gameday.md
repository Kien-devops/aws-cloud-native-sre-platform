# 09.05 — Chaos Engineering GameDay Scenarios

> **Phạm vi:** Controlled Fault Injection & Auto-Remediation | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Verify Failure Modes Under Load:** Không chờ sự cố thật mới biết hệ thống có tự phục hồi hay không; chủ động tiêm lỗi có kiểm soát trong khi k6 đang chạy tải liên tục.

---

## 2. Đặc tả 4 Kịch bản Diễn tập (GameDay Matrix)

| Kịch bản | Tác động Tiêm lỗi | Cơ chế Tự Phục hồi & Kết quả Đạt |
| :--- | :--- | :--- |
| **1. EC2 Node Termination** | Terminate nóng 1 EC2 Worker Node (AZ-1a) khi k6 chạy 45–68 RPS | ALB chuyển 100% traffic sang AZ-1b (`0` dropped reqs); Karpenter cấp Spot node mới trong `< 60 giây` |
| **2. SQS Poison Pill** | Bơm thông điệp lỗi schema vào `order-queue` | Retry 3 lần -> SQS Redrive đẩy sang `order-dlq` (`40` msgs isolated); Worker không crash loop |
| **3. Redis Cache Failure** | Ngắt/chặn kết nối tới ElastiCache Redis | `order-service` tự fallback sang đọc RDS PostgreSQL (Graceful Degradation, `0%` 5xx) |
| **4. Canary Fault Injection** | Deploy bản lỗi tăng 5xx lên `> 1%` | Argo Rollouts `AnalysisTemplate` tự Abort & chuyển 100% traffic về Stable |

---

## 3. Chiến lược Tagging & Labels
- Bằng chứng GameDay lưu tại `docs/images/evidence/aws-ec2-gameday-node-termination.png` và sơ đồ `docs/images/architecture/sre-chaos-resilience-drawio.png`.

---

## 4. Tham chiếu IaC / GitOps
- [chaos/README.md](../../chaos/README.md)
- [sre/incidents/drill-canary-abort.md](../../sre/incidents/drill-canary-abort.md)

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
- **PASS:** Cả 4 kịch bản tự động cô lập lỗi hoặc tự phục hồi đúng SLA, không mất dữ liệu đơn hàng trong RDS.
