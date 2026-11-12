# 06.02 — Argo CD AppProjects & Multi-Environment Isolation

> **Phạm vi:** GitOps RBAC & Blast-Radius Containment | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Blast-Radius Isolation:** Tách biệt quyền triển khai của tầng hạ tầng (`platform-project`) và tầng ứng dụng (`reliability-shop-project`).
- **Strict Destination Whitelist:** Ứng dụng nghiệp vụ không được phép tạo ClusterRole hoặc deploy vào `kube-system`, `argocd`, `karpenter`.

---

## 2. Đặc tả AppProjects

| AppProject Name | Source Repos Allowed | Destinations Allowed (Namespaces) | Resource Whitelist |
| :--- | :--- | :--- | :--- |
| `platform-project` | `https://github.com/Kien-devops/aws-cloud-native-sre-platform.git` | `external-secrets`, `keda`, `karpenter`, `argo-rollouts`, `monitoring`, `argocd`, `kube-system` | Cluster-scoped & Namespaced CRDs |
| `reliability-shop-project` | `https://github.com/Kien-devops/aws-cloud-native-sre-platform.git` | `reliability-shop`, `reliability-shop-staging`, `reliability-shop-prod` | Namespaced workload resources (`Deployment`, `Rollout`, `Service`, `Ingress`, `ScaledObject`, `ExternalSecret`) |

---

## 3. Chiến lược Tagging & Labels

| Label Key | Label Value | Mục đích |
| :--- | :--- | :--- |
| `app.kubernetes.io/part-of` | `sre-platform` | Định danh governance GitOps |

---

## 4. Tham chiếu IaC / GitOps
- [platform-project.yaml](../../gitops/projects/platform-project.yaml)
- [reliability-shop-project.yaml](../../gitops/projects/reliability-shop-project.yaml)

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
```bash
kubectl get appprojects -n argocd
```
- **PASS:** Tồn tại đủ `platform-project` và `reliability-shop-project` với đúng danh sách namespace whitelist.
