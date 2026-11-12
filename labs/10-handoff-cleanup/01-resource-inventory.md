# 10.01 — Master Resource Inventory

> **Phạm vi:** Full Platform Asset Catalog | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Zero Shadow Resources:** Mọi tài nguyên tạo ra trên AWS đều phải được liệt kê, gắn tag `Project=sre-platform` và nằm dưới sự quản lý của Terraform hoặc Argo CD.

---

## 2. Danh mục Tài nguyên Chính (`sre-platform-dev-*`)

| Tầng | Resource Type | Tên Resource Chuẩn | Số lượng |
| :--- | :--- | :--- | :--- |
| **Network** | VPC / IGW / NAT / EIP | `sre-platform-dev-vpc`, `igw`, `nat-1a`, `nat-eip-1a` | `1` mỗi loại |
| **Subnets** | Public / Private App / Private DB | `sre-platform-dev-{public,private-app,private-db}-{1a,1b}` | `6` |
| **Endpoints** | S3 Gateway Endpoint | `sre-platform-dev-vpce-s3` | `1` |
| **Security** | Security Groups | `alb-sg`, `node-sg`, `db-sg`, `vpce-sg` | `4` |
| **Security** | KMS CMK & Alias | `alias/sre-platform-dev-main` | `1` |
| **Compute** | EKS Cluster & System Node Group | `sre-platform-dev`, `sre-platform-dev-system-nodes` | `1` + `1` |
| **Data** | RDS PostgreSQL 16.9 | `sre-platform-dev-pg` | `1` |
| **Cache** | ElastiCache Redis 7.1 | `sre-platform-dev-redis` | `1` |
| **Messaging** | SQS Queues & DLQs | `reliability-shop-{dev,staging,prod}-order-{queue,dlq}` | `6` |
| **Registry** | ECR Repositories | `reliabilityshop/{frontend,auth,order,inventory,payment}` | `5` |
| **Secrets** | AWS Secrets Manager | `/sre-platform/{dev,staging,prod}/reliability-shop/credentials`, `/sre-platform/dev/grafana/admin` | `4` |
| **Ingress** | Shared ALB | `k8s-sreplatform-*` (5 Target Groups) | `1` |

---

## 3. Chiến lược Tagging & Labels
- Toàn bộ tài nguyên trên đều mang `Project = sre-platform` và `Environment = dev` (hoặc `staging`/`prod`/`shared`).

---

## 4. Tham chiếu IaC / GitOps
- [iac/terraform/envs/dev/](../../iac/terraform/envs/dev/)
- [gitops/](../../gitops/README.md)

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
```bash
aws resourcegroupstaggingapi get-resources --tag-filters Key=Project,Values=sre-platform --region ap-southeast-1 --query "ResourceTagMappingList[].ResourceARN"
```
- **PASS:** 100% tài nguyên phát sinh khớp với bảng Inventory, không có tài nguyên lạ không gắn tag.
