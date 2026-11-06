# Karpenter

**Cấp node theo nhu cầu Pod, có giới hạn capacity và disruption.**

[GitOps](../../README.md) / [Platform](../README.md) / Karpenter

| Tệp | Cấu hình chính |
| --- | --- |
| [nodepool-workload-spot.yaml](nodepool-workload-spot.yaml) | Spot + on-demand, amd64, trần 24 CPU / 48 GiB, disruption budget 20% |
| [ec2nodeclass.yaml](ec2nodeclass.yaml) | AL2023, discovery tags, node role có sẵn, EBS mã hóa và IMDSv2 |
| [kustomization.yaml](kustomization.yaml) | Điểm nạp hai node policy |

## Status

NodePool và EC2NodeClass được platform Kustomization nạp. Controller, CRD và IAM không được cài trong thư mục này.

## Purpose

Karpenter dùng pending pods, requests và scheduling constraints để chọn capacity. Alias AMI hiện là `al2023@latest`; cần review thay đổi AMI khi vận hành.

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

Chuẩn bị controller, node role, discovery tags và interruption handling trước khi sync node policy.

## Validation

Render cục bộ: `kubectl kustomize gitops/platform/karpenter`. Runtime: kiểm tra NodePool, EC2NodeClass, NodeClaim và Pending events; chưa có phép đo provisioning trong lần chỉnh tài liệu này.

## Rollback

Revert NodePool/NodeClass, cordon/drain theo runbook; không terminate node hàng loạt khi chưa kiểm tra workload coverage.
