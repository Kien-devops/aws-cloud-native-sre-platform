# 04.04 — EKS Pod Identity Associations

> **Phạm vi:** Workload-Level IAM Least Privilege | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Pod Identity over IRSA:** Sử dụng EKS Pod Identity thay thế IRSA truyền thống — không cần tạo OIDC thumbprint hay gán annotation `eks.amazonaws.com/role-arn` phức tạp, dễ tái sử dụng IAM Role across clusters.
- **Granular Least Privilege:** Mỗi ServiceAccount chỉ nhận đúng quyền AWS API cần thiết.

---

## 2. Đặc tả Pod Identity Associations (7 Associations)

| Namespace | ServiceAccount | IAM Role | Quyền AWS Được Cấp (Least Privilege) |
| :--- | :--- | :--- | :--- |
| `kube-system` | `aws-load-balancer-controller` | `sre-platform-dev-lbc-role` | Quản lý EC2 ALB, Target Groups, Security Groups, ACM |
| `kube-system` | `ebs-csi-controller-sa` | `sre-platform-dev-ebs-csi-role` | `ec2:CreateVolume`, `AttachVolume`, KMS Grant cho `gp3` |
| `external-secrets` | `external-secrets` | `sre-platform-dev-eso-role` | `secretsmanager:GetSecretValue`, `kms:Decrypt` (Prefix: `/sre-platform/*`) |
| `karpenter` | `karpenter` | `KarpenterControllerRole-sre-platform-dev` | `ec2:RunInstances`, `TerminateInstances`, `iam:PassRole` |
| `reliability-shop` | `reliability-shop-sa` | `sre-platform-dev-app-sqs-role` | `sqs:SendMessage`, `ReceiveMessage`, `DeleteMessage` (Dev Queue) |
| `reliability-shop-staging` | `reliability-shop-sa` | `sre-platform-staging-app-sqs-role` | Quyền SQS cô lập riêng cho Staging Queue |
| `reliability-shop-prod` | `reliability-shop-sa` | `sre-platform-prod-app-sqs-role` | Quyền SQS cô lập riêng cho Prod Queue |

---

## 3. Chiến lược Tagging & Labels

| Tag Key | Tag Value | Mục đích |
| :--- | :--- | :--- |
| `Project` | `sre-platform` | Quản lý IAM Roles & Associations |
| `Environment` | `dev` \| `staging` \| `prod` | Cô lập quyền theo namespace |

---

## 4. Tham chiếu IaC / GitOps
- [service-account.yaml](../../gitops/applications/reliability-shop/base/service-account.yaml) — Khai báo `reliability-shop-sa`.
- [cluster-secret-store.yaml](../../gitops/platform/external-secrets/cluster-secret-store.yaml) — Xác thực AWS qua Pod Identity.

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
```bash
aws eks list-pod-identity-associations --cluster-name sre-platform-dev --region ap-southeast-1
```
- **PASS:** Đủ 7 Pod Identity Associations hợp lệ, ứng dụng `order-service` và `payment-worker` gửi/nhận SQS không cần static credentials.
