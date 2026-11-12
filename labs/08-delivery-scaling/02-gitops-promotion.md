# 08.02 — GitOps Automated Promotion (`update-gitops.yml`)

> **Phạm vi:** Cross-Repo GitOps Promotion | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Automated PR Promotion:** Sau khi `build-push.yml` hoàn tất, `update-gitops.yml` tự động mở Pull Request sang kho lưu trữ `aws-cloud-native-sre-platform` để cập nhật chính xác `sha256` digest mới vào `kustomization.yaml` của môi trường tương ứng.
- **Branch-to-Environment Mapping:** `app3:dev -> gitops:dev` (Auto-sync), `app3:staging -> gitops:staging`, `app3:main -> gitops:main` (Manual Sync Gate).

---

## 2. Đặc tả Luồng Promotion

| Nhánh Nguồn (`app3`) | Nhánh Đích (`gitops`) | File Được Cập nhật | Argo CD Sync Mode |
| :--- | :--- | :--- | :--- |
| `dev` | `dev` | `envs/dev/kustomization.yaml` | Automated (`selfHeal: true`) |
| `staging` | `staging` | `envs/staging/kustomization.yaml` | Manual Sync Gate |
| `main` | `main` | `envs/prod/kustomization.yaml` | Manual Sync Gate + Canary |

---

## 3. Chiến lược Tagging & Labels

| Commit / PR Convention | Ví dụ | Mục đích |
| :--- | :--- | :--- |
| `deploy(app3): promote <sha> image digests` | `deploy(app3): promote c1f2672 image digests to main` | Chuẩn hóa lịch sử triển khai trong GitOps |

---

## 4. Tham chiếu IaC / GitOps
- [envs/dev/kustomization.yaml](../../gitops/applications/reliability-shop/envs/dev/kustomization.yaml)
- [envs/prod/kustomization.yaml](../../gitops/applications/reliability-shop/envs/prod/kustomization.yaml)

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
- **PASS:** PR tự động cập nhật đúng 5 image digests mà không làm sai cấu trúc YAML, Argo CD nhận diện revision mới và sync thành công.
