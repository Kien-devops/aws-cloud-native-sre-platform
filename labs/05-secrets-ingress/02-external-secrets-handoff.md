# 05.02b — External Secrets Operator (ESO) Integration

> **Phạm vi:** Automated Secret Sync (AWS -> Kubernetes) | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Declarative Secret Sync:** ESO tự động đồng bộ secret từ AWS Secrets Manager thành Kubernetes `Secret` theo chu kỳ `refreshInterval: 1h`.
- **Auth via Pod Identity:** Không dùng IAM User keys; ESO ServiceAccount xác thực thông qua EKS Pod Identity Association (`sre-platform-dev-eso-role`).

---

## 2. Đặc tả Tài nguyên Kubernetes (ESO Specs)

| Kind | Tên Resource | Namespace | Tham số Cấu hình Cốt lõi |
| :--- | :--- | :--- | :--- |
| **ClusterSecretStore** | `aws-secretsmanager-dev` | Cluster-scoped | Provider: `AWS SecretsManager`, Region: `ap-southeast-1` |
| **ExternalSecret** | `reliability-shop-credentials` | `reliability-shop` (+ staging/prod) | `refreshInterval: 1h`, Target K8s Secret: `app-credentials`, `creationPolicy: Owner` |
| **ExternalSecret** | `grafana-admin-credentials` | `monitoring` | Sync `/sre-platform/dev/grafana/admin` -> `grafana-admin-secret` |

---

## 3. Chiến lược Tagging & Labels

| Label Key | Label Value | Mục đích |
| :--- | :--- | :--- |
| `app.kubernetes.io/part-of` | `external-secrets` | Định danh thành phần platform |
| `environment` | `dev` \| `staging` \| `prod` | Phân tách scope sync |

---

## 4. Tham chiếu IaC / GitOps
- [cluster-secret-store.yaml](../../gitops/platform/external-secrets/cluster-secret-store.yaml)
- [external-secret.yaml](../../gitops/applications/reliability-shop/base/external-secret.yaml)

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
```bash
kubectl get clustersecretstore aws-secretsmanager-dev
kubectl get externalsecret -A
```
- **PASS:** `ClusterSecretStore` trạng thái `Valid` (`Ready = True`), mọi `ExternalSecret` ở trạng thái `SecretSynced`.
