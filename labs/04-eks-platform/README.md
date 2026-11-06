# Module 04 — Nền tảng Amazon Elastic Kubernetes Service (EKS Platform)

**Control plane, compute và workload identity trước khi triển khai ứng dụng.**

[Labs](../README.md) / Module 04 · [Trước: Foundation](../03-foundation-services/README.md) · [Tiếp: Secrets & Ingress](../05-secrets-ingress/README.md)

> **Mục tiêu Module:** Xây dựng nền tảng tính toán đám mây Kubernetes tiêu chuẩn doanh nghiệp (Enterprise-grade EKS Platform) trên AWS: Khởi tạo Control Plane có mã hóa KMS etcd, xây dựng Managed Node Group đa vùng (Multi-AZ), cấu hình Managed Add-ons và triển khai cơ chế phân quyền EKS Pod Identity tiên tiến.

---

## 1. Sơ đồ Kiến trúc Nền tảng EKS (Architecture Map)

```text
       +--------------------------------------------------------------+
       | Amazon EKS Control Plane (AWS Managed Master Nodes)          |
       | - Kubernetes 1.30+                                           |
       | - etcd Secrets Encryption: KMS CMK (alias/sre-platform-dev) |
       | - Control Plane Logging: API, Audit, Authenticator           |
       +------------------------------+-------------------------------+
                                      |
                     Private App Subnets ENI Cross-Connect
                                      |
       +------------------------------v-------------------------------+
       | Amazon EKS Data Plane (Managed Node Group: 2 - 4 Nodes)      |
       |                                                              |
       | [ Availability Zone: ap-southeast-1a ]                       |
       |  +--------------------------------------------------------+  |
       |  | EC2 Worker Node 1 (AL2023 - Private IP: 10.0.10.x)     |  |
       |  |  - CoreDNS Pod 1                                       |  |
       |  |  - aws-node DaemonSet (VPC CNI)                        |  |
       |  |  - kube-proxy DaemonSet                                |  |
       |  |  - eks-pod-identity-agent DaemonSet                    |  |
       |  +--------------------------------------------------------+  |
       |                                                              |
       | [ Availability Zone: ap-southeast-1b ]                       |
       |  +--------------------------------------------------------+  |
       |  | EC2 Worker Node 2 (AL2023 - Private IP: 10.0.11.x)     |  |
       |  |  - CoreDNS Pod 2                                       |  |
       |  |  - aws-node DaemonSet (VPC CNI)                        |  |
       |  |  - kube-proxy DaemonSet                                |  |
       |  |  - eks-pod-identity-agent DaemonSet                    |  |
       |  +--------------------------------------------------------+  |
       +--------------------------------------------------------------+
```

---

## 2. Thứ tự thực hành các bài Lab

| Lab | Tên bài | Dịch vụ AWS Console chính | Kết quả đầu ra |
| :--- | :--- | :--- | :--- |
| [04.01](01-eks-cluster.md) | **EKS Control Plane & etcd KMS** | Amazon EKS, KMS, CloudWatch | Cluster `sre-platform-dev` ở trạng thái Active, mã hóa etcd, audit logging |
| [04.02](02-node-groups.md) | **Managed Node Group Đa AZ** | EKS Compute, EC2, IAM | Nhóm node AL2023 nằm trong Private Subnets, chia đều trên 2 AZs |
| [04.03](03-managed-addons.md) | **EKS Managed Add-ons** | EKS Add-ons | 4 Core Add-ons: VPC CNI, CoreDNS (HA), kube-proxy, Pod Identity Agent |
| [04.04](04-pod-identity.md) | **Cấu hình EKS Pod Identity** | EKS Access, IAM Roles | Pod Identity Association hoạt động, cấp phát STS credentials trực tiếp cho Pods |
| [04.05](05-platform-health.md) | **Nghiệm thu Sức khỏe Nền tảng**| CloudWatch, kubectl | Báo cáo kiểm định toàn diện sức khỏe cluster, sẵn sàng cho GitOps |

---

## 3. Điều kiện tiên quyết (Prerequisites)

1. VPC Đa AZ và Private App Subnets từ **Module 02** đã sẵn sàng.
2. Khóa KMS Customer Managed Key (`alias/sre-platform-dev-main`) từ **Module 01** đã có quyền cho EKS.
3. IAM Roles cho Cluster và Node Groups đã được tạo theo đúng nguyên tắc Least Privilege.
