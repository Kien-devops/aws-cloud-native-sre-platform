# KEDA

**Co giãn payment-worker theo backlog Amazon SQS.**

[GitOps](../../README.md) / [Platform](../README.md) / KEDA

| Tệp | Vai trò |
| --- | --- |
| [keda-operator.yaml](keda-operator.yaml) | CRD, RBAC và controller KEDA `2.14.0` |
| [kustomization.yaml](kustomization.yaml) | Điểm nạp của platform |
| [Application scaler](../../applications/reliability-shop/base/keda-scaledobject.yaml) | TriggerAuthentication và ScaledObject |

## Status

Controller manifests được platform nạp; ScaledObject nằm trong application base. Trạng thái co giãn cần được xác nhận trên cluster.

## Purpose

Scale payment-worker theo queue depth, hiện giữ từ 2 đến 10 replica. Cấu hình này không scale về 0.

## Repository ownership

Platform SRE sở hữu KEDA controller; application team sở hữu trigger metadata, queue contract và worker concurrency.

## Prerequisites

KEDA controller/CRD, queue name/URL, IAM Pod Identity/IRSA, network path tới SQS, visibility timeout và DLQ policy.

## AWS/EKS integration

Scaler đọc SQS bằng controller identity. Queue URL được patch theo môi trường; Pod Identity association và IAM phải được cấu hình bên AWS.

## Security/IAM

Chỉ cấp quyền đọc metric/queue cần thiết; không nhúng AWS keys vào `ScaledObject`. Kiểm tra namespace và trigger authentication.

## Cost/operations

Giữ tối thiểu 2 worker giảm cold-start nhưng duy trì chi phí nền. Cần alert backlog age, poison messages và max replica guardrail.

## Enablement

Xác nhận CRD, controller identity và quyền đọc queue trước khi sync ScaledObject. Theo dõi backlog age cùng số worker để tránh đẩy quá tải xuống database.

## Validation

Render cục bộ: `kubectl kustomize gitops/platform/keda`. Runtime: kiểm tra ScaledObject conditions, HPA do KEDA tạo và queue age.

## Rollback

Disable scaler/revert manifest rồi giữ worker Deployment stable; không xóa queue/DLQ trong rollback.
