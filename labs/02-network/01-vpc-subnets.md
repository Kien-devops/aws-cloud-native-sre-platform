# 02.01 — Amazon VPC & 6 Subnets Đa Availability Zone

> **Phạm vi:** Network Foundation & Auto-Discovery Tagging | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **3-Tier Network Architecture:** Cô lập hoàn toàn Public Ingress, Private Compute (EKS/Pods) và Private Data (RDS/Redis) trên 2 AZ độc lập (`ap-southeast-1a`, `ap-southeast-1b`).
- **DNS Resolution Enabled:** Bật cả `enable_dns_support` và `enable_dns_hostnames` để VPC Resolver tự phân giải Private IP cho RDS, ElastiCache và EKS API.
- **Tag-Driven Auto-Discovery:** Gắn đúng tag chuẩn Kubernetes & Karpenter trên từng Subnet.

---

## 2. Đặc tả Tài nguyên (Resource Inventory & Config)

| Resource Type | Tên Resource (Naming) | CIDR / AZ | Tham số Cấu hình Cốt lõi |
| :--- | :--- | :--- | :--- |
| **VPC** | `sre-platform-dev-vpc` | `10.0.0.0/16` | `enable_dns_support = true`, `enable_dns_hostnames = true`, Tenancy: `default` |
| **Public Subnet 1a** | `sre-platform-dev-public-1a` | `10.0.0.0/24` (`1a`) | `map_public_ip_on_launch = true` (Dành cho ALB, NAT Gateway) |
| **Public Subnet 1b** | `sre-platform-dev-public-1b` | `10.0.1.0/24` (`1b`) | `map_public_ip_on_launch = true` (Dành cho ALB) |
| **Private App Subnet 1a** | `sre-platform-dev-private-app-1a` | `10.0.10.0/24` (`1a`) | EKS Control Plane ENIs, System Nodes, Karpenter Spot Nodes, Pods |
| **Private App Subnet 1b** | `sre-platform-dev-private-app-1b` | `10.0.11.0/24` (`1b`) | EKS Control Plane ENIs, System Nodes, Karpenter Spot Nodes, Pods |
| **Private DB Subnet 1a** | `sre-platform-dev-private-db-1a` | `10.0.20.0/24` (`1a`) | RDS PostgreSQL, ElastiCache Redis (Zero Internet route) |
| **Private DB Subnet 1b** | `sre-platform-dev-private-db-1b` | `10.0.21.0/24` (`1b`) | RDS Standby, ElastiCache Replica (Zero Internet route) |

---

## 3. Chiến lược Tagging & Labels (Bắt buộc)

### Tags chung trên VPC & toàn bộ Subnets:
- `Project = sre-platform` | `Environment = dev` | `ManagedBy = Console-to-IaC`

### Tags chuyên biệt theo Tầng Subnet (Auto-Discovery):

| Tầng Subnet | Tag Key | Tag Value | Mục đích |
| :--- | :--- | :--- | :--- |
| **Public (`1a`, `1b`)** | `kubernetes.io/role/elb` | `1` | AWS LBC tự phát hiện subnet đặt Internet-facing ALB |
| **Public & Private App** | `kubernetes.io/cluster/sre-platform-dev` | `shared` | Định danh subnet thuộc quyền sử dụng của EKS cluster |
| **Private App (`1a`, `1b`)** | `kubernetes.io/role/internal-elb` | `1` | AWS LBC tự phát hiện subnet đặt Internal ALB (nếu có) |
| **Private App (`1a`, `1b`)** | `karpenter.sh/discovery` | `sre-platform-dev` | Karpenter `EC2NodeClass` tự động chọn subnet launch Spot Node |
| **Private DB (`1a`, `1b`)** | `Component` | `database` | Định danh subnet tầng dữ liệu cô lập |

---

## 4. Tham chiếu IaC / GitOps
- [01-vpc.tf](../../iac/terraform/envs/dev/01-vpc.tf) — Khai báo đầy đủ VPC và 6 Subnets kèm tags.
- [ec2nodeclass.yaml](../../gitops/platform/karpenter/ec2nodeclass.yaml) — Tham chiếu `karpenter.sh/discovery: sre-platform-dev`.

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
```bash
aws ec2 describe-subnets --filters "Name=tag:Project,Values=sre-platform" --region ap-southeast-1 --query "Subnets[].{Name:Tags[?Key=='Name']|[0].Value,CIDR:CidrBlock,AZ:AvailabilityZone}"
```
- **PASS:** Đủ 6 subnets trên 2 AZ (`1a`, `1b`), VPC bật đủ 2 cờ DNS, các subnet gắn đúng tag discovery.
