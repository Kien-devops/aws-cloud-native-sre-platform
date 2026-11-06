# Multi-Environment GitOps Overlays

**Một base ứng dụng, ba overlay, chính sách phát hành riêng.**

[Trang chủ](../../../../README.md) / [GitOps](../../../README.md) / Environments

Thư mục này quản lý `dev`, `staging`, `prod` bằng Kustomize. Argo CD lần lượt đọc nhánh `dev`, `staging`, `main`; đây là mô hình kết hợp nhánh môi trường và overlay.

```text
gitops/applications/reliability-shop/envs/
├── dev/         # Môi trường Dev (Auto Sync): namespace reliability-shop (shop.dev.devopsss.site)
├── staging/     # Môi trường Staging (Auto Sync khi merge PR): namespace reliability-shop-staging (shop-staging.dev.devopsss.site)
└── prod/        # Môi trường Production (Manual Sync Gate): namespace reliability-shop-prod (shop-prod.dev.devopsss.site)
```

## Ma trận Phân tầng Môi trường

| Môi trường | Thư mục Overlay | Kubernetes Namespace | Ingress Host | Chính sách Argo CD |
| :--- | :--- | :--- | :--- | :--- |
| **DEV** | `envs/dev` | `reliability-shop` | `shop.dev.devopsss.site` | **Auto Sync** (Self-Heal: True) |
| **STAGING** | `envs/staging` | `reliability-shop-staging` | `shop-staging.dev.devopsss.site` | **Auto Sync** khi merge PR |
| **PRODUCTION** | `envs/prod` | `reliability-shop-prod` | `shop-prod.dev.devopsss.site` | **Manual Sync Gate** (Bắt buộc SRE bấm Sync) |

## Review trước promotion

| Kiểm tra | Nguồn cấu hình |
| --- | --- |
| Image bất biến | `images[].digest` trong mỗi overlay |
| Queue và host | Patch `ConfigMap`, `ScaledObject`, `Ingress` |
| Revision và quyền sync | [Bootstrap](../../../bootstrap/root-application.yaml) |
| Kết nối dữ liệu và secret | [Base](../base/kustomization.yaml) và [ExternalSecret](../base/external-secret.yaml) |

> [!IMPORTANT]
> Namespace và SQS tách riêng chưa tạo ranh giới dữ liệu đầy đủ: staging/prod hiện kế thừa DB, Redis và secret dev từ base. Kiểm tra các dependency này trước khi dùng môi trường với dữ liệu riêng.
