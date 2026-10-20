# 09.07 — Nghiệm thu Toàn diện Điều kiện Vận hành Thực tế (Production Go-Live Readiness Gate)

> **Trạng thái:** Biên bản nghiệm thu kỹ thuật cấp cao (Technical Readiness Review).  
> **Áp dụng cho:** Đánh giá chính thức trước khi quyết định cấp phép Go-Live hoặc thăng cấp từ môi trường `dev` sang `staging` và `prod`.

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Thực hiện quy trình rà soát toàn diện (**Operational Readiness Review - ORR**) dựa trên 7 trụ cột kỹ thuật của nền tảng AWS SRE Platform.
  - Xác thực rằng mọi bằng chứng đo đạc (Evidence) đã được đối chiếu, không có giả định chủ quan, và hệ thống đã vượt qua các bài kiểm tra tải k6 cũng như diễn tập sự cố GameDay.
  - Tổ chức hội đồng phê duyệt và ban hành quyết định chính thức: **GO** (Đủ điều kiện vận hành) hoặc **NO-GO** (Dừng lại khắc phục các rủi ro còn tồn đọng).
- **Nguyên tắc SRE:**
  - **Evidence-Based Decision:** Chỉ số và bằng chứng thực nghiệm là cơ sở duy nhất cho quyết định Go-Live; không chấp nhận việc "cho qua" vì áp lực tiến độ nếu các tiêu chí an toàn chưa đạt.
  - **No Unmitigated Critical Risks:** Bất kỳ rủi ro bảo mật (Critical CVE) hoặc điểm nghẽn kiến trúc (Single Point of Failure) nào chưa có biện pháp giảm thiểu đều là lý do bắt buộc để ra quyết định **NO-GO**.
  - **Operational Ownership Handover:** Nền tảng chỉ được coi là sẵn sàng khi đội ngũ vận hành đã có đầy đủ Runbooks, quyền truy cập dashboard và lịch trực On-call rõ ràng.

---

## 2. Bảng Kiểm tra Nghiệm thu Toàn diện 7 Trụ cột (Go-Live Audit Checklist)

### Trụ cột 1: Bảo mật và Danh tính (Security & Identity)
- [ ] Toàn bộ bí mật ứng dụng được quản lý qua AWS Secrets Manager và đồng bộ bằng ESO; không có plaintext secret trong Git.
- [ ] Dữ liệu tĩnh (EBS, RDS, S3, Secrets) được mã hóa bằng Customer Managed Key (`alias/sre-platform-dev-main`).
- [ ] GitHub Actions CI sử dụng AWS OIDC, không tạo Access Key dài hạn.
- [ ] EKS Pods sử dụng EKS Pod Identity với quyền hạn tối thiểu (Least Privilege).

### Trụ cột 2: Kiến trúc Mạng và Hạ tầng (Network & Infrastructure)
- [ ] VPC trải rộng trên tối thiểu 2 Availability Zones (`ap-southeast-1a` và `ap-southeast-1b`).
- [ ] Worker Nodes và Cơ sở dữ liệu nằm 100% trong Private Subnets, không có Public IP.
- [ ] Lưu lượng Internet chỉ đi qua ALB Ingress có gắn chứng chỉ ACM SSL/TLS hợp lệ.
- [ ] Security Groups áp dụng ma trận phân quyền theo nhóm, cấm mở `0.0.0.0/0` ở tầng compute và database.

### Trụ cột 3: Khả năng Quan sát Toàn diện (Observability)
- [ ] OpenTelemetry Collector thu thập và phân phối đầy đủ Metrics, Logs, Traces.
- [ ] 3 trụ cột liên kết tương quan hoàn hảo thông qua `trace_id` trên Grafana UI.
- [ ] Quy tắc cảnh báo Multi-Burn-Rate được nạp vào Prometheus và Alertmanager.
- [ ] Dashboard Golden Signals (RED & USE) và Error Budget hoạt động theo thời gian thực.

