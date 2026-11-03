# Karpenter

## Status

`PLANNED` — chưa có Karpenter controller, `NodePool` hoặc `EC2NodeClass`.

## Purpose

Dự kiến provision node theo pending pods, capacity type và workload constraints.

## Repository ownership

Platform SRE sở hữu controller/node policy; application teams sở hữu resource requests/limits và disruption budget.

## Prerequisites

Controller/CRD version, cluster discovery tags, node IAM role, interruption handling, subnet/security group, architecture và Spot policy.

## AWS/EKS integration

Karpenter sẽ gọi EC2 APIs và tạo node; repo hiện không tạo role, instance profile hay EC2 resource.

## Security/IAM

Giới hạn IAM theo cluster tags, enforce taints/labels và tránh cho workload tự chọn quyền node. Review controller identity.

## Cost/operations

Spot tiết kiệm nhưng có interruption; limits, consolidation và budgets cần đặt trước. Theo dõi pending pods, node churn và EC2 spend.

## Enablement

Chỉ thêm NodePool/NodeClass sau capacity test và rollback plan. `NOT_DEPLOYED`.

## Validation

Chưa có node policy để kiểm tra. `Measured Result: NOT DEPLOYED`.

## Rollback

Revert NodePool/NodeClass, cordon/drain theo runbook; không terminate node hàng loạt khi chưa kiểm tra workload coverage.
