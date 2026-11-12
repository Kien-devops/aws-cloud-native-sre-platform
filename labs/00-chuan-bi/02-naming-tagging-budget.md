# 00.02 — Naming Convention, Tagging Matrix & FinOps Budget

> **Phạm vi:** Governance & FinOps | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Consistent Naming:** Mọi tài nguyên hạ tầng dùng tiền tố `<project>-<env>-<resource>` (`sre-platform-dev-*`); tài nguyên ứng dụng dùng `reliability-shop-<env>-*`.
- **Automated Discovery via Tags:** Các controller Kubernetes (AWS Load Balancer Controller, Karpenter) dựa trực tiếp vào Subnet/Security Group tags để tự động phát hiện tài nguyên.
- **FinOps Cost Guardrail:** Thiết lập AWS Budget cảnh báo sớm trước khi chi phí vượt ngưỡng.

---

## 2. Đặc tả Tài nguyên (Resource Inventory & Config)

| Resource Type | Tên Resource (Naming) | Tham số Cấu hình Cốt lõi |
| :--- | :--- | :--- |
| **Platform Prefix** | `sre-platform-dev-*` | Áp dụng cho VPC, Subnets, KMS, EKS, RDS, Redis, IAM Roles |
| **Workload Prefix** | `reliability-shop-<env>-*` | Áp dụng cho SQS Queues, DLQ, Secrets, ECR Repos |
| **AWS Budget** | `sre-platform-dev-monthly-budget` | Monthly Limit: `$50.00 USD` |
| **Budget Alerts** | Email Notification | Trigger tại ngưỡng `50%` ($25), `80%` ($40), `100%` ($50) |

---

## 3. Chiến lược Tagging & Labels (Bắt buộc)

| Tag Key | Tag Value | Mục đích |
| :--- | :--- | :--- |
| `Name` | `<resource-standard-name>` | Hiển thị định danh rõ ràng trên AWS Console |
| `Project` | `sre-platform` | Gom nhóm toàn bộ tài nguyên nền tảng |
| `Environment` | `dev` \| `staging` \| `prod` | Cô lập môi trường |
| `ManagedBy` | `Console-to-IaC` \| `Terraform` \| `ArgoCD` | Truy vết công cụ quản lý (Source of Truth) |
| `Component` | `network` \| `compute` \| `database` \| `messaging` | Phân tích chi phí theo tầng kiến trúc |

---

## 4. Tham chiếu IaC / GitOps
- [01-vpc.tf](../../iac/terraform/envs/dev/01-vpc.tf) — Áp dụng bộ tags chuẩn trên VPC, Subnets, Route Tables, Security Groups.
- [variables.tf](../../iac/terraform/envs/dev/variables.tf) — Biến `project_name`, `environment`.

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
```bash
aws budgets describe-budgets --account-id <ACCOUNT_ID> --query "Budgets[].{Name:BudgetName,Limit:BudgetLimit.Amount}"
```
- **PASS:** Tồn tại budget `sre-platform-dev-monthly-budget` với giới hạn `$50.00` và 100% tài nguyên tạo ra mang đủ `Project` + `Environment` tags.
