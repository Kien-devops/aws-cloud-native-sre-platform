# GitOps Bootstrap

## Phạm vi

`root-application.yaml` chứa hai Argo CD `Application` độc lập:

| Application | AppProject | Source path | Trách nhiệm |
| --- | --- | --- | --- |
| `platform-infrastructure` | `platform` | `gitops/platform` | Ingress Argo CD và cấu hình `ClusterSecretStore` |
| `reliability-shop` | `reliability-shop` | `gitops/applications/reliability-shop/base` | Workload, application Ingress và `ExternalSecret` |

Đây là hai Application ngang hàng, không phải App-of-Apps. Tên file `root-application.yaml` được giữ để tương thích với tài liệu/lệnh hiện có.

```mermaid
flowchart TD
    Bootstrap["root-application.yaml"]
    PlatformApp["platform-infrastructure"]
    WorkloadApp["reliability-shop"]
    PlatformPath["gitops/platform"]
    WorkloadPath["gitops/applications/reliability-shop/base"]

    Bootstrap --> PlatformApp --> PlatformPath
    Bootstrap --> WorkloadApp --> WorkloadPath
```

## Prerequisites bên ngoài GitOps

Bootstrap này không cài Argo CD, AWS Load Balancer Controller, External Secrets Operator hoặc EKS Pod Identity. Trước khi sync cần có:

- EKS access, Argo CD và hai `AppProject` trong `gitops/projects/`.
- AWS Load Balancer Controller, External Secrets Operator và CRD tương ứng.
- IAM/Pod Identity cho controller; quyền ECR pull và quyền AWS của workload theo least privilege.
- ACM certificate, DNS, security group, subnet tagging và network path phù hợp.
- Secret nguồn trong AWS Secrets Manager; kết nối tới RDS, ElastiCache và SQS nếu workload sử dụng.

## Cold bootstrap có thứ tự

Không apply đồng thời hai Application trên cluster mới. `ExternalSecret` của workload phụ thuộc `ClusterSecretStore` do platform quản lý.

```powershell
# 1. Tạo security boundary trước Application.
kubectl apply -f gitops/projects/

# 2. Chỉ tạo Application platform từ file multi-document.
kubectl apply -f gitops/bootstrap/root-application.yaml `
  --selector "app.kubernetes.io/name=platform-infrastructure"

# 3. Gate: platform phải sẵn sàng trước workload.
kubectl -n argocd wait application/platform-infrastructure `
  --for=jsonpath='{.status.sync.status}'=Synced --timeout=10m
kubectl -n argocd wait application/platform-infrastructure `
  --for=jsonpath='{.status.health.status}'=Healthy --timeout=10m
kubectl wait clustersecretstore/aws-secretsmanager-dev `
  --for=condition=Ready --timeout=5m
kubectl -n argocd wait ingress/argocd-server-ingress `
  --for=jsonpath='{.status.loadBalancer.ingress}' --timeout=10m

# 4. Chỉ tạo Application workload sau khi gate đạt.
kubectl apply -f gitops/bootstrap/root-application.yaml `
  --selector "app.kubernetes.io/name=reliability-shop"
```

Gate tối thiểu:

- `platform-infrastructure`: `Synced` và `Healthy`.
- `ClusterSecretStore/aws-secretsmanager-dev`: `Ready=True`.
- Argo CD Ingress có ALB address; DNS/TLS và target health hợp lệ.

Nếu cluster đã ổn định và toàn bộ prerequisites đã được xác nhận, có thể apply cả file. Hai Application khi đó vẫn reconcile độc lập:

```powershell
kubectl apply -f gitops/bootstrap/root-application.yaml
```

## Xác nhận workload

```powershell
kubectl -n argocd get application reliability-shop
kubectl -n reliability-shop get externalsecret reliability-shop-credentials
kubectl -n reliability-shop get deployment,service,ingress
```

Kết quả cần xác nhận trên cluster thật:

- `reliability-shop`: `Synced` và `Healthy`.
- `ExternalSecret/reliability-shop-credentials`: `Ready=True`.
- Deployment đủ replica Ready; ALB target health và application smoke test đạt.

Local render không chứng minh IAM, network, DNS, TLS, AWS endpoint hoặc runtime health.

## Drift và rollback

Cả hai Application bật `prune` và `selfHeal`; sửa trực tiếp resource trên cluster sẽ bị Argo CD reconcile về Git. Rollback bằng Git revert tới commit đã biết tốt rồi sync/quan sát health.

Không xóa Application tùy tiện: finalizer có thể xóa toàn bộ resource do Application quản lý. Không xóa ALB, certificate, AWS secret, RDS, ElastiCache hoặc SQS trong rollback GitOps thông thường.

## Module giữ chỗ

`monitoring`, `keda`, `karpenter`, `argo-rollouts`, `chaos-mesh` và `cert-manager` được giữ để phát triển sau. Trạng thái hiện tại: `PLANNED - NOT DEPLOYED`; bootstrap chưa sync manifest từ các thư mục này.
