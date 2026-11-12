# 05.01 — AWS Secrets Manager

> **Phạm vi:** Centralized Secret Storage & KMS Encryption | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Zero Plaintext in Git:** Toàn bộ credentials (RDS, Redis Auth, JWT Secret, Grafana Admin) lưu tập trung trên AWS Secrets Manager, mã hóa bởi `alias/sre-platform-dev-main`.
- **Path-Based Namespace Isolation:** Đặt tên theo phân cấp `/<project>/<env>/<service>/<secret-name>` để IAM Policy dễ dàng giới hạn quyền truy cập theo prefix.

---

## 2. Đặc tả Tài nguyên (Resource Inventory & Config)

| Secret Name (Path) | Keys Bên Trong | KMS Encryption |
| :--- | :--- | :--- |
| `/sre-platform/dev/reliability-shop/credentials` | `DB_USER`, `DB_PASSWORD`, `REDIS_AUTH`, `JWT_SECRET` | `alias/sre-platform-dev-main` |
| `/sre-platform/staging/reliability-shop/credentials` | `DB_USER`, `DB_PASSWORD`, `REDIS_AUTH`, `JWT_SECRET` | `alias/sre-platform-dev-main` |
| `/sre-platform/prod/reliability-shop/credentials` | `DB_USER`, `DB_PASSWORD`, `REDIS_AUTH`, `JWT_SECRET` | `alias/sre-platform-dev-main` |
| `/sre-platform/dev/grafana/admin` | `admin-user`, `admin-password` | `alias/sre-platform-dev-main` |

---

## 3. Chiến lược Tagging & Labels

| Tag Key | Tag Value | Mục đích |
| :--- | :--- | :--- |
| `Project` | `sre-platform` | Phân bổ chi phí Secrets Manager ($0.40/secret/tháng) |
| `Environment` | `dev` \| `staging` \| `prod` | Phạm vi IAM Policy (`Resource: arn:aws:secretsmanager:*:*:secret:/sre-platform/dev/*`) |

---

## 4. Tham chiếu IaC / GitOps
- [external-secret.yaml](../../gitops/applications/reliability-shop/base/external-secret.yaml)
- [01-grafana-secret.yaml](../../gitops/platform/monitoring/01-grafana-secret.yaml)

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
```bash
aws secretsmanager list-secrets --filters Key=name,Values=/sre-platform/ --region ap-southeast-1 --query "SecretList[].{Name:Name,KmsKeyId:KmsKeyId}"
```
- **PASS:** Tồn tại đủ 4 secrets ở trên, đều gắn `KmsKeyId` trỏ về CMK, **tuyệt đối không chạy `get-secret-value`** in ra log công khai.
