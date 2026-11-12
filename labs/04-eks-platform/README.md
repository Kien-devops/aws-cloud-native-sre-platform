# Module 04 — Amazon EKS Platform & Pod Identity

> **Phạm vi:** Kubernetes Control Plane, Compute, Managed Add-ons & IAM Pod Identity | **Region:** `ap-southeast-1`

Module 04 đặc tả cụm Amazon EKS đa Availability Zone (`sre-platform-dev`), tầng System Nodes cố định, 7 EKS Managed Add-ons và cơ chế cấp quyền hiện đại **EKS Pod Identity** (thay thế IRSA).

---

## Danh sách Đặc tả

| Mã | Tài liệu | Nội dung Chính |
| :--- | :--- | :--- |
| `04.01` | [EKS Control Plane](01-eks-cluster.md) | `sre-platform-dev`, Private App Subnets, KMS etcd Encryption, 5 Control Plane Logs |
| `04.02` | [Managed Node Groups](02-node-groups.md) | `sre-platform-dev-system-nodes` (`t3.medium`, `min=2`, `max=15`, AL2023) |
| `04.03` | [EKS Managed Add-ons](03-managed-addons.md) | `vpc-cni`, `coredns`, `kube-proxy`, `ebs-csi-driver`, `eks-pod-identity-agent`, `metrics-server`, `aws-load-balancer-controller` |
| `04.04` | [EKS Pod Identity](04-pod-identity.md) | 7 Pod Identity Associations (AWS LBC, ESO, Karpenter, `reliability-shop-sa`, ...) |
| `04.05` | [Platform Health Baseline](05-platform-health.md) | Kiểm chứng Nodes, System Pods & CoreDNS readiness |
