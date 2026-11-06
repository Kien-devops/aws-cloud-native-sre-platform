# Ingress

**HTTPS entrypoint cho Argo CD trên shared Application Load Balancer.**

[GitOps](../../README.md) / [Platform](../README.md) / Ingress

| Nguồn | Trách nhiệm |
| --- | --- |
| [argocd-ingress.yaml](argocd-ingress.yaml) | Host, listener, certificate và target routing |
| [kustomization.yaml](kustomization.yaml) | Nạp cấu hình vào platform |
| AWS Load Balancer Controller | Reconcile ALB, listener và target group |

## Status

`ACTIVE` — cấu hình Ingress cho Argo CD. Controller và AWS resources không được cài trong thư mục này.

## Purpose

`argocd-ingress.yaml` khai báo host HTTPS của Argo CD trên shared ALB group `sre-platform`, target type IP và health check `/healthz`.

## Repository ownership

Platform SRE sở hữu rule và annotation. AWS Load Balancer Controller sở hữu ALB/listener/target group runtime. Workload teams sở hữu application Ingress khác trong cùng group.

## Prerequisites

EKS, AWS Load Balancer Controller, `IngressClass` `alb`, subnet tags, security group, ACM certificate, DNS record và controller identity phải sẵn sàng. ARN/host hiện là cấu hình môi trường cụ thể; review trước khi promote.

## AWS/EKS integration

Controller dùng AWS APIs để reconcile ALB, listener, target group và health check. ACM termination xảy ra tại ALB; backend hiện dùng HTTP tới service Argo CD.

## Security/IAM

Chỉ mở listener/security group cần thiết, ưu tiên HTTPS redirect. Không đặt credential trong annotation. Review shared group/order vì một route sai có thể ảnh hưởng nhiều ứng dụng.

## Cost/operations

Shared ALB tiết kiệm chi phí nhưng tạo shared failure domain. Theo dõi target health, 4xx/5xx, TLS expiry và controller events.

## Enablement

Argo CD sync `platform-infrastructure` sau khi prerequisites đạt. Không `kubectl apply` trực tiếp trong vận hành bình thường.

## Validation

```powershell
kubectl kustomize gitops/platform/ingress
kubectl -n argocd get ingress argocd-server-ingress -o wide
kubectl -n argocd describe ingress argocd-server-ingress
```

Xác nhận ALB address, DNS, certificate chain và target health trên AWS. Runtime evidence: `NOT_MEASURED`.

## Rollback

Revert annotation/rule trong Git và sync Argo CD. Giữ ALB/certificate; chỉ xóa Ingress sau khi xác nhận không còn route phụ thuộc.
