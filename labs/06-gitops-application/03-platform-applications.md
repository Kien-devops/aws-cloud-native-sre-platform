# 06.03 — Platform Infrastructure Applications

> **Phạm vi:** Platform Add-ons & Controllers | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Declarative Platform Stack:** Toàn bộ controller vận hành cụm (ESO, KEDA, Karpenter, Argo Rollouts, Monitoring, Ingress) quản lý chung dưới `platform-infrastructure` Application.
- **CRD Sync Optimization:** Bật `ServerSideApply=true` riêng cho các CRD kích thước lớn (KEDA, Karpenter, Rollouts) và `ignoreDifferences` cho webhook `caBundle` để tránh flapping `OutOfSync`.

---

## 2. Đặc tả Thành phần trong `platform-infrastructure`

| Module Path (`gitops/platform/`) | Namespace Đích | Chức năng Cốt lõi |
| :--- | :--- | :--- |
| `external-secrets/` | `external-secrets` | `ClusterSecretStore` (`aws-secretsmanager-dev`) |
| `keda/` | `keda` | KEDA Operator & Metrics API Server (`ServerSideApply=true`) |
| `karpenter/` | `karpenter` | `EC2NodeClass` (`default`) & `NodePool` (`workload-spot`) |
| `argo-rollouts/` | `argo-rollouts` | Argo Rollouts Controller & CRDs |
| `monitoring/` | `monitoring` | OTel Collector, Loki, Tempo, Grafana, Prometheus Alert Rules |
| `ingress/` | `argocd` | Shared ALB Ingress cho Argo CD (`argocd.devopsss.site`) |

---

## 3. Chiến lược Tagging & Labels

| Label / Annotation | Giá trị | Mục đích |
| :--- | :--- | :--- |
| `argocd.argoproj.io/sync-options` | `ServerSideApply=true` | Tránh lỗi annotation size > 262KB trên CRDs |

---

## 4. Tham chiếu IaC / GitOps
- [gitops/platform/kustomization.yaml](../../gitops/platform/kustomization.yaml)
- [gitops/platform/README.md](../../gitops/platform/README.md)

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
```bash
kubectl get application platform-infrastructure -n argocd
```
- **PASS:** Trạng thái `Synced` & `Healthy`, không còn hiện tượng tự chuyển `OutOfSync`.
