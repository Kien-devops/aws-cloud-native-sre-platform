# Module 01 — IAM, OIDC Federation & Security Foundation

> **Phạm vi:** Identity, Encryption & Threat Detection | **Region:** `ap-southeast-1`

Module 01 đặc tả lớp bảo mật gốc: xác thực CI/CD không dùng static key (GitHub Actions OIDC), mã hóa tập trung bằng KMS Customer Managed Key (CMK), và giám sát audit/mối đe dọa bằng CloudTrail & GuardDuty.

---

## Danh sách Đặc tả

| Mã | Tài liệu | Nội dung Chính |
| :--- | :--- | :--- |
| `01.01` | [GitHub OIDC & IAM Roles](01-github-oidc-roles.md) | OIDC Provider `token.actions.githubusercontent.com`, CI/CD Deployer Role |
| `01.02` | [AWS KMS Customer Managed Key](02-kms-key.md) | `alias/sre-platform-dev-main`, Auto-rotation, Key Policy |
| `01.03` | [CloudTrail & GuardDuty](03-cloudtrail-guardduty.md) | Multi-region Audit Trail, S3 Log Bucket, GuardDuty Threat Detection |
| `01.04` | [Secrets Redaction & Pre-commit](04-secrets-redaction.md) | Quy trình quét secret tự động (Pre-commit / Gitleaks / Trivy) |
