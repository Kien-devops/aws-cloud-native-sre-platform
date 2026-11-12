# 05.03 — AWS Load Balancer Controller (LBC) Prerequisites

> **Phạm vi:** Ingress Controller Foundation | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **IP Target Mode (`target-type: ip`):** ALB gửi traffic thẳng tới Pod IP trên VPC CNI thay vì đi vòng qua EC2 NodePort, giảm 1 network hop và hỗ trợ zero-downtime Pod draining.
- **Tag-Based Subnet Discovery:** LBC yêu cầu Public Subnets gắn tag `kubernetes.io/role/elb = 1` và `kubernetes.io/cluster/sre-platform-dev = shared`.

---

## 2. Đặc tả Tài nguyên (Resource Inventory & Config)

| Resource Type | Tên Resource (Naming) | Tham số Cấu hình Cốt lõi |
| :--- | :--- | :--- |
| **IAM Role** | `sre-platform-dev-lbc-role` | Gắn AWS LBC IAM Policy chính thức |
| **Pod Identity** | `kube-system/aws-load-balancer-controller` | Liên kết `sre-platform-dev-lbc-role` với EKS cluster `sre-platform-dev` |
| **Helm / Controller** | `aws-load-balancer-controller` | Namespace: `kube-system`, `clusterName: sre-platform-dev`, `vpcId`, `region: ap-southeast-1` |
| **ALB Security Group** | `sre-platform-dev-alb-sg` | Mở `80/443` inbound từ `0.0.0.0/0` |

---

## 3. Chiến lược Tagging & Labels

| Tài nguyên | Tag Key | Tag Value | Mục đích |
| :--- | :--- | :--- | :--- |
| **Public Subnets** | `kubernetes.io/role/elb` | `1` | Bắt buộc để LBC đặt internet-facing ALB |
| **Toàn bộ Subnets** | `kubernetes.io/cluster/sre-platform-dev` | `shared` | Bắt buộc để LBC tìm đúng VPC/Subnets |

---

## 4. Tham chiếu IaC / GitOps
- [01-vpc.tf](../../iac/terraform/envs/dev/01-vpc.tf#L27-L55) — Subnet tags cho ELB discovery.

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
```bash
kubectl get deployment -n kube-system aws-load-balancer-controller
```
- **PASS:** `READY 2/2`, log controller không báo lỗi `couldn't auto-discover subnets` hay `AccessDenied`.
