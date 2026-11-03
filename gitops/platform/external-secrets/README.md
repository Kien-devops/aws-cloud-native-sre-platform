# External Secrets

## Status

`ACTIVE` — chỉ quản lý `ClusterSecretStore` configuration. External Secrets Operator (ESO), CRD và Pod Identity không được cài ở đây.

## Purpose

`cluster-secret-store.yaml` khai báo AWS Secrets Manager tại `ap-southeast-1` cho workload tham chiếu bằng `ExternalSecret`.

## Repository ownership

Platform SRE sở hữu store/provider contract. Application team sở hữu `ExternalSecret` và consumer Secret. ESO sở hữu quá trình reconcile.

## Prerequisites

ESO controller/CRD, EKS Pod Identity hoặc IRSA role, secret path, KMS permissions nếu dùng CMK, network route/VPC endpoint và region phải sẵn sàng. Store phải Ready trước consumer.

## AWS/EKS integration

ESO gọi AWS Secrets Manager bằng controller identity, đọc secret theo IAM policy rồi tạo/cập nhật Kubernetes Secret. Repo không chứa secret value và không tạo AWS secret.

## Security/IAM

Giới hạn `secretsmanager:GetSecretValue` theo ARN/path cần thiết và KMS decrypt theo CMK cần thiết. Vì đây là `ClusterSecretStore`, review RBAC/ESO namespace policy trước khi cho namespace mới tham chiếu.

## Cost/operations

Chi phí gồm Secrets Manager secret/API calls và KMS requests nếu áp dụng. Theo dõi store conditions, ESO events, refresh errors và CloudTrail; không log secret payload.

## Enablement

Sync platform, xác nhận store `Ready`, sau đó mới sync application `ExternalSecret`. Không tạo secret thủ công để che lỗi provider.

## Validation

```powershell
kubectl kustomize gitops/platform/external-secrets
kubectl get clustersecretstore aws-secretsmanager-dev
kubectl describe clustersecretstore aws-secretsmanager-dev
kubectl -n reliability-shop get externalsecret
```

`Ready=True` và secret sync phải xác nhận trên cluster thật; local render không chứng minh IAM/network. Runtime evidence: `NOT_MEASURED`.

## Rollback

Revert provider/region trong Git rồi sync. Giữ generated Kubernetes Secret nếu ứng dụng cần continuity; không xóa AWS secret trong rollback cấu hình.
