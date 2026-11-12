# 06.05 — Environment Overlays (`dev`, `staging`, `prod`)

> **Phạm vi:** Multi-Environment Promotion Strategy | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Kustomize Base + Overlays:** Giữ 1 bộ `base/` duy nhất, dùng `envs/{dev,staging,prod}/kustomization.yaml` để override namespace, domain host, SQS queue name và image digest riêng biệt.
- **Manual Sync Gate on Prod:** `dev` bật auto-sync theo nhánh `dev`; `staging` và `prod` yêu cầu review Pull Request và xác nhận sync an toàn.

---

## 2. Đặc tả Overlays theo Môi trường

| Môi trường | Namespace | Git Branch (`targetRevision`) | SQS Queue & Hostname | Sync Policy |
| :--- | :--- | :--- | :--- | :--- |
| **Dev** | `reliability-shop` | `dev` | `reliability-shop-dev-order-queue`<br>`shop.dev.devopsss.site` | Automated (`prune + selfHeal`) |
| **Staging** | `reliability-shop-staging` | `staging` | `reliability-shop-staging-order-queue`<br>`shop.staging.devopsss.site` | Manual / Controlled Promotion |
| **Prod** | `reliability-shop-prod` | `main` | `reliability-shop-prod-order-queue`<br>`shop.devopsss.site` | Manual Sync Gate + Canary Analysis |

---

## 3. Chiến lược Tagging & Labels

| Label / Patch | Giá trị | Mục đích |
| :--- | :--- | :--- |
| `environment` | `dev` \| `staging` \| `prod` | Cô lập metrics/logs trên Prometheus & Grafana theo `namespace` |

---

## 4. Tham chiếu IaC / GitOps
- [envs/dev/kustomization.yaml](../../gitops/applications/reliability-shop/envs/dev/kustomization.yaml)
- [envs/staging/kustomization.yaml](../../gitops/applications/reliability-shop/envs/staging/kustomization.yaml)
- [envs/prod/kustomization.yaml](../../gitops/applications/reliability-shop/envs/prod/kustomization.yaml)

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
```bash
kubectl get applications -n argocd -o wide
```
- **PASS:** 3 Applications (`dev`, `staging`, `prod`) trỏ đúng `targetRevision` và namespace cô lập, không ghi đè SQS queue của nhau.
