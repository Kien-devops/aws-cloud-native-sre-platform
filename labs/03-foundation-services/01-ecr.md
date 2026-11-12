# 03.01 — Amazon ECR Private Repositories

> **Phạm vi:** Immutable Container Registry | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Immutable Tagging:** Ngăn chặn ghi đè image tag (ví dụ `git-<sha>`) trong production bằng `IMMUTABLE` tag mutability; GitOps luôn pin chính xác `sha256` digest.
- **Vulnerability Scanning & Lifecycle FinOps:** Bật Scan on Push và tự động dọn dẹp untagged/old images quá `10` bản để kiểm soát dung lượng lưu trữ.

---

## 2. Đặc tả Tài nguyên (Resource Inventory & Config)

| Resource Type | Tên Repository | Tham số Cấu hình Cốt lõi |
| :--- | :--- | :--- |
| **ECR Repo 1** | `reliabilityshop/frontend` | Tag Mutability: `IMMUTABLE`, Scan on Push: `Enabled`, Encryption: `KMS` |
| **ECR Repo 2** | `reliabilityshop/auth-service` | Tag Mutability: `IMMUTABLE`, Scan on Push: `Enabled`, Encryption: `KMS` |
| **ECR Repo 3** | `reliabilityshop/order-service` | Tag Mutability: `IMMUTABLE`, Scan on Push: `Enabled`, Encryption: `KMS` |
| **ECR Repo 4** | `reliabilityshop/inventory-service` | Tag Mutability: `IMMUTABLE`, Scan on Push: `Enabled`, Encryption: `KMS` |
| **ECR Repo 5** | `reliabilityshop/payment-worker` | Tag Mutability: `IMMUTABLE`, Scan on Push: `Enabled`, Encryption: `KMS` |
| **Lifecycle Policy** | Áp dụng cho cả 5 repos | Giữ tối đa `10` tagged images mới nhất, xóa `untagged` sau `1 day` |

---

## 3. Chiến lược Tagging & Labels

| Tag Key | Tag Value | Mục đích |
| :--- | :--- | :--- |
| `Project` | `sre-platform` | Phân bổ chi phí lưu trữ ECR |
| `Application` | `reliability-shop` | Định danh bộ microservices |
| `ManagedBy` | `CI-GitHub-Actions` | Liên kết luồng build từ `app3` |

---

## 4. Tham chiếu IaC / GitOps
- Image Digest Pinning: [gitops/applications/reliability-shop/base/kustomization.yaml](../../gitops/applications/reliability-shop/base/kustomization.yaml)
- CI Push Workflow: `app3/.github/workflows/build-push.yml`

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
```bash
aws ecr describe-repositories --region ap-southeast-1 --query "repositories[].{Name:repositoryName,Mutability:imageTagMutability,Scan:imageScanningConfiguration.scanOnPush}"
```
- **PASS:** Đủ 5 repositories `reliabilityshop/*`, `imageTagMutability = IMMUTABLE`, `scanOnPush = true`.
