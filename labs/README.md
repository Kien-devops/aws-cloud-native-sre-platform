# Labs Triển khai AWS Cloud-Native SRE Platform

**11 module nối liền AWS foundation, GitOps delivery và vận hành SRE.**

[Trang chủ](../README.md) / Labs · [Tài liệu](../docs/README.md) · [Bắt đầu tại Module 00](00-chuan-bi/README.md)

> [!NOTE]
> Các gate là tiêu chí thực hành; ảnh và scorecard là hồ sơ của lần thu thập trước. Kiểm tra prerequisite, revision và dependency trong README từng module trước khi thực thi lệnh thay đổi tài nguyên.

Hệ thống tài liệu hướng dẫn thực hành (Labs) chi tiết từng bước trên **AWS Management Console kết hợp GitOps (Argo CD)** để xây dựng nền tảng Cloud-Native SRE Platform cấp doanh nghiệp.

> [!IMPORTANT]
> **Quy chuẩn Phạm vi Kỹ thuật (Scope Invariant):**
> **Loại toàn bộ IaC (Terraform, import, plan, apply) khỏi phạm vi triển khai.** Toàn bộ hạ tầng đám mây được khởi tạo và cấu hình trực tiếp qua **AWS Management Console**, toàn bộ tài nguyên Kubernetes và phân phối ứng dụng được điều phối tự động qua **GitOps với Argo CD v2.11+**.

Chuỗi bài lab dẫn dắt từ một tài khoản AWS trắng, qua 11 Module tuần tự, đạt đầy đủ các tiêu chuẩn khắt khe về **Bảo mật (Security)**, **Độ tin cậy (Resilience)**, **Khả năng quan sát (Observability)**, **Tự động mở rộng (Scalability)**, và **Tối ưu chi phí (FinOps)** trước khi chuyển giao chính thức.

---

## 1. Bản đồ Tổng thể 11 Module Triển khai (Console + GitOps)

```text
[00 Chuẩn bị]           --> Thiết lập tài khoản, Region ap-southeast-1, Naming, Budget $50
      |
      v
[01 IAM & Security]     --> GitHub OIDC, KMS CMK, CloudTrail, GuardDuty, Gitleaks
      |
      v
[02 Network]            --> 3-Tier VPC đa AZ (10.0.0.0/16), NAT, S3 Gateway Endpoint, SG Matrix
      |
      v
[03 Foundation]         --> ECR Repos, SQS Queue & DLQ, RDS PostgreSQL (Outbox), ElastiCache Redis
      |
      v
[04 EKS Platform]       --> EKS v1.30, AL2023 Managed Node Group, Add-ons, EKS Pod Identity
      |
      v
[05 Secrets & Ingress]  --> Secrets Manager, ACM SSL, External Secrets Operator, AWS Load Balancer Controller
      |
      v
[06 GitOps Application] --> Argo CD v2.11+, Root App, ConfigMap/Secret Split, KEDA, Image Digest Pinning
      |
      v
[07 Observability]      --> OTel Collectors, Prometheus, Loki/Tempo, CloudWatch Alarms (DLQ), Runbook Replay
      |
      v
[08 Delivery & Scaling] --> CI Build & Scan (Trivy), Quy trình Deploy 4 bước, KEDA, Karpenter, Rollback Git Revert
      |
      v
[09 SRE Validation]     --> Phase 1-2 Baseline & Controlled Test, k6 Load Test, Resilience & Acceptance Gate
      |
      v
[10 Handoff & Cleanup]  --> Resource Inventory, GitOps Drift Reconciliation, DR Restore, Reverse Teardown ($0.00)
```

---

## 2. Kế hoạch Thực thi Chuẩn (Plan Cuối & Acceptance Gate)

Dự án tuân thủ nghiêm ngặt **8 Phase Vận hành** và bộ tiêu chí kiểm định **Acceptance Gate**:

### 8 Phase Vận hành:
1. **Phase 1: Live Baseline (Read-Only):**
   - Kiểm tra EKS, add-ons, nodes, Argo CD, Pods, target group health trên Shared ALB.
   - Kiểm tra RDS, Redis, SQS/DLQ, ECR, Pod Identity, Security Groups.
   - Ghi nhận evidence đã redact; **bất biến: không tạo thêm VPC endpoint mới**.
