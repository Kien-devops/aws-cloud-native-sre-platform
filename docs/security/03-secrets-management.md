# Quản lý Secret

> **Loại tài liệu:** hướng dẫn thiết kế và thực nghiệm, chưa chứng minh tài nguyên AWS đã triển khai. Tham khảo [mục lục](../README.md) và [README dự án](../../README.md).

## Mục tiêu

AWS Secrets Manager là nguồn sự thật. External Secrets Operator (ESO) đọc bằng Pod Identity rồi tạo Kubernetes Secret. Không ghi plaintext vào Git, log, issue, Terraform output hoặc ảnh chụp.

Trong project, thước đo sau cùng luôn là **trải nghiệm người dùng và khả năng khôi phục dịch vụ**. Việc có công cụ hoặc manifest không thay thế được bằng chứng thực nghiệm.

## Kiến trúc và luồng dữ liệu

Secrets Manager + KMS → SecretStore/ClusterSecretStore → ExternalSecret → Kubernetes Secret → Deployment/Pod → ứng dụng. `SecretStore` giới hạn namespace; chỉ dùng `ClusterSecretStore` khi cần chia sẻ.

Mã hóa bằng KMS, ARN cụ thể và tách Secret theo môi trường. Rotation phải đi cùng chiến lược reload; Secret đổi không tự động làm mọi process đọc lại.

Luồng này mang tính logic; khi dựng phải xác nhận đúng network routes, resource ownership, telemetry paths và IAM.

## Quy trình rotation

1. Tạo version mới, giữ version cũ trong cửa sổ rollback.
2. Xác nhận ESO đồng bộ và không báo lỗi.
3. Reload/restart theo readiness, `maxUnavailable` và connection draining.
4. Kiểm tra client, authentication, pool và audit log.
5. Thu hồi version cũ sau rollback window; chỉ ghi mốc thời gian.

```bash
kubectl get secretstore,clustersecretstore,externalsecret -A
kubectl describe externalsecret <name> -n <namespace>
kubectl -n external-secrets logs deploy/external-secrets
aws secretsmanager describe-secret --secret-id <secret-arn>
aws secretsmanager list-secret-version-ids --secret-id <secret-arn>
```

**Expected:** `ExternalSecret` Ready và ứng dụng xử lý credential mới. **Measured Result:** lưu status/events, log đã redact và kiểm thử client; không xuất dữ liệu thật.

## Xử lý sự cố

| Triệu chứng | Nguyên nhân có thể | Kiểm tra |
| --- | --- | --- |
| ESO không Ready | Controller log, ServiceAccount, association | Sửa IAM/region/secret reference |
| Secret cũ | Refresh interval, version stage, pod reload | Reload có kiểm soát, kiểm tra mount/env |
| 403/KMS denied | Resource policy, key policy, role | Bổ sung đúng principal, giữ scope hẹp |
| Secret bị lộ | Git/log/trace/artifact history | Cô lập, rotate, revoke, review audit |

## Guardrail production

Giới hạn quyền ESO và namespace; bật cảnh báo đọc Secret bất thường; kiểm tra restore mà không ghi plaintext. Xác định thời gian ứng dụng có thể dùng credential cache khi Secrets Manager gián đoạn.

Ngoài ra phải áp dụng least privilege, tách staging/prod, kiểm soát telemetry cardinality/retention, bảo vệ dữ liệu nhạy cảm, giới hạn blast radius, dự trù chi phí và ghi rõ failure domain.

## Tiêu chí nghiệm thu

- [ ] Không có plaintext trong Git, CI, image hoặc telemetry.
- [ ] Rotation và rollback đã thử trong môi trường cô lập.
- [ ] Có cảnh báo sync lỗi, đọc bất thường và KMS denied.
- [ ] Có owner, TTL, rotation interval và break-glass.
- [ ] Tách Expected với Measured Result.

## Tham khảo

- [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html)
- [External Secrets Operator](https://external-secrets.io/latest/)
- [EKS envelope encryption](https://docs.aws.amazon.com/eks/latest/userguide/enable-kms.html)
