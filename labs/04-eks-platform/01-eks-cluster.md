# 04.01 — Amazon EKS Control Plane & etcd KMS Encryption

> **Phạm vi:** Kubernetes Control Plane & Auditability | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Private-First Control Plane:** ENIs của EKS Control Plane chỉ đặt tại 2 Private App Subnets (`10.0.10.0/24`, `10.0.11.0/24`).
- **etcd Envelope Encryption:** Toàn bộ Kubernetes `Secret` trong etcd được mã hóa bằng KMS CMK `alias/sre-platform-dev-main`.
- **Modern Access Entries:** Dùng `authentication_mode = API_AND_CONFIG_MAP` thay cho `aws-auth` ConfigMap cũ.
- **Full Audit Logging:** Bật đầy đủ 5 loại Control Plane Logs đẩy về CloudWatch Logs.

---

## 2. Đặc tả Tài nguyên (Resource Inventory & Config)

| Resource Type | Tên Resource (Naming) | Tham số Cấu hình Cốt lõi |
| :--- | :--- | :--- |
| **EKS Cluster** | `sre-platform-dev` | Version: `1.37` (hỗ trợ `1.31+`), `bootstrap_self_managed_addons = false` |
| **Cluster IAM Role** | `sre-platform-dev-eks-cluster-role` | Policy: `AmazonEKSClusterPolicy` |
| **VPC Subnets** | `private-app-1a`, `private-app-1b` | Endpoint Access: `endpoint_private_access = true`, `endpoint_public_access = true` |
| **Access Config** | EKS Access Entries | `authentication_mode = API_AND_CONFIG_MAP`, Creator Admin: `true` |
| **Control Plane Logs** | `/aws/eks/sre-platform-dev/cluster` | Bật đủ: `api`, `audit`, `authenticator`, `controllerManager`, `scheduler` |
| **Secrets Encryption** | KMS CMK | `alias/sre-platform-dev-main` |

---

## 3. Chiến lược Tagging & Labels

| Tag Key | Tag Value | Mục đích |
| :--- | :--- | :--- |
| `Name` | `sre-platform-dev` | Định danh cụm EKS |
| `Project` | `sre-platform` | Phân bổ chi phí Control Plane ($0.10/giờ) |
| `Environment` | `dev` | Cô lập môi trường |

---

## 4. Tham chiếu IaC / GitOps
- [03-eks.tf](../../iac/terraform/envs/dev/03-eks.tf#L3-L26) — Resource `aws_eks_cluster.main`.

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
```bash
aws eks describe-cluster --name sre-platform-dev --region ap-southeast-1 --query "cluster.{Status:status,Version:version,Encryption:encryptionConfig[0].resources}"
```
- **PASS:** `status = ACTIVE`, `encryptionConfig` chứa `secrets`, đủ 5 log types enabled.
