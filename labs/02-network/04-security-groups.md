# 02.04 — Security Groups Matrix (Chaining SG-to-SG)

> **Phạm vi:** Stateful Firewall & Zero-Trust Network | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **SG-to-SG Referencing:** Không mở port DB/Redis theo CIDR `10.0.0.0/16` rộng; chỉ cho phép inbound từ chính Security Group ID của EKS Worker Nodes (`node-sg`).
- **Karpenter Auto-Discovery Tag:** Gắn tag `karpenter.sh/discovery` lên `node-sg` để mọi Spot Node mới sinh ra tự động thừa hưởng đúng rule kết nối tới RDS và ElastiCache.

---

## 2. Đặc tả Tài nguyên & Ma trận Rules

| Tên Security Group | Inbound Rules (Allowed Sources) | Outbound Rules |
| :--- | :--- | :--- |
| `sre-platform-dev-alb-sg` | `TCP 80`, `TCP 443` từ `0.0.0.0/0` | `All Traffic` tới `node-sg` (hoặc `0.0.0.0/0` cho target ports) |
| `sre-platform-dev-node-sg` | `All Traffic` từ chính `node-sg` (Pod-to-Pod); `TCP 8080/3000-9000` từ `alb-sg`; `TCP 443` từ EKS Control Plane SG | `All Traffic` (`0.0.0.0/0`) |
| `sre-platform-dev-db-sg` | `TCP 5432` (PostgreSQL) từ `node-sg`; `TCP 6379` (Redis TLS) từ `node-sg` | `None` (hoặc hạn chế nội bộ VPC) |
| `sre-platform-dev-vpce-sg` | `TCP 443` từ `10.0.0.0/16` (nếu dùng Interface Endpoint) | `All` |

---

## 3. Chiến lược Tagging & Labels (Bắt buộc)

| Security Group | Tag Key | Tag Value | Mục đích |
| :--- | :--- | :--- | :--- |
| **Toàn bộ SGs** | `Project` / `Environment` | `sre-platform` / `dev` | Quản lý vòng đời & cleanup |
| **`sre-platform-dev-node-sg`** | `karpenter.sh/discovery` | `sre-platform-dev` | Karpenter tự động gắn SG này cho Spot EC2 nodes |
| **`sre-platform-dev-node-sg`** | `kubernetes.io/cluster/sre-platform-dev` | `owned` | Cho phép AWS CCM / LBC quản lý target group binding |

---

## 4. Tham chiếu IaC / GitOps
- [ec2nodeclass.yaml](../../gitops/platform/karpenter/ec2nodeclass.yaml) — `securityGroupSelectorTerms` lọc theo `karpenter.sh/discovery: sre-platform-dev`.
- [04-database.tf](../../iac/terraform/envs/dev/04-database.tf) — Gắn `db-sg` cho RDS & ElastiCache.

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
```bash
aws ec2 describe-security-groups --filters "Name=tag:Project,Values=sre-platform" --region ap-southeast-1 --query "SecurityGroups[].{Name:GroupName,Id:GroupId}"
```
- **PASS:** `db-sg` không mở bất kỳ port nào ra `0.0.0.0/0`, `node-sg` có tag `karpenter.sh/discovery = sre-platform-dev`.
