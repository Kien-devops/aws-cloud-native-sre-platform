# Platform GitOps

## Status

`ACTIVE` cho ba nhóm cấu hình: `ingress/`, `external-secrets/` và `monitoring/`. Các thư mục `keda/`, `karpenter/`, `argo-rollouts/`, `chaos-mesh/` và `cert-manager/` là kế hoạch; hiện chưa có manifest triển khai.

`platform-infrastructure` trong `gitops/bootstrap/root-application.yaml` sync trực tiếp thư mục này. Đây không phải App-of-Apps và không tự cài controller Helm.

## Purpose

Thư mục này giữ cấu hình platform dùng chung cho EKS, tách khỏi workload `ReliabilityShop`:

```text
gitops/platform/
├── ingress/              # Active: Ingress rule cho Argo CD
├── external-secrets/     # Active: ClusterSecretStore cho AWS Secrets Manager
├── monitoring/           # Active: metrics, logs, traces, dashboards, alerting
├── keda/                 # Planned: event-driven pod autoscaling
├── karpenter/            # Planned: node provisioning
├── argo-rollouts/        # Planned: progressive delivery
├── chaos-mesh/           # Planned: controlled failure experiments
└── cert-manager/         # Planned: certificate lifecycle
```

Chi tiết: [Ingress](ingress/README.md), [External Secrets](external-secrets/README.md), [Monitoring](monitoring/README.md), [KEDA](keda/README.md), [Karpenter](karpenter/README.md), [Argo Rollouts](argo-rollouts/README.md), [Chaos Mesh](chaos-mesh/README.md), [cert-manager](cert-manager/README.md).

## Repository ownership

Platform SRE review và thay đổi file. Argo CD là reconciler runtime. Application team sở hữu workload, `ExternalSecret` consumer và application Ingress; không sửa trực tiếp cấu hình platform trên cluster.

## Prerequisites

- EKS, Argo CD, AppProject `platform` và Application `platform-infrastructure` đã sẵn sàng.
- AWS Load Balancer Controller, `IngressClass` `alb` và Pod Identity/IRSA đã được cài ngoài thư mục này.
- External Secrets Operator, CRD `ClusterSecretStore`/`ExternalSecret` và identity đọc Secrets Manager đã sẵn sàng.
- ACM certificate, DNS, security group và subnet tagging phải tồn tại trước khi sync Ingress.
- AWS region, secret path, IAM policy và network path phải khớp môi trường; secret value không đặt trong Git.

## AWS/EKS integration

`ingress/` cung cấp rule để AWS Load Balancer Controller reconcile ALB. `external-secrets/` chỉ khai báo provider AWS Secrets Manager; ESO mới thực hiện đồng bộ. Route 53, ACM, security group, controller, Pod Identity và VPC endpoint/routing là dependency bên ngoài.

## Security/IAM

- Dùng HTTPS/ACM và security group đã review; kiểm tra shared IngressGroup trước khi thêm route.
- IAM controller chỉ có quyền cần cho ALB hoặc Secrets Manager; không commit secret, token, credential hay kubeconfig.
- `ClusterSecretStore` là cluster-scoped; chỉ mở rộng khi RBAC/ESO policy giới hạn namespace và secret path phù hợp.
- AppProject và resource whitelist là guardrail; mọi mở rộng quyền cần review riêng.

## Cost/operations

Shared ALB giảm số load balancer nhưng tăng blast radius giữa các route. Secrets Manager tính phí secret và API calls. Theo dõi controller health, ALB target health, ExternalSecret status và CloudTrail. Repo chưa có chi phí hoặc SLO đo thực tế.

## Enablement

1. Xác nhận prerequisites và `kubectl kustomize gitops/platform`.
2. Sync `platform-infrastructure` bằng Argo CD.
3. Chờ Ingress/ClusterSecretStore `Healthy`/`Ready`.
4. Sau đó mới sync workload sử dụng ALB hoặc `ExternalSecret`.
5. Module planned chỉ bật sau khi có manifest, owner, IAM policy, rollback và evidence riêng.

## Validation

```powershell
kubectl kustomize gitops/platform
kubectl -n argocd get application platform-infrastructure
kubectl -n argocd get ingress argocd-server-ingress
kubectl get clustersecretstore aws-secretsmanager-dev
```

Runtime health, DNS/TLS, ALB target health và secret sync phải kiểm tra trên cluster thật; render local chỉ chứng minh YAML có thể dựng.

## Rollback

Revert Git rồi để Argo CD sync lại. Không xóa thủ công ALB, certificate, AWS secret hoặc generated Kubernetes Secret trong cùng bước rollback. Nếu mất route, restore commit cuối đã biết tốt rồi kiểm tra target health.

## Measurement boundary

Manifest/render checks có thể chạy local. Runtime deployment, AWS resource state, latency, cost và SLO: `NOT_MEASURED`.