2. **Phase 2: Controlled Live Test (Cần duyệt trước):**
   - Tạo đúng một order có test ID duy nhất.
   - Xác minh RDS ghi nhận `PENDING_PAYMENT`.
   - Xác minh SQS: Send -> Receive -> Delete.
   - Xác minh worker cập nhật trạng thái `PAID`.
   - Gọi danh sách order hai lần: Lần 1 Redis `MISS` -> đọc RDS -> nạp Cache; Lần 2 Redis `HIT`.
   - Lưu timestamp, log, metric; tuyệt đối không đọc hoặc để lộ secret value.
3. **Phase 3: Sửa Correctness trong mã nguồn (`app3`):**
   - Atomic Transaction: `orders + order_outbox` trong cùng 1 transaction.
   - Event schema chuẩn: `eventId`, `schemaVersion`, `orderId`, `traceId`.
   - Consumer idempotent qua bảng `processed_events(event_id UNIQUE)`.
   - Chỉ gọi `DeleteMessage` SQS sau khi DB transaction đã commit thành công.
   - Poison message tự động retry rồi chuyển sang DLQ sau 3 lần nhận lỗi.
   - Redis lỗi tự động fallback sang đọc RDS PostgreSQL (Graceful degradation).
   - Bật xác minh TLS certificate nội bộ.
   - Bỏ toàn bộ endpoint/account hardcode khỏi mã nguồn.
4. **Phase 4: Trực quan hóa Queue/Redis rõ trên UI:**
   - Visual timeline: `DB_COMMITTED → EVENT_PUBLISHED → CONSUMED → PAID`.
   - Hiển thị cache badge: `MISS → RDS → CACHED → HIT`.
   - Trạng thái mặc định `UNKNOWN`, truy vấn từ API thật (không hardcode trạng thái thành công).
   - Bỏ thông báo gây hiểu lầm “SRE 100%”.
   - Mục Diagnostics chuyển sang chế độ read-only.
   - Sửa triệt để lỗ hổng XSS từ việc gán `innerHTML` (chuyển sang `textContent`).
5. **Phase 5: Kiểm thử và CI Pipeline:**
   - Test kịch bản: DB lỗi không được xóa message.
   - Test kịch bản: SQS lỗi không làm mất outbox event.
   - Test kịch bản: Duplicate message chỉ xử lý đúng một lần.
   - Test kịch bản: Poison message vào DLQ sau đúng 3 lần retry.
   - Test kịch bản: Redis down vẫn đọc được dữ liệu từ RDS.
   - CI Pipeline: `npm ci` → test → scan (Trivy) → build → push ECR bằng SHA digest.
   - Không khai báo/tuyên bố test coverage giả.
6. **Phase 6: Quản trị GitOps:**
   - Khai báo tường minh `reliability-shop-sa` (EKS Pod Identity) trong GitOps.
   - Tách biệt: ConfigMap chứa endpoint phi nhạy cảm, ExternalSecret chỉ chứa credentials.
   - Pin image bằng SHA digest bất biến (`@sha256:...`).
   - CI tạo PR cập nhật GitOps; tuyệt đối cấm dùng `kubectl apply` trực tiếp.
   - Tích hợp KEDA ScaledObject cho `payment-worker` sau khi consumer đã idempotent.
7. **Phase 7: Quy trình Deploy An Toàn (Cần duyệt trước push):**
   - **Bước 1:** Additive DB migration trước (không bao giờ drop table hay column).
   - **Bước 2:** Deploy worker tương thích ngược (xử lý cả schema cũ lẫn mới).
   - **Bước 3:** Deploy producer / outbox.
   - **Bước 4:** Deploy UI cuối cùng.
   - Argo CD sync → progressive rollout → smoke test.
   - Rollback bằng Git revert commit về image digest cũ; tuyệt đối không rollback/xóa bảng mới.
