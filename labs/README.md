# Platform Provisioning & SRE Specifications (`labs/`)

**Đặc tả tài nguyên AWS, Tagging, cấu hình GitOps và tiêu chí kiểm chứng SRE cho nền tảng AWS Cloud-Native SRE Platform.**

[Trang chủ](../README.md) / Labs · [Tài liệu Kiến trúc](../docs/README.md) · [Bắt đầu tại Module 00](00-chuan-bi/README.md)

> [!NOTE]
> Thư mục `labs/` đóng vai trò **Resource Blueprint & Verification Specs** — tổng hợp tên tài nguyên chuẩn, chiến lược Tagging, tham số cấu hình cốt lõi, tham chiếu IaC (`iac/terraform/`) / GitOps (`gitops/`) và điều kiện nghiệm thu SRE Gate.

---

## 1. Bản đồ Tổng thể 11 Modules

```text
[00 Chuẩn bị]           --> Account, Region ap-southeast-1, Naming (sre-platform-dev-*), Tags & Budget $50
      |
      v
[01 IAM & Security]     --> GitHub OIDC Role, KMS CMK (alias/sre-platform-dev-main), CloudTrail, GuardDuty
      |
      v
[02 Network]            --> 3-Tier VPC Multi-AZ (10.0.0.0/16), Subnet Tags (ALB/Karpenter), S3 Gateway, SG Matrix
      |
      v
[03 Foundation]         --> ECR Repos (5 services), SQS + DLQ, RDS PostgreSQL 16.9, ElastiCache Redis 7.1
      |
      v
[04 EKS Platform]       --> EKS Cluster (sre-platform-dev), Managed Node Group, 7 Add-ons, 7 Pod Identities
      |
      v
[05 Secrets & Ingress]  --> Secrets Manager, External Secrets Operator, ACM SSL, Shared ALB (sre-platform)
      |
      v
[06 GitOps Application] --> Argo CD Root App (App-of-Apps), Projects, Base & Env Overlays (dev/staging/prod)
      |
      v
[07 Observability]      --> OTel Collector, Prometheus Alerting, Loki, Tempo, Grafana & CloudWatch DLQ Alarms
      |
      v
[08 Delivery & Scaling] --> GitHub Actions OIDC CI/CD, KEDA ScaledObject, HPA, Karpenter Spot, Argo Rollouts
      |
      v
[09 SRE Validation]     --> SLI/SLO & Error Budget, k6 Load Test, Resilience & Chaos GameDay, Go-Live Gate
      |
      v
[10 Handoff & Cleanup]  --> Resource Inventory, GitOps Drift Reconciliation, Rebuild/DR & Reverse Cleanup ($0.00)
```

---

## 2. Quy chuẩn Tài liệu trong `labs/`

Mỗi file đặc tả tuân thủ cấu trúc chuẩn 5 phần:
1. **Mục tiêu & Nguyên tắc Thiết kế** — Lý do kiến trúc và ranh giới bảo mật/độ tin cậy.
2. **Đặc tả Tài nguyên (Resource Inventory & Config)** — Tên resource chính xác, CIDR/Port, Encryption, Sizing, Retention.
3. **Chiến lược Tagging & Labels** — Tags bắt buộc cho FinOps, Security và Auto-discovery (ALB, Karpenter).
4. **Tham chiếu IaC / GitOps** — Đường dẫn trực tiếp tới Terraform (`iac/`) hoặc Kubernetes manifests (`gitops/`).
5. **Tiêu chí Nghiệm thu (Verification & SRE Gate)** — Lệnh kiểm tra nhanh và điều kiện PASS.

---

## 3. Danh mục 11 Modules

| Module | Tên Module | Trọng tâm Đặc tả |
| :--- | :--- | :--- |
| `00` | [Chuẩn bị](00-chuan-bi/README.md) | Region, Naming `sre-platform-dev-*`, Tagging Matrix, Budget `$50` |
| `01` | [IAM & Security](01-iam-security/README.md) | OIDC Role, KMS CMK, CloudTrail, GuardDuty, Secret Redaction |
| `02` | [Network](02-network/README.md) | VPC `10.0.0.0/16`, 6 Subnets Multi-AZ, NAT, S3 Gateway, SG Matrix |
| `03` | [Foundation Services](03-foundation-services/README.md) | 5 ECR Repos, SQS + DLQ, RDS PostgreSQL 16.9, Redis 7.1 |
| `04` | [EKS Platform](04-eks-platform/README.md) | EKS Cluster `sre-platform-dev`, Node Group, Add-ons, Pod Identity |
| `05` | [Secrets & Ingress](05-secrets-ingress/README.md) | Secrets Manager, ESO `ClusterSecretStore`, ACM, Shared ALB |
| `06` | [GitOps Application](06-gitops-application/README.md) | Argo CD Bootstrap, AppProjects, Overlays (`dev`/`staging`/`prod`) |
| `07` | [Observability](07-observability/README.md) | OTel, Prometheus, Loki, Tempo, Grafana, CloudWatch DLQ Alarms |
| `08` | [Delivery & Scaling](08-delivery-scaling/README.md) | `app3` CI/CD OIDC, KEDA, HPA, Karpenter Spot, Argo Rollouts |
| `09` | [SRE Validation](09-sre-validation/README.md) | SLI/SLO, Error Budget, k6 Load Test, Chaos GameDay, Go-Live Gate |
| `10` | [Handoff & Cleanup](10-handoff-cleanup/README.md) | Inventory, Drift Check, DR Restore, Reverse Teardown (`$0.00`) |
