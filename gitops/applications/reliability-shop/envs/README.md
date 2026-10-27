# Multi-Environment GitOps Overlays

Thư mục này quản lý cấu hình phân tầng 3 môi trường (`dev`, `staging`, `prod`) theo chuẩn **Trunk-Based GitOps** (1 nhánh `main` duy nhất, phân chia theo Kustomize Overlays):

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
