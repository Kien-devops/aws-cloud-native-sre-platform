# Labs Triển khai AWS Cloud-Native SRE Platform

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
| [**Module 00**](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/00-chuan-bi/README.md) | **Chuẩn bị môi trường & Nguyên tắc SRE** | • [00.01: Tài khoản, Region & Identity](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/00-chuan-bi/01-account-region-identity.md)<br>• [00.02: Naming, Tagging & AWS Budget $50](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/00-chuan-bi/02-naming-tagging-budget.md)<br>• [00.03: Quản lý Evidence & Redaction](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/00-chuan-bi/03-evidence-approval.md) |
| [**Module 01**](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/01-iam-security/README.md) | **IAM, Bảo mật & Audit Guardrails** | • [01.01: GitHub Actions OIDC Roles](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/01-iam-security/01-github-oidc-roles.md)<br>• [01.02: KMS Customer Managed Key](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/01-iam-security/02-kms-key.md)<br>• [01.03: CloudTrail & Amazon GuardDuty](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/01-iam-security/03-cloudtrail-guardduty.md)<br>• [01.04: Bí mật & Ngăn ngừa rò rỉ (Gitleaks)](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/01-iam-security/04-secrets-redaction.md) |
| [**Module 02**](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/02-network/README.md) | **Mạng VPC, Định tuyến & Phân đoạn bảo mật** | • [02.01: 3-Tier VPC & Subnets](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/02-network/01-vpc-subnets.md)<br>• [02.02: Route Tables, IGW & NAT Gateway](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/02-network/02-route-table-igw-nat.md)<br>• [02.03: S3 Gateway VPC Endpoint](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/02-network/03-vpc-endpoints.md)<br>• [02.04: Ma trận Security Groups](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/02-network/04-security-groups.md)<br>• [02.05: VPC Flow Logs & CloudWatch Insights](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/02-network/05-vpc-flow-logs.md) |
| [**Module 03**](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/03-foundation-services/README.md) | **Foundation Services (Data, Storage & Messaging)** | • [03.01: Amazon ECR Repositories](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/03-foundation-services/01-ecr.md)<br>• [03.02: Amazon SQS Queue & Dead-Letter Queue](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/03-foundation-services/02-sqs-dlq.md)<br>• [03.03: RDS PostgreSQL (Outbox & Idempotency)](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/03-foundation-services/03-rds-postgresql.md)<br>• [03.04: ElastiCache Redis Cluster](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/03-foundation-services/04-elasticache-redis.md)<br>• [03.05: RDS Snapshot & PITR Restore Drill](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/03-foundation-services/06-backup-restore.md) |
| [**Module 04**](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/04-eks-platform/README.md) | **EKS Platform & Compute Engine** | • [04.01: EKS Cluster v1.30 Control Plane](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/04-eks-platform/01-eks-cluster.md)<br>• [04.02: Managed Node Groups (AL2023)](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/04-eks-platform/02-node-groups.md)<br>• [04.03: EKS Managed Add-ons (CoreDNS, CNI)](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/04-eks-platform/03-managed-addons.md)<br>• [04.04: EKS Pod Identity Associations](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/04-eks-platform/04-pod-identity.md)<br>• [04.05: Cụm kiểm tra sức khỏe nền tảng EKS](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/04-eks-platform/05-platform-health.md) |
| [**Module 05**](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/05-secrets-ingress/README.md) | **Secrets Governance & Ingress Traffic** | • [05.01: AWS Secrets Manager](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/05-secrets-ingress/01-secrets-manager.md)<br>• [05.02: ACM Certificate & Route 53 DNS](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/05-secrets-ingress/02-acm-route53.md)<br>• [05.03: External Secrets Operator (ESO)](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/05-secrets-ingress/02-external-secrets-handoff.md)<br>• [05.04: AWS Load Balancer Controller (LBC)](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/05-secrets-ingress/03-load-balancer-controller-prereqs.md)<br>• [05.05: ALB Ingress Validation (Shared Ingress)](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/05-secrets-ingress/04-alb-ingress-validation.md) |
| [**Module 06**](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/06-gitops-application/README.md) | **GitOps & Ứng dụng mẫu ReliabilityShop** | • [06.01: Argo CD Bootstrap & Secret Rotation](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/06-gitops-application/01-argocd-bootstrap.md)<br>• [06.02: Argo CD AppProjects & RBAC](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/06-gitops-application/02-projects-environments.md)<br>• [06.03: Platform Applications (App-of-Apps)](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/06-gitops-application/03-platform-applications.md)<br>• [06.04: GitOps Base (ServiceAccount, ConfigMap, KEDA)](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/06-gitops-application/04-reliabilityshop-base.md)<br>• [06.05: Environment Overlays (Dev)](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/06-gitops-application/05-environment-overlays.md)<br>• [06.06: First Sync & End-to-End Smoke Test](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/06-gitops-application/06-first-sync-smoke.md) |
| [**Module 07**](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/07-observability/README.md) | **Observability & SRE Tri-Signal Telemetry** | • [07.01: OpenTelemetry (OTel) Collectors](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/07-observability/01-otel-collectors.md)<br>• [07.02: Prometheus & Multi-Burn-Rate Alerts](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/07-observability/02-prometheus-alertmanager.md)<br>• [07.03: Grafana Loki (Logs) & Tempo (Traces)](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/07-observability/03-loki-tempo.md)<br>• [07.04: Dashboards as Code (Golden Signals/SLO)](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/07-observability/04-grafana-dashboards.md)<br>• [07.05: Tri-Signal Correlation Drill](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/07-observability/05-observability-checkpoint.md)<br>• [07.06: Console Observability (DLQ Alarms & Runbook)](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/07-observability/06-console-observability.md) |
| [**Module 08**](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/08-delivery-scaling/README.md) | **Delivery, Autoscaling & Safe Deployment** | • [08.01: CI Build, Trivy Scan & ECR SHA Digest](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/08-delivery-scaling/01-ci-build-scan-ecr.md)<br>• [08.02: GitOps Promotion & Quy trình Deploy 4 bước](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/08-delivery-scaling/02-gitops-promotion.md)<br>• [08.03: HPA & KEDA Queue-based Autoscaling](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/08-delivery-scaling/03-hpa-keda.md)<br>• [08.04: Karpenter v1.0 Node Autoscaling](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/08-delivery-scaling/04-karpenter.md)<br>• [08.05: Argo Rollouts Canary & AnalysisTemplate](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/08-delivery-scaling/05-argo-rollouts-canary.md)<br>• [08.06: Automated Rollback & Git Revert Strategy](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/08-delivery-scaling/06-rollback.md) |
| [**Module 09**](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/09-sre-validation/README.md) | **SRE Validation, Resilience & Go-Live Gate** | • [09.01: Phase 1 & 2: Baseline & Controlled Live Test](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/09-sre-validation/01-platform-smoke.md)<br>• [09.02: SLI/SLO Math & Error Budget Policy](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/09-sre-validation/02-sli-slo-error-budget.md)<br>• [09.03: k6 Load Test Baseline Scorecard](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/09-sre-validation/03-k6-baseline.md)<br>• [09.04: Resilience & Idempotency Correctness Test](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/09-sre-validation/04-resilience-test.md)<br>• [09.05: Chaos GameDay: Worker Node Outage](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/09-sre-validation/05-chaos-gameday.md)<br>• [09.06: Incident Triage Runbook & Postmortem](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/09-sre-validation/06-incident-runbook.md)<br>• [09.07: Go-Live Gate Sign-Off (Acceptance Gate)](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/09-sre-validation/07-go-live-gate.md) |
| [**Module 10**](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/10-handoff-cleanup/README.md) | **Handoff, State Reconcile & Reverse Cleanup** | • [10.01: Resource Inventory & Ownership](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/10-handoff-cleanup/01-resource-inventory.md)<br>• [10.02: GitOps Drift Reconciliation](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/10-handoff-cleanup/02-gitops-drift-reconciliation.md)<br>• [10.03: GitOps Ownership & Boundaries](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/10-handoff-cleanup/03-gitops-ownership.md)<br>• [10.04: Rebuild & DR Restore Verification](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/10-handoff-cleanup/04-rebuild-restore.md)<br>• [10.05: Reverse Dependency Cleanup Order](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/10-handoff-cleanup/05-cleanup-order.md)<br>• [10.06: Cost Audit, True Zero & Handoff](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/10-handoff-cleanup/06-cost-audit.md) |

