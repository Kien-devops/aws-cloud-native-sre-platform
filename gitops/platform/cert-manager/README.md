# cert-manager

**Module dự kiến cho vòng đời certificate trong Kubernetes.**

[GitOps](../../README.md) / [Platform](../README.md) / cert-manager

> [!NOTE]
> Thư mục hiện chỉ có tài liệu, chưa được platform Kustomization nạp. Ingress hiện dùng chứng chỉ ACM được tham chiếu qua annotation.

## Status

`PLANNED` — chưa cài cert-manager controller/CRD, `Issuer` hoặc `Certificate`.

## Purpose

Dự kiến quản lý vòng đời certificate cho workload/Ingress khi issuer và trust model được chốt.

## Repository ownership

Platform SRE sở hữu controller/issuer; application teams sở hữu certificate requests và hostname ownership.

## Prerequisites

Chọn ACM/Private CA/Let's Encrypt, DNS-01 hoặc HTTP-01, IAM/Route 53 permissions, renewal alerts và private key policy.

## AWS/EKS integration

Có thể dùng Route 53 hoặc AWS Private CA; không có issuer hay AWS resource tương ứng trong repo hiện tại.

## Security/IAM

Bảo vệ private keys, giới hạn DNS changes, dùng encryption và tránh wildcard ngoài boundary đã phê duyệt.

## Cost/operations

Issuer/API quotas, DNS propagation và renewal failures cần alert; Private CA có chi phí cố định đáng kể.

## Enablement

Chốt trust model và thử renewal ở non-production trước khi thêm manifests. `NOT_DEPLOYED`.

## Validation

Chưa có Certificate/Issuer runtime. `Measured Result: NOT DEPLOYED`.

## Rollback

Revert issuer/certificate config, giữ certificate hiện hành tới khi replacement được xác nhận; không xóa private key/CA trong rollback thông thường.
