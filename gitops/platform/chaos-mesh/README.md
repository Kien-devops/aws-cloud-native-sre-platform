# Chaos Mesh

**Module dự kiến cho fault injection có kiểm soát.**

[GitOps](../../README.md) / [Platform](../README.md) / Chaos Mesh

> [!NOTE]
> Thư mục hiện chỉ có tài liệu, chưa được platform Kustomization nạp. Xem [Chaos Engineering](../../../chaos/README.md) để đọc phạm vi diễn tập.

## Status

`PLANNED` — chưa cài controller/CRD và chưa có experiment.

## Purpose

Dự kiến diễn tập có kiểm soát cho pod, network và dependency failure sau approval.

## Repository ownership

SRE sở hữu controller/experiment; service owner phê duyệt blast radius, lịch chạy và success criteria.

## Prerequisites

Controller/CRD, isolated namespace, maintenance window, alerts, backup/rollback runbook và explicit experiment approval.

## AWS/EKS integration

Có thể mô phỏng ảnh hưởng tới EKS networking hoặc dependency như RDS/Redis; repo chưa khai báo experiment hay AWS mutation.

## Security/IAM

Đây là capability rủi ro cao: không cấp quyền node/cluster rộng hơn cần thiết, giới hạn selectors và deny production mặc định.

## Cost/operations

Experiment có thể gây downtime, retry và phí tài nguyên; bắt buộc giới hạn thời lượng và cleanup tự động.

## Enablement

Chỉ bật sau game-day design, approval và dry-run. `NOT_DEPLOYED`.

## Validation

Chưa có experiment để xác nhận. `Measured Result: NOT DEPLOYED`.

## Rollback

Stop experiment, restore workload/network theo runbook; xác nhận health trước khi đóng incident.
