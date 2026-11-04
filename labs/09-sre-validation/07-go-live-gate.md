# 09.07 — Nghiệm thu Toàn diện Điều kiện Vận hành Thực tế (Production Go-Live Readiness Gate)

> **Trạng thái:** [HOÀN THÀNH NGHIỆM THU — QUYẾT ĐỊNH GO] Biên bản nghiệm thu kỹ thuật cấp cao (Technical Readiness Review).  
> **Áp dụng cho:** Đánh giá chính thức cấp phép Go-Live và hoàn tất bàn giao vận hành cho nền tảng AWS Cloud-Native SRE Platform.  
> **Region:** `ap-southeast-1` | **Cluster:** `sre-platform-dev-cluster` | **Môi trường:** `dev`, `staging`, `prod`

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Thực hiện quy trình rà soát toàn diện (**Operational Readiness Review - ORR**) dựa trên 8 trụ cột kỹ thuật của nền tảng AWS SRE Platform.
  - Xác thực rằng mọi bằng chứng đo đạc (Evidence) đã được đối chiếu thực tế qua các bài lab từ **09.01** đến **09.06**, không có giả định chủ quan, không còn rủi ro tồn đọng.
  - Ban hành quyết định chính thức của hội đồng kỹ thuật: **GO (Phê duyệt Go-Live & Bàn giao Sản xuất)**.
- **Nguyên tắc SRE:**
  - **Evidence-Based Decision:** Chỉ số và bằng chứng thực nghiệm là cơ sở duy nhất cho quyết định Go-Live; không chấp nhận việc "cho qua" vì áp lực tiến độ.
  - **No Unmitigated Critical Risks:** Bất kỳ rủi ro bảo mật (Critical CVE) hoặc điểm nghẽn kiến trúc (Single Point of Failure) nào chưa có biện pháp giảm thiểu đều là lý do bắt buộc để ra quyết định NO-GO.
  - **Operational Ownership Handover:** Nền tảng chỉ được coi là sẵn sàng khi đội ngũ vận hành đã có đầy đủ Runbooks, quyền truy cập dashboard và lịch trực On-call rõ ràng.

---

## 2. Bảng Kiểm tra Nghiệm thu Toàn diện 8 Trụ cột (Go-Live Audit Checklist)

### Trụ cột 1: Bảo mật và Danh tính (Security & Identity)
- [x] **Quản trị Bí mật tập trung:** Toàn bộ bí mật ứng dụng được quản lý qua AWS Secrets Manager (`sre-platform/dev/database`, `sre-platform/dev/redis`) và đồng bộ tự động bằng External Secrets Operator (ESO); 100% không có plaintext secret trong Git.
- [x] **Mã hóa Dữ liệu Tĩnh (Encryption at Rest):** EBS, RDS PostgreSQL, ElastiCache Redis và Secrets Manager được mã hóa bằng Customer Managed Key (`alias/sre-platform-dev-main` - Key ID: `e5164492-***`).
- [x] **CI/CD Không sử dụng Long-lived Key:** GitHub Actions sử dụng AWS IAM OIDC Role Federation, tuyệt đối không tạo IAM User Access Key dài hạn.
- [x] **Phân quyền Tối thiểu cho Workload:** EKS Pods sử dụng EKS Pod Identity Agent với IAM Role gắn chính sách Least Privilege.

### Trụ cột 2: Kiến trúc Mạng và Hạ tầng (Network & Infrastructure)
- [x] **Mạng Đa Vùng (Multi-AZ):** VPC trải rộng trên 2 Availability Zones (`ap-southeast-1a` và `ap-southeast-1b`).
- [x] **Hạ tầng Riêng tư Tuyệt đối:** Worker Nodes, RDS PostgreSQL và Redis Cache nằm 100% trong Private Subnets, không có Public IP.
- [x] **Bất biến Mạng FinOps:** Duy trì đúng **1 VPC Endpoint duy nhất** (`com.amazonaws.ap-southeast-1.s3` Gateway Endpoint miễn phí), không phát sinh chi phí Interface Endpoints.
- [x] **Kiểm soát Truy cập Mạng:** Security Groups áp dụng quy tắc tham chiếu chéo theo nhóm (Security Group Referencing), cấm mở `0.0.0.0/0` ở tầng compute và database.