### Trụ cột 4: Tính Sẵn sàng Cao và Phục hồi (Resilience & High Availability)
- [ ] Pods được phân bổ đa vùng thông qua `topologySpreadConstraints` (maxSkew: 1).
- [ ] PodDisruptionBudget (PDB) bảo vệ dịch vụ khi có node bị drain hoặc bảo trì.
- [ ] Ứng dụng hỗ trợ Graceful Shutdown và tự động fall-back khi Redis gặp sự cố.
- [ ] Diễn tập GameDay chứng minh hệ thống sống sót khi mất 1 worker node mà không vi phạm SLO.

### Trụ cột 5: Khả năng Tự động Co giãn (Scalability)
- [ ] HPA tự động co giãn `order-service` theo ngưỡng CPU 70%.
- [ ] KEDA tự động scale `payment-worker` theo độ sâu hàng đợi SQS (Scale-to-Zero thành công).
- [ ] Karpenter v1.0+ cấp phát máy chủ EC2 mới trong vòng dưới 60 giây khi có tải đột biến.

### Trụ cột 6: Triển khai và Phát hành An toàn (Continuous Delivery)
- [ ] Toàn bộ hạ tầng Kubernetes được quản lý tập trung qua GitOps (Argo CD).
- [ ] Container Images sử dụng tag bất biến (Git SHA) và đã qua bước quét lỗ hổng Trivy.
- [ ] Chiến lược Canary với Argo Rollouts tự động phân tích metric và hỗ trợ instant rollback.

### Trụ cột 7: Quản trị Vận hành và Chi phí (FinOps & Operations)
- [ ] AWS Budgets ($50/tháng) đã kích hoạt với 3 ngưỡng cảnh báo gửi về email.
- [ ] ECR Lifecycle Policies tự động dọn dẹp images cũ để kiểm soát dung lượng S3.
- [ ] Diễn tập khôi phục thảm họa (Disaster Recovery Drill) chứng minh RPO < 5p và RTO < 20p.
- [ ] Sổ tay Runbook và mẫu Blameless Postmortem đã sẵn sàng cho đội ngũ On-call.

---

## 3. Mẫu Biên bản Quyết định Go-Live (Sign-off Template)

Lưu tại `sre/reliability-reports/go-live-readiness-signoff.md`:

```markdown
# BIÊN BẢN NGHIỆM THU ĐIỀU KIỆN GO-LIVE NỀN TẢNG
**Dự án:** AWS Cloud-Native SRE Platform (ReliabilityShop)  
**Môi trường:** `dev` -> Sẵn sàng thăng cấp `staging` / `prod`  
**Ngày đánh giá:** 2026-10-21  

---

### Kết quả Đánh giá Tổng thể:
- **Tổng số hạng mục kiểm toán:** 28 / 28 tiêu chuẩn ĐẠT (100%)
- **Số lỗ hổng Critical / High tồn đọng:** 0
- **Điểm yếu kiến trúc chưa khắc phục:** 0
- **Kết quả kiểm thử k6 Baseline:** Thông lượng 185 RPS, p95 = 142ms (< 300ms SLO), Error Rate = 0.016% (< 0.1% SLO).
- **Kết quả diễn tập GameDay:** Vượt qua bài test mất 1 EC2 Worker Node; hệ thống tự phục hồi trong 55 giây.

---

### QUYẾT ĐỊNH CỦA HỘI ĐỒNG:
[X] **APPROVED (GO)** — Nền tảng chính thức đạt tiêu chuẩn Site Reliability Engineering cấp doanh nghiệp. Cho phép thăng cấp GitOps sang môi trường Staging và Production.

[ ] **REJECTED (NO-GO)** — Cần khắc phục các điểm tồn đọng trước khi tái đánh giá.

---

### Chữ ký Phê duyệt (Signatures):
- **Lead SRE Engineer:** *(Signed)*
- **Cloud Infrastructure Architect:** *(Signed)*
- **Security & Compliance Officer:** *(Signed)*
- **Engineering Director:** *(Signed)*
```

---

## 4. Điều kiện hoàn thành Gate (Gate Check)

- [ ] 100% các tiêu chí trong Bảng Kiểm tra 7 Trụ cột được đánh dấu hoàn thành.
- [ ] Biên bản nghiệm thu Go-Live Sign-off được ký duyệt bởi các bên liên quan.
- [ ] Sẵn sàng bước sang Phase 10: Hoàn tất chuyển giao sang Terraform IaC và quy trình dọn dẹp tài nguyên (Handoff & Cleanup).
