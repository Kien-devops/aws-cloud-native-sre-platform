# 05.02 — Handoff External Secrets

## Input

- EKS, Pod Identity và secret metadata đã sẵn sàng.
- GitOps repository có namespace và owner rõ ràng.

## Handoff steps

1. Tạo SecretStore hoặc ClusterSecretStore trong GitOps với quyền đọc tối thiểu.
2. Tạo ExternalSecret trỏ tới tên secret; không ghi plaintext vào Git.
3. Argo CD sync; ESO đọc Secrets Manager và tạo Kubernetes Secret.
4. Kiểm tra chiến lược reload khi Secret rotation.

## Verify / Output

- Expected: ExternalSecret Ready, Secret được tạo đúng namespace.
- Measured Result: Chưa thực hiện; chỉ lưu status/events đã redact.
- Output: sync revision, resource status và rotation test result.

## Gate / Troubleshooting / Cleanup

- Gate: không có secret value trong Git/log; IAM chỉ đọc ARN cần thiết.
- Lỗi sync: kiểm tra Pod Identity, Region, secret name, KMS policy và ESO logs.
- Cleanup: xóa ExternalSecret trước workload; giữ/xóa Secrets Manager secret theo retention policy.