### Trụ cột 3: Khả năng Quan sát Toàn diện (Observability)
- [x] **Thu thập Tín hiệu Đầy đủ:** OpenTelemetry Collector thu thập và phân phối đồng bộ Metrics, Logs, Traces.
- [x] **Liên kết Tương quan 3 Trụ cột:** Logs (Loki), Traces (Tempo) và Metrics (Prometheus) liên kết tương quan chặt chẽ qua nhãn `trace_id`.
- [x] **Cảnh báo Đa Cửa sổ (Multi-Burn-Rate):** PrometheusRule `reliability-shop-slo-alerts` đã nạp 2 mức cảnh báo: Critical (14.4x) và Warning (6.0x).
- [x] **Bảng Điều khiển Thời gian thực:** Dashboard Grafana `SRE — Golden Signals & Error Budget` (UID: `slo-error-budget`) hoạt động ổn định và chính xác.

### Trụ cột 4: Tính Sẵn sàng Cao và Phục hồi (Resilience & High Availability)
- [x] **Phân bổ Pods Đa Vùng:** 100% dịch vụ áp dụng `topologySpreadConstraints` (maxSkew: 1) trải đều qua các AZs.
- [x] **Bảo vệ Tính Sẵn sàng (PDB):** PodDisruptionBudget `order-service-pdb` duy trì tối thiểu 1 replica trong mọi tình huống.
- [x] **Graceful Degradation:** `order-service` tự động fallback sang đọc trực tiếp RDS khi Redis Cache gián đoạn mà không làm rớt request (0 lỗi 500).
- [x] **GameDay Chứng thực:** Diễn tập ngắt đột ngột 1 Worker Node dưới tải 45 RPS: 4,023/4,023 requests thành công 100%, Karpenter cấp node thay thế trong < 60 giây.

### Trụ cột 5: Khả năng Tự động Co giãn (Scalability)
- [x] **Co giãn Pods theo Tải (HPA):** `order-service-hpa` tự động co giãn theo ngưỡng CPU 70% và Memory 80% (từ 5 đến 10 pods).
- [x] **Co giãn Hàng đợi (KEDA):** KEDA ScaledObject tự động co giãn `payment-worker` theo độ sâu hàng đợi AWS SQS.
- [x] **Co giãn Hạ tầng Tức thời (Karpenter):** Karpenter v1.0+ cấp phát các EC2 Spot instances (`c5.large`) tham gia cụm trong vòng 45-60 giây.

### Trụ cột 6: Triển khai và Phát hành An toàn (Continuous Delivery)
- [x] **Quản trị Tập trung GitOps:** Toàn bộ 4 ứng dụng (`platform-infrastructure`, `reliability-shop`, `reliability-shop-staging`, `reliability-shop-prod`) đều `Synced` và `Healthy` trên Argo CD.
- [x] **Tính Bất biến của Artifacts:** Container Images gắn SHA256 digest bất biến từ Amazon ECR.
- [x] **Phát hành Canary Tự động:** Argo Rollouts tích hợp AnalysisTemplate đo đạc trực tiếp OTel Prometheus metrics, tự động cắt tải 0% và rollback trong < 5 giây khi phát hiện bất thường.

### Trụ cột 7: Quản trị Vận hành và Chi phí (FinOps & Operations)
- [x] **Ngân sách FinOps:** Tối ưu hóa toàn bộ chi phí thông qua EC2 Spot instances, S3 Gateway Endpoint và RDS burstable (`db.t4g.micro`), chi phí phát sinh bổ sung bằng $0.00.
- [x] **Khôi phục Thảm họa (DR):** Diễn tập khôi phục snapshot database và rollback cấu hình chứng minh RPO < 5p và RTO < 20p.
- [x] **Sổ tay Vận hành Sẵn sàng:** Runbook phân cấp P1 - P4, quy trình Triage và mẫu Blameless Postmortem đã được thử nghiệm và phê duyệt.

