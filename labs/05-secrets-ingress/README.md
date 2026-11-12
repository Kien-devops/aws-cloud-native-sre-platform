# Module 05 — Secrets Management, TLS & Shared ALB Ingress

> **Phạm vi:** AWS Secrets Manager, ESO, ACM TLS & AWS Load Balancer Controller | **Region:** `ap-southeast-1`

Module 05 đặc tả cơ chế đồng bộ bí mật không cần lưu plaintext trong Git (External Secrets Operator) và kiến trúc **Single Shared ALB** (`group.name: sre-platform`) phục vụ đồng thời nhiều môi trường và công cụ quản trị (Argo CD, Grafana) nhằm tối ưu chi phí.

---

## Danh sách Đặc tả

| Mã | Tài liệu | Nội dung Chính |
| :--- | :--- | :--- |
| `05.01` | [AWS Secrets Manager](01-secrets-manager.md) | 4 Secret paths KMS-encrypted (`/sre-platform/dev/*`), Rotation readiness |
| `05.02` | [ACM & Route 53](02-acm-route53.md) | Wildcard TLS Certificate `*.devopsss.site`, DNS Alias Records |
| `05.02b` | [External Secrets Operator](02-external-secrets-handoff.md) | `ClusterSecretStore` (`aws-secretsmanager-dev`) & `ExternalSecret` sync |
| `05.03` | [AWS LBC Prerequisites](03-load-balancer-controller-prereqs.md) | IAM Role, Pod Identity, Subnet Discovery Tags (`elb=1`) |
| `05.04` | [Shared ALB Validation](04-alb-ingress-validation.md) | Ingress Group `sre-platform`, Host-based Routing (5 Target Groups) |
