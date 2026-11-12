# 06.04 — ReliabilityShop Base Manifests

> **Phạm vi:** Microservices Workload Specification | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **ConfigMap / Secret Separation:** Toàn bộ cấu hình không nhạy cảm (RDS host, Redis host, SQS queue name, OTel endpoint) nằm trong ConfigMap `app-config`; toàn bộ mật khẩu đồng bộ qua `ExternalSecret` -> Secret `app-credentials`.
- **Zero-Downtime & Observability:** Gắn sẵn `NODE_OPTIONS=--require /otel-auto-instrumentation/autoinstrumentation.js` để thu thập distributed traces & metrics tự động.

---

## 2. Đặc tả Thành phần Microservices (`base/`)

| Service / Resource | Kind | Port / Target | Tham số Cấu hình Cốt lõi |
| :--- | :--- | :--- | :--- |
| `frontend` | `Deployment` + `Service` | `80 -> 8080` | Storefront UI & SRE Diagnostics Console |
| `auth-service` | `Deployment` + `Service` | `3001` | JWT Authentication |
| `order-service` | `Rollout` (Argo Rollouts) | `3002` | Canary Progressive Delivery (`20% -> 50% -> 100%`), Outbox Pattern -> RDS + SQS |
| `inventory-service` | `Deployment` + `Service` | `3003` | Stock verification |
| `payment-worker` | `Deployment` | Async Worker | KEDA ScaledObject poll SQS (`min=2`, `max=10`) |
| `reliability-shop-sa` | `ServiceAccount` | — | Gắn EKS Pod Identity cho quyền SQS |

---

## 3. Chiến lược Tagging & Labels

| Label Key | Label Value | Mục đích |
| :--- | :--- | :--- |
| `app.kubernetes.io/part-of` | `reliability-shop` | Gom nhóm ứng dụng |
| `instrumentation.opentelemetry.io/inject-nodejs` | `true` | Kích hoạt OTel Auto-Instrumentation |

---

## 4. Tham chiếu IaC / GitOps
- [gitops/applications/reliability-shop/base/kustomization.yaml](../../gitops/applications/reliability-shop/base/kustomization.yaml)
- [order-service-rollout.yaml](../../gitops/applications/reliability-shop/base/order-service-rollout.yaml)

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
```bash
kubectl get deploy,rollout,svc -n reliability-shop
```
- **PASS:** Toàn bộ 5 microservices `READY`, `app-config` và `app-credentials` được mount đầy đủ.
