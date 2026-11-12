# 04.02 — EKS Managed Node Groups (System Compute Layer)

> **Phạm vi:** Two-Tier Compute (System On-Demand) | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Two-Tier Compute Separation:** Tầng Managed Node Group (`sre-platform-dev-system-nodes`) chạy các hệ thống cốt lõi (CoreDNS, Argo CD, Karpenter, Prometheus/Grafana); tầng Application Workloads do **Karpenter Spot Nodes** tự động cấp phát để tối ưu tới 70% chi phí.
- **Zero Public IP:** Nodes nằm hoàn toàn trong Private App Subnets, dùng Amazon Linux 2023 (`AL2023_x86_64_STANDARD`).

---

## 2. Đặc tả Tài nguyên (Resource Inventory & Config)

| Resource Type | Tên Resource (Naming) | Tham số Cấu hình Cốt lõi |
| :--- | :--- | :--- |
| **Managed Node Group** | `sre-platform-dev-system-nodes` | Instance Types: `["t3.medium"]`, AMI: `AL2023`, Disk: `20 GB gp3` |
| **Scaling Config** | Auto Scaling Group (EKS) | `min_size = 2`, `desired_size = 2`, `max_size = 15` |
| **Node IAM Role** | `sre-platform-dev-node-role` | Policies: `AmazonEKSWorkerNodePolicy`, `AmazonEKS_CNI_Policy`, `AmazonEC2ContainerRegistryReadOnly`, `AmazonSSMManagedInstanceCore` |
| **Subnets** | `private-app-1a`, `private-app-1b` | Phân bố đều trên 2 Availability Zones |

---

## 3. Chiến lược Tagging & Labels

| Tag Key | Tag Value | Mục đích |
| :--- | :--- | :--- |
| `Name` | `sre-platform-dev-system-nodes` | Định danh nhóm node hệ thống |
| `Project` | `sre-platform` | Phân bổ chi phí EC2 |
| `Environment` | `dev` | Cô lập môi trường |
| `karpenter.sh/discovery` | `sre-platform-dev` | Đồng bộ discovery với Karpenter |

---

## 4. Tham chiếu IaC / GitOps
- [03-eks.tf](../../iac/terraform/envs/dev/03-eks.tf#L28-L46) — Resource `aws_eks_node_group.system`.

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
```bash
aws eks describe-nodegroup --cluster-name sre-platform-dev --nodegroup-name sre-platform-dev-system-nodes --region ap-southeast-1 --query "nodegroup.{Status:status,InstanceTypes:instanceTypes,Scaling:scalingConfig}"
```
- **PASS:** `Status = ACTIVE`, `kubectl get nodes` hiển thị tối thiểu 2 nodes ở trạng thái `Ready`.
