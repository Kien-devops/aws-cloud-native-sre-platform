# 03.03 — Amazon RDS PostgreSQL (Private Data Tier)

> **Phạm vi:** Relational Database & Transactional Outbox | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Zero Public Exposure:** Đặt trong Private DB Subnets (`10.0.20.0/24`, `10.0.21.0/24`), `PubliclyAccessible = false`, chỉ cho phép port `5432` từ `sre-platform-dev-node-sg`.
- **Encrypted & Observable:** Mã hóa storage bằng `alias/sre-platform-dev-main` và kích hoạt Performance Insights (`7 days` free tier) để theo dõi query bottleneck.

---

## 2. Đặc tả Tài nguyên (Resource Inventory & Config)

| Resource Type | Tên Resource (Naming) | Tham số Cấu hình Cốt lõi |
| :--- | :--- | :--- |
| **DB Subnet Group** | `sre-platform-dev-rds-subnet-group` | Subnets: `private-db-1a`, `private-db-1b` |
| **RDS Instance** | `sre-platform-dev-pg` | Engine: `PostgreSQL 16.9`, Class: `db.t4g.micro`, Storage: `20 GB gp3` (Max Autoscale `50 GB`), DB Name: `reliability_shop`, `storage_encrypted = true` (KMS), `publicly_accessible = false`, Performance Insights: `Enabled` |
| **Endpoint (Private DNS)** | `sre-platform-dev-pg.*.ap-southeast-1.rds.amazonaws.com:5432` | Tự động phân giải thành Private IP trong VPC |

---

## 3. Chiến lược Tagging & Labels

| Tag Key | Tag Value | Mục đích |
| :--- | :--- | :--- |
| `Name` | `sre-platform-dev-pg` | Định danh DB instance |
| `Project` | `sre-platform` | Phân bổ chi phí DB |
| `Environment` | `dev` | Cô lập môi trường |
| `Component` | `database` | Nhóm dữ liệu lõi |

---

## 4. Tham chiếu IaC / GitOps
- [04-database.tf](../../iac/terraform/envs/dev/04-database.tf) — Khai báo `aws_db_subnet_group.main` và `aws_db_instance.postgres`.
- [kustomization.yaml](../../gitops/applications/reliability-shop/base/kustomization.yaml#L25-L28) — `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_SSL=true`.

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
```bash
aws rds describe-db-instances --db-instance-identifier sre-platform-dev-pg --region ap-southeast-1 --query "DBInstances[0].{Status:DBInstanceStatus,Public:PubliclyAccessible,Encrypted:StorageEncrypted,Engine:EngineVersion}"
```
- **PASS:** `DBInstanceStatus = available`, `PubliclyAccessible = false`, `StorageEncrypted = true`.
