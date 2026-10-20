# Lab 04 - Nền tảng Amazon EKS

Tạo control plane, data plane và add-on nền tảng bằng AWS Console. Kubernetes workload, add-on GitOps và application manifest được bàn giao cho Argo CD; lab này không `kubectl apply`.

## Thứ tự

`01-eks-cluster` → `02-node-groups` → `03-managed-addons` → `04-pod-identity` → `05-platform-health`.

## Prerequisite

VPC/private subnets nhiều AZ, IAM role EKS, node instance role, security groups, ECR và logging policy. Cluster name, Kubernetes version và Region phải cố định trước khi tạo.

