# 01.01 — GitHub Actions OIDC Federation & IAM Roles

> **Phạm vi:** CI/CD Identity & Zero Static Secrets | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Zero Static Credentials:** Loại bỏ hoàn toàn `AWS_ACCESS_KEY_ID` trên GitHub Secrets; dùng OpenID Connect (OIDC) cấp token ngắn hạn (short-lived STS token).
- **Repository-Scoped Trust Policy:** Chỉ cho phép repository `Kien-devops/app3` (các nhánh `dev`, `staging`, `main`) được `sts:AssumeRoleWithWebIdentity`.
- **Least Privilege:** Role chỉ có quyền đẩy container image lên Amazon ECR (`reliabilityshop/*`), không cấp `AdministratorAccess`.

---

## 2. Đặc tả Tài nguyên (Resource Inventory & Config)

| Resource Type | Tên Resource / ARN | Tham số Cấu hình Cốt lõi |
| :--- | :--- | :--- |
| **IAM OIDC Provider** | `https://token.actions.githubusercontent.com` | Audience: `sts.amazonaws.com` |
| **IAM Role (CI/CD)** | `github-actions-sre-platform-deployer` | Trust `repo:Kien-devops/app3:*`; Max session: `1 hour` |
| **IAM Policy (CI/CD)** | `sre-platform-ecr-push-policy` | `ecr:GetAuthorizationToken`, `ecr:BatchCheckLayerAvailability`, `ecr:PutImage`, `ecr:InitiateLayerUpload`, `ecr:UploadLayerPart`, `ecr:CompleteLayerUpload` (Scope: `arn:aws:ecr:ap-southeast-1:*:repository/reliabilityshop/*`) |

---

## 3. Chiến lược Tagging & Labels

| Tag Key | Tag Value | Mục đích |
| :--- | :--- | :--- |
| `Name` | `github-actions-sre-platform-deployer` | Định danh Role CI/CD |
| `Project` | `sre-platform` | Phân loại dự án |
| `Environment` | `shared` | Dùng chung cho pipeline multi-env (`dev`, `staging`, `prod`) |
| `ManagedBy` | `IAM-OIDC` | Truy vết phương thức cấp quyền |

---

## 4. Tham chiếu IaC / GitOps
- Workflow sử dụng Role trong monorepo ứng dụng: `app3/.github/workflows/build-push.yml`.
- Hướng dẫn pipeline liên quan: [08.01 CI Build & ECR](../08-delivery-scaling/01-ci-build-scan-ecr.md).

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
```bash
aws iam get-role --role-name github-actions-sre-platform-deployer --query "Role.{Name:RoleName,AssumeRolePolicy:AssumeRolePolicyDocument}"
```
- **PASS:** OIDC Provider tồn tại, Trust Policy giới hạn đúng GitHub org/repo `Kien-devops/app3`, không tồn tại Access Key tĩnh gắn với CI user.
