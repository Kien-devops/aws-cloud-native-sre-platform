# Module 06 — GitOps Engine & Application Delivery (Argo CD)

> **Phạm vi:** Argo CD App-of-Apps, AppProjects & Kustomize Overlays | **Region:** `ap-southeast-1`

Module 06 đặc tả kiến trúc GitOps điều phối toàn bộ platform add-ons và bộ microservices **ReliabilityShop** qua 3 môi trường (`dev`, `staging`, `prod`).

---

## Danh sách Đặc tả

| Mã | Tài liệu | Nội dung Chính |
| :--- | :--- | :--- |
| `06.01` | [Argo CD Bootstrap](01-argocd-bootstrap.md) | Namespace `argocd`, Pinned Version `v2.11+`, Root App-of-Apps |
| `06.02` | [AppProjects & Environments](02-projects-environments.md) | `platform-project` & `reliability-shop-project`, Destination RBAC |
| `06.03` | [Platform Applications](03-platform-applications.md) | `platform-infrastructure` (ESO, KEDA, Karpenter, Argo Rollouts, Monitoring) |
| `06.04` | [ReliabilityShop Base](04-reliabilityshop-base.md) | Base manifests, `app-config`, `ExternalSecret`, Rollout, ScaledObject |
| `06.05` | [Environment Overlays](05-environment-overlays.md) | `dev` (Auto-Sync) vs `staging` & `prod` (Manual Sync Gate) |
| `06.06` | [First Sync & Smoke Test](06-first-sync-smoke.md) | Kiểm chứng Synced/Healthy & Luồng End-to-End RDS -> SQS -> Redis |
