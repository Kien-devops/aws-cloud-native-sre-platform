# Monitoring

## Status

`PLANNED` — chưa có manifest, Helm release hoặc controller được quản lý tại đây.

## Purpose

Dự kiến quản lý metrics, logs, traces, dashboards và alert rules cho EKS.

## Repository ownership

Platform SRE sở hữu collectors/rules; application teams sở hữu service instrumentation và alert ownership.

## Prerequisites

Chọn stack/controller, storage/retention, namespace, CRD versions, scrape permissions và notification destination.

## AWS/EKS integration

Có thể tích hợp CloudWatch, S3 hoặc managed services; endpoint, IAM và data residency phải được thiết kế trước. Không giả định integration hiện đã hoạt động.

## Security/IAM

Least privilege cho collectors, encryption, tenant boundaries và log redaction bắt buộc. Không cấp cluster-admin mặc định.

## Cost/operations

Retention, log volume và trace sampling là cost drivers. Cần capacity, upgrade và runbook trước khi cài.

## Enablement

Chỉ thêm manifest sau khi có design, owner, IAM, SLO, rollback và review. `NOT_DEPLOYED`.

## Validation

Chưa có runtime target để kiểm tra. `Measured Result: NOT DEPLOYED`.

## Rollback

Khi được triển khai, revert Git và giữ dữ liệu theo retention policy; không xóa storage chỉ vì rollback controller.
