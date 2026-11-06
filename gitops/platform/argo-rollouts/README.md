# Argo Rollouts

**Canary deployment và phân tích chất lượng phiên bản order-service.**

[GitOps](../../README.md) / [Platform](../README.md) / Argo Rollouts

| Tệp | Vai trò |
| --- | --- |
| [install.yaml](install.yaml) | CRD, RBAC và controller `v1.10.1` |
| [kustomization.yaml](kustomization.yaml) | Điểm nạp của platform |
| [Order Rollout](../../applications/reliability-shop/base/order-service-rollout.yaml) | Các bước canary của ứng dụng |
| [AnalysisTemplate](../../applications/reliability-shop/base/order-service-analysis-template.yaml) | Gate lỗi HTTP và p95 |

## Status

Manifest controller được platform Kustomization nạp. Workload có `Rollout` và `AnalysisTemplate`; runtime cần kiểm chứng trên cluster.

## Purpose

Order canary đi qua weight 20%, 50% rồi hoàn tất. Chưa có `trafficRouting`; tỷ lệ dựa trên replica, không phải điều phối chính xác request tại ALB.

## Repository ownership

Platform SRE sở hữu controller/integration; application team sở hữu rollout steps, metric thresholds và release approval.

## Prerequisites

Controller/CRD, metrics provider, service routing, promotion policy, pause/abort runbook và immutable image.

## AWS/EKS integration

AnalysisTemplate gọi Prometheus nội bộ. Query cần được đối chiếu với metric labels và revision; fallback khi thiếu dữ liệu có thể khiến analysis báo đạt.

## Security/IAM

Giới hạn controller permissions, bảo vệ analysis endpoints và không tự động promote khi thiếu metric.

## Cost/operations

Canary tăng temporary capacity và complexity. Theo dõi error rate, latency, analysis failures và stuck rollout.

## Enablement

Controller và CRD phải sẵn sàng trước khi sync workload. Xác nhận metric thực, pause/abort và rollback trên môi trường thử nghiệm trước khi dùng gate phát hành.

## Validation

Render cục bộ: `kubectl kustomize gitops/platform/argo-rollouts`. Runtime: kiểm tra Rollout, AnalysisRun và phản hồi API theo từng revision.

## Rollback

Abort/promote previous ReplicaSet theo runbook; Git revert chỉ là desired-state rollback, không thay thế quyết định traffic runtime.
