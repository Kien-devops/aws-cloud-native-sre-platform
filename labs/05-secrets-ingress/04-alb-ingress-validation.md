# 05.04 — Shared ALB Ingress Group & Target Validation

> **Phạm vi:** Multi-Service Routing & FinOps Shared ALB | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Single Shared ALB (FinOps):** Toàn bộ 5 Ingress (`dev`, `staging`, `prod`, `argocd`, `grafana`) dùng chung annotation `alb.ingress.kubernetes.io/group.name: sre-platform` -> gộp thành **1 AWS ALB duy nhất** (~$18/tháng thay vì ~$90/tháng cho 5 ALB).
- **Host-Based Routing & Order:** Phân tách route theo Hostname và `group.order` rõ ràng.

---

## 2. Đặc tả Routing & Target Groups trên Shared ALB

| `group.order` | Ingress Name | Hostname | Target Service & Port |
| :--- | :--- | :--- | :--- |
| `10` | `reliability-shop-ingress` (`dev`) | `shop.dev.devopsss.site` | `frontend:80` (IP targets) |
| `20` | `reliability-shop-ingress` (`staging`) | `shop.staging.devopsss.site` | `frontend:80` (IP targets) |
| `30` | `reliability-shop-ingress` (`prod`) | `shop.devopsss.site` | `frontend:80` (IP targets) |
| `50` | `argocd-ingress` (`argocd`) | `argocd.devopsss.site` | `argocd-server:80/443` |
| `60` | `grafana-ingress` (`monitoring`) | `grafana.devopsss.site` | `grafana:3000` |

**Health Check chuẩn:** `path: /health`, `interval: 15s`, `timeout: 5s`, `healthy-threshold: 2`, `unhealthy-threshold: 2`.

---

## 3. Chiến lược Tagging & Labels (ALB Auto-Tagging)

| Tag Key | Tag Value | Mục đích |
| :--- | :--- | :--- |
| `ingress.k8s.aws/stack` | `sre-platform` | AWS LBC tự gắn để quản lý Shared ALB Group |
| `elbv2.k8s.aws/cluster` | `sre-platform-dev` | Định danh cluster sở hữu ALB & Target Groups |

---

## 4. Tham chiếu IaC / GitOps
- [ingress.yaml](../../gitops/applications/reliability-shop/base/ingress.yaml)
- [argocd-ingress.yaml](../../gitops/platform/ingress/argocd-ingress.yaml)
- [06-grafana-ingress.yaml](../../gitops/platform/monitoring/06-grafana-ingress.yaml)

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
```bash
kubectl get ingress -A
aws elbv2 describe-target-groups --region ap-southeast-1 --query "TargetGroups[].{Name:TargetGroupName,Type:TargetType,HealthPath:HealthCheckPath}"
```
- **PASS:** Cả 5 Ingress đều trả về cùng 1 `ADDRESS` (`k8s-sreplatform-*`), 100% Target Groups `TargetType = ip` và targets trạng thái `healthy`.