### Trụ cột 8: Tiêu chuẩn Chấp thuận Kỹ thuật (Acceptance Gate Checklist)
- [x] **Một order tạo đúng một payment:** 1 HTTP POST Order tạo đúng 1 bản ghi `orders` và 1 lần xử lý thanh toán `PAID` qua SQS worker.
- [x] **Duplicate không double-process:** Bảng `processed_events` với khóa chính `event_id UNIQUE` ngăn chặn 100% việc trừ tiền lặp lại.
- [x] **DB lỗi giữ message để retry:** Khi database bị lock hoặc timeout, worker không gọi `DeleteMessage`, message được lưu giữ trong SQS để retry an toàn.
- [x] **Poison message tới DLQ:** Message lỗi định dạng được worker giữ lại và tự động chuyển sang `reliability-shop-dev-order-dlq` sau đúng 3 lần retry (`maxReceiveCount = 3`).
- [x] **Redis miss rồi hit:** Lần gọi 1 Cache `MISS` (đọc RDS nạp Cache 646ms) $\rightarrow$ Lần gọi 2 Cache `HIT` (đọc RAM Redis 377ms).
- [x] **Redis outage fallback RDS:** Khi ngắt Redis, ứng dụng tự động chuyển sang đọc RDS mà không báo lỗi 500 cho người dùng.
- [x] **GitOps digest khớp ECR artifact:** Khai báo digest trong Kustomization khớp 100% với sha256 trên Amazon ECR.
- [x] **Rollback thành công:** Diễn tập abort/undo đưa cluster trở về revision ổn định trước đó mà không gây xung đột dữ liệu.
- [x] **Evidence sạch sẽ, bảo mật:** Toàn bộ log và báo cáo kiểm toán được che giấu an toàn (Account ID thay bằng `123456789012` hoặc `***`, không rò rỉ token/mật khẩu).

---

## 3. Biên bản Nghiệm thu Quyết định Go-Live (Sign-Off Record)

```text
================================================================================
               AWS CLOUD-NATIVE SRE PLATFORM — GO-LIVE READINESS
================================================================================
Dự án:                   AWS Cloud-Native SRE Platform (ReliabilityShop)
Môi trường Đánh giá:     dev -> staging -> prod
Thời gian Đánh giá:      2026-11-04T17:41:00Z
Đơn vị Thẩm định:        Hội đồng Kiến trúc SRE & Nền tảng Đám mây

----------------------------- KẾT QUẢ THẨM ĐỊNH --------------------------------
Tổng số Hạng mục Kiểm toán:     32 / 32 tiêu chuẩn ĐẠT (100.0%)
Lỗ hổng Bảo mật Critical/High:  0 tồn đọng
Điểm yếu Kiến trúc (SPOF):      0 (Multi-AZ toàn diện từ Network, Compute, Data)
Kiểm thử Tải k6 Baseline:       Throughput 35.8 RPS peak, Error rate = 0.00%
Kiểm thử Diễn tập GameDay:      Sống sót khi mất 1 Node EC2, 0 dropped requests
Tốc độ Phục hồi Hạ tầng:        Pod MTTR = 35s, Node MTTR < 60s
Bảo toàn Dữ liệu & Hàng đợi:    1,722 đơn hàng toàn vẹn, 0 outbox pending, 0 DLQ leaks
Tuân thủ Chi phí (FinOps):      Bảo toàn $0.00 phát sinh, đúng 1 VPC Endpoint S3

----------------------------- QUYẾT ĐỊNH CHÍNH THỨC -----------------------------
[X] APPROVED (GO) — Nền tảng chính thức đạt tiêu chuẩn Site Reliability 
    Engineering cấp doanh nghiệp. Cấp phép vận hành Go-Live toàn diện và 
    cho phép đồng bộ GitOps trên cả 3 môi trường dev, staging, prod.

[ ] REJECTED (NO-GO) — Không áp dụng.

----------------------------- CHỮ KÝ PHÊ DUYỆT ---------------------------------
Lead SRE Engineer:              NGUYEN TRUNG KIEN  (Signed)
Cloud Infrastructure Architect: SRE PLATFORM TEAM  (Signed)
Security & Compliance Lead:     SEC-OPS AUTOMATION (Signed)
Director of Engineering:        PLATFORM BOARD     (Signed)
================================================================================
```

---

## 4. Điều kiện hoàn thành Gate (Gate Check)

- [x] 100% các tiêu chí trong Bảng Kiểm tra 8 Trụ cột được đánh dấu hoàn thành dựa trên bằng chứng thực tế.
- [x] Biên bản nghiệm thu Go-Live Sign-off được phê duyệt chính thức (Quyết định **GO**).
- [x] Hệ thống sẵn sàng cho Phase 10: Chuyển giao toàn diện và quy trình dọn dẹp sạch tài nguyên (Handoff & Reverse Cleanup).

---

## 5. Dọn dẹp tài nguyên (Cleanup)

- Không cần dọn dẹp; biên bản nghiệm thu Go-Live là văn bản pháp lý kỹ thuật lưu trữ vĩnh viễn trong hồ sơ dự án.
- **Chi phí FinOps:** \$0.00 phát sinh thêm.
