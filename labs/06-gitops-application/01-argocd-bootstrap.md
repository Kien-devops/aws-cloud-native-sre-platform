# 06.01 — Argo CD Bootstrap & Root App-of-Apps

> **Phạm vi:** GitOps Control Plane | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Single Source of Truth:** Toàn bộ tài nguyên Kubernetes triển khai qua Git; Argo CD tự động phát hiện và hoàn nguyên drift (`selfHeal: true`, chu kỳ `10s`).
- **App-of-Apps Pattern:** Chỉ cần áp dụng duy nhất `root-application.yaml`, Argo CD tự đồng bộ toàn bộ platform add-ons và các môi trường ứng dụng.

---

## 2. Đặc tả Tài nguyên Kubernetes

| Kind | Tên Resource | Namespace | Tham số Cấu hình Cốt lõi |
| :--- | :--- | :--- | :--- |
| **Namespace** | `argocd` | Cluster-scoped | Pinned Argo CD `v2.11.3` |
| **Application (Root)** | `root-application` | `argocd` | Path: `gitops/bootstrap`, `automated: { prune: true, selfHeal: true }` |
| **Secret** | `argocd-secret` | `argocd` | Password admin xoay vòng và lưu trên AWS Secrets Manager |

---

## 3. Chiến lược Tagging & Labels

| Label Key | Label Value | Mục đích |
| :--- | :--- | :--- |
| `environment` | `dev` | Phân loại namespace điều phối |
| `project` | `sre-platform` | Định danh nền tảng |
| `app.kubernetes.io/part-of` | `argocd` | Nhóm thành phần GitOps |

---

## 4. Tham chiếu IaC / GitOps
- [root-application.yaml](../../gitops/bootstrap/root-application.yaml)
- [gitops/bootstrap/README.md](../../gitops/bootstrap/README.md)

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
```bash
kubectl get applications -n argocd
```
- **PASS:** `root-application` và các child apps hiển thị `Synced` / `Healthy`.
