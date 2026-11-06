# Module 09: SRE Validation, Resilience & Go-Live Gate

**Đánh giá readiness từ hành vi người dùng và dữ liệu đo được.**

[Labs](../README.md) / Module 09 · [Trước: Delivery & Scaling](../08-delivery-scaling/README.md) · [Tiếp: Handoff](../10-handoff-cleanup/README.md)

## 1. Tổng quan Module

Module 09 là bài kiểm định toàn diện và nghiêm ngặt nhất về độ tin cậy và khả năng vận hành thực tế của nền tảng (**Site Reliability Engineering Validation & Operational Readiness Review**):
- **Platform Smoke Test:** Chạy kịch bản tự động hóa kiểm thử hành trình người dùng đầu cuối (User Journey) xác thực 100% các thành phần phụ thuộc hoạt động trơn tru.
- **Toán học SLI/SLO & Error Budget Policy:** Định nghĩa công thức toán học chuẩn xác cho Availability SLI (99.9%) và Latency SLI (95% < 300ms); xây dựng chính sách đóng băng phát hành tính năng (Release Freeze) khi ngân sách lỗi bị cạn kiệt.
- **k6 Load Test Baseline Scorecard:** Thiết lập kịch bản kiểm thử tải thực tế với 5 giai đoạn, đo lường và lập bảng điểm cơ sở (Baseline Scorecard) cho thông lượng, độ trễ p95/p99 và mức tiêu hao tài nguyên.
- **Resilience Testing:** Thử nghiệm ngắt đột ngột Pods dưới tải cao, kiểm chứng PodDisruptionBudget (PDB) và kiểm tra khả năng tự động suy giảm tính năng (Graceful Degradation) khi Redis gặp sự cố.
- **Chaos GameDay: Worker Node Outage:** Diễn tập GameDay bắn hạ đột ngột một EC2 Worker Node tại Zone `ap-southeast-1a`, chứng minh Karpenter và cụm EKS tự động dọn dẹp và cấp phát node thay thế trong 55 giây.
- **Incident Triage Runbook & Postmortem:** Thiết lập quy trình trực chiến On-call, ma trận phân cấp sự cố (P1 - P4), và biểu mẫu báo cáo sự cố không đổ lỗi (Blameless Postmortem).
- **Go-Live Gate Sign-Off:** Thực hiện kiểm toán toàn diện 7 trụ cột sẵn sàng vận hành (Operational Readiness Review - ORR) và ký biên bản phê duyệt Go-Live chính thức.

---

## 2. Danh mục bài Lab chi tiết

| Bài Lab | Tiêu đề | Trọng tâm kỹ thuật | Console / CLI Path |
| :--- | :--- | :--- | :--- |
| [09.01](01-platform-smoke.md) | Platform Smoke | Xác nhận API và dependency | CLI / API |
| [09.02](02-sli-slo-error-budget.md) | SLI, SLO & Budget | Công thức, burn rate và release policy | Prometheus / Grafana |
| [09.03](03-k6-baseline.md) | k6 Baseline | RPS, p95/p99, error ratio | `performance/k6/` |
| [09.04](04-resilience-test.md) | Resilience | Pod failure, cache fallback, idempotency | Kubernetes / database |
| [09.05](05-chaos-gameday.md) | Chaos GameDay | Node outage và recovery timeline | EC2 / Kubernetes |
| [09.06](06-incident-runbook.md) | Incident Response | Severity, triage và postmortem | Runbooks / Alertmanager |
| [09.07](07-go-live-gate.md) | Go-Live Gate | Đánh giá readiness và người phê duyệt | Evidence / review |

---

## 3. Tiêu chí hoàn thành Module (Exit Gate)

- [ ] Kịch bản Smoke Test đạt 100% thành công trên tất cả các dịch vụ nội bộ và ngoại vi.
- [ ] k6 Load Test chạy ổn định ở 200 RPS với tỷ lệ lỗi < 0.1% và thời gian phản hồi p95 < 250ms.
- [ ] Cụm chịu đựng tốt khi mất 50% số pods nhờ cấu hình `PodDisruptionBudget` hợp lệ.
- [ ] Chaos GameDay chứng minh hệ thống phục hồi hoàn toàn sau sự cố sập node vật lý mà không làm gián đoạn người dùng quá 60 giây.
- [ ] 7 trụ cột kiểm toán ORR đều đạt xếp loại PASS.
- [ ] Biên bản Go-Live được ký duyệt chính thức bởi toàn bộ các bên liên quan.