---

## 4. Quy ước Chung Bắt buộc

1. **Console Path:** Luôn cung cấp đường dẫn điều hướng chính xác trên AWS Management Console (Ví dụ: `Amazon EKS > Clusters > [Cluster Name] > Compute`).
2. **Handoff Principle (Console + GitOps):** Tách bạch tuyệt đối vai trò: AWS Management Console quản lý các tài nguyên hạ tầng đám mây (VPC, Subnet, RDS, SQS, KMS, EKS Cluster, NodeGroups); Argo CD quản lý toàn bộ tài nguyên triển khai trong Kubernetes.
3. **Strict Gate Criteria:** Mỗi bài lab kết thúc bằng một bảng **SRE Gate Check**. Tuyệt đối không chuyển sang bài lab kế tiếp nếu chưa đạt 100% điều kiện của Gate.
4. **Data Redaction Invariant:** Mọi file log, bằng chứng kết quả (evidence) cam kết lên Git phải được che giấu toàn bộ:
   - AWS Account ID (thay bằng `***` hoặc `123456789012`).
   - Private IPs, Tokens, Passwords, API Keys, Private ARNs.
5. **Reverse Cleanup Order:** Khi dọn dẹp môi trường, luôn xóa theo thứ tự ngược lại (Workload/Ingress -> Cluster/Nodes -> Datastores -> VPC Network -> KMS/Security) để tránh tài nguyên mồ côi (Orphan Leak) gây rò rỉ chi phí và đạt chuẩn FinOps **$0.00**.
