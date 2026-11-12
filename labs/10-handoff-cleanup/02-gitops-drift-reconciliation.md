# 10.02 — GitOps Drift Reconciliation

> **Phạm vi:** Anti-Drift & Self-Healing Control | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Zero Manual Mutation:** Mọi thay đổi thủ công trực tiếp bằng `kubectl edit` hoặc `kubectl scale` đều bị Argo CD tự động phát hiện và ghi đè lại đúng theo Git trong vòng `10 giây` (`selfHeal: true`).
- **Authorized Dynamic Fields:** Các trường thay đổi hợp lệ ở runtime (như `replicas` do HPA/KEDA điều khiển, `caBundle` do cert/webhook tiêm) được khai báo tường minh trong `ignoreDifferences`.

---

## 2. Đặc tả Cấu hình Anti-Drift

| Application | `selfHeal` | `prune` | `ignoreDifferences` |
| :--- | :--- | :--- | :--- |
| `root-application` | `true` | `true` | — |
| `platform-infrastructure` | `true` | `true` | `MutatingWebhookConfiguration` / `ValidatingWebhookConfiguration` `caBundle` (KEDA) |
| `reliability-shop` (`dev`) | `true` | `true` | `Deployment` & `Rollout` `spec.replicas` (HPA & KEDA) |

---

## 3. Chiến lược Tagging & Labels
- `argocd.argoproj.io/compare-options` / `sync-options` dùng để kiểm soát chính xác cách Argo CD so sánh diff.

---

## 4. Tham chiếu IaC / GitOps
- [reliability-shop-app.yaml](../../gitops/applications/reliability-shop/base/reliability-shop-app.yaml)
- [root-application.yaml](../../gitops/bootstrap/root-application.yaml)

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
- **PASS:** Thử xóa hoặc sửa ConfigMap/Ingress trực tiếp bằng `kubectl` -> Argo CD tự khôi phục về trạng thái Git trong `< 15 giây`.