8. **Phase 8: Console Observability:**
   - CloudWatch Alarm: SQS DLQ `ApproximateNumberOfMessagesVisible > 0`.
   - CloudWatch Alarm: SQS Oldest-Message Age `ApproximateAgeOfOldestMessage > 300s`.
   - CloudWatch Dashboard: Queue depth/send/receive/delete, Redis hit ratio/errors/latency, RDS connections/CPU/storage.
   - SRE Runbook: Replay DLQ có phê duyệt an toàn.

---

### Tiêu chí Nghiệm thu Chấp thuận (Acceptance Gate):
- [ ] Một order tạo đúng một payment.
- [ ] Duplicate message không double-process (`processed_events` uniqueness).
- [ ] DB lỗi giữ message trong SQS để retry (không gọi DeleteMessage).
- [ ] Poison message chuyển tới DLQ sau 3 lần retry.
- [ ] Redis miss rồi hit; Redis outage fallback đọc RDS thành công.
- [ ] GitOps image digest khớp 100% với artifact trên Amazon ECR.
- [ ] Rollback thành công qua Git revert commit mà không hỏng database.
- [ ] Toàn bộ Evidence log được che giấu Account ID và không chứa secret.

---

## 3. Bảng Mục lục Chi tiết Từng Module & Bài Lab

| Module | Tên Module & Mục tiêu | Danh sách bài Lab chi tiết |
| :--- | :--- | :--- |
| [Module 00](00-chuan-bi/README.md) | Chuẩn bị | Account, identity, naming, budget và evidence |
| [Module 01](01-iam-security/README.md) | IAM & Security | OIDC, KMS, audit và secret prevention |
| [Module 02](02-network/README.md) | Networking | VPC, routes, endpoints, security groups và flow logs |
| [Module 03](03-foundation-services/README.md) | Foundation Services | ECR, SQS, PostgreSQL, Redis và backup |
| [Module 04](04-eks-platform/README.md) | EKS Platform | Cluster, node groups, add-ons và Pod Identity |
| [Module 05](05-secrets-ingress/README.md) | Secrets & Ingress | Secrets Manager, ACM, DNS, ESO và ALB |
| [Module 06](06-gitops-application/README.md) | GitOps Application | Argo CD, projects, base, overlays và smoke test |
| [Module 07](07-observability/README.md) | Observability | OTel, Prometheus, Loki, Tempo, Grafana và CloudWatch |
| [Module 08](08-delivery-scaling/README.md) | Delivery & Scaling | CI, promotion, HPA, KEDA, Karpenter và canary |
| [Module 09](09-sre-validation/README.md) | SRE Validation | SLO, performance, resilience, GameDay và readiness |
| [Module 10](10-handoff-cleanup/README.md) | Handoff & Cleanup | Ownership, drift, restore, cleanup và cost audit |

---

## 4. Quy ước Chung Bắt buộc

1. **Console Path:** Luôn cung cấp đường dẫn điều hướng chính xác trên AWS Management Console (Ví dụ: `Amazon EKS > Clusters > [Cluster Name] > Compute`).
2. **Handoff Principle (Console + GitOps):** Tách bạch tuyệt đối vai trò: AWS Management Console quản lý các tài nguyên hạ tầng đám mây (VPC, Subnet, RDS, SQS, KMS, EKS Cluster, NodeGroups); Argo CD quản lý toàn bộ tài nguyên triển khai trong Kubernetes.
3. **Strict Gate Criteria:** Mỗi bài lab kết thúc bằng một bảng **SRE Gate Check**. Tuyệt đối không chuyển sang bài lab kế tiếp nếu chưa đạt 100% điều kiện của Gate.
4. **Data Redaction Invariant:** Mọi file log, bằng chứng kết quả (evidence) cam kết lên Git phải được che giấu toàn bộ:
   - AWS Account ID (thay bằng `***` hoặc `123456789012`).
   - Private IPs, Tokens, Passwords, API Keys, Private ARNs.
5. **Reverse Cleanup Order:** Khi dọn dẹp môi trường, luôn xóa theo thứ tự ngược lại (Workload/Ingress -> Cluster/Nodes -> Datastores -> VPC Network -> KMS/Security) để tránh tài nguyên mồ côi (Orphan Leak) gây rò rỉ chi phí và đạt chuẩn FinOps **$0.00**.
