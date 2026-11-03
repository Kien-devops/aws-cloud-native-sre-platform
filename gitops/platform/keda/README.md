# KEDA

## Status

`PLANNED` — chưa cài KEDA, CRD hoặc `ScaledObject`; chưa có autoscaling runtime.

## Purpose

Dự kiến scale worker theo event, ví dụ độ sâu SQS, với min/max replica và cooldown được review theo workload.

## Repository ownership

Platform SRE sở hữu KEDA controller; application team sở hữu trigger metadata, queue contract và worker concurrency.

## Prerequisites

KEDA controller/CRD, queue name/URL, IAM Pod Identity/IRSA, network path tới SQS, visibility timeout và DLQ policy.

## AWS/EKS integration

KEDA có thể đọc SQS/CloudWatch metrics bằng IAM role; repo hiện chưa khai báo scaler hay AWS resource.

## Security/IAM

Chỉ cấp quyền đọc metric/queue cần thiết; không nhúng AWS keys vào `ScaledObject`. Kiểm tra namespace và trigger authentication.

## Cost/operations

Scale-to-zero giảm compute nhưng có cold-start và polling lag. Cần alert backlog age, poison messages và max replica guardrail.

## Enablement

Thêm controller, authentication và `ScaledObject` sau design review. `NOT_DEPLOYED`.

## Validation

Chưa có scaler để kiểm tra. `Measured Result: NOT DEPLOYED`.

## Rollback

Disable scaler/revert manifest rồi giữ worker Deployment stable; không xóa queue/DLQ trong rollback.
