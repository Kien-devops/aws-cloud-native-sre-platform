# Argo Rollouts

## Status

`PLANNED` — chưa cài Rollouts controller/CRD và chưa có `Rollout` hay `AnalysisTemplate`.

## Purpose

Dự kiến progressive delivery canary/blue-green cho workload có metric gate và rollback tự động.

## Repository ownership

Platform SRE sở hữu controller/integration; application team sở hữu rollout steps, metric thresholds và release approval.

## Prerequisites

Controller/CRD, metrics provider, service routing, promotion policy, pause/abort runbook và immutable image.

## AWS/EKS integration

Có thể dùng CloudWatch/Prometheus metrics; chưa có provider hoặc IAM contract trong repo.

## Security/IAM

Giới hạn controller permissions, bảo vệ analysis endpoints và không tự động promote khi thiếu metric.

## Cost/operations

Canary tăng temporary capacity và complexity. Theo dõi error rate, latency, analysis failures và stuck rollout.

## Enablement

Triển khai controller trước, thử một workload non-critical, rồi mới thêm Rollout manifests. `NOT_DEPLOYED`.

## Validation

Chưa có rollout runtime. `Measured Result: NOT DEPLOYED`.

## Rollback

Abort/promote previous ReplicaSet theo runbook; Git revert chỉ là desired-state rollback, không thay thế quyết định traffic runtime.
