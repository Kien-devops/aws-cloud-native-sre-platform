# 02.05 — VPC Flow Logs (Network Observability)

> **Phạm vi:** Network Forensics & Traffic Audit | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Traffic Visibility:** Ghi lại metadata lưu lượng mạng đi qua ENIs trong VPC (Source/Dest IP, Port, Action `ACCEPT`/`REJECT`) phục vụ debug kết nối bị chặn bởi Security Group/NACL.
- **Cost-Controlled Retention:** Lưu về CloudWatch Log Group với thời gian giữ log `7 days` cho môi trường `dev`.

---

## 2. Đặc tả Tài nguyên (Resource Inventory & Config)

| Resource Type | Tên Resource (Naming) | Tham số Cấu hình Cốt lõi |
| :--- | :--- | :--- |
| **CloudWatch Log Group** | `/aws/vpc/sre-platform-dev-flow-logs` | Retention: `7 days`, KMS: `alias/sre-platform-dev-main` |
| **IAM Role (Flow Logs)** | `sre-platform-dev-vpc-flow-logs-role` | Trust: `vpc-flow-logs.amazonaws.com`; Quyền: `logs:CreateLogStream`, `logs:PutLogEvents` |
| **VPC Flow Log** | `sre-platform-dev-flow-log` | Resource: `sre-platform-dev-vpc`, Filter: `ALL` (hoặc `REJECT` để tiết kiệm), Aggregation: `1 minute` |

---

## 3. Chiến lược Tagging & Labels

| Tag Key | Tag Value | Mục đích |
| :--- | :--- | :--- |
| `Name` | `sre-platform-dev-flow-log` | Định danh Flow Log |
| `Project` | `sre-platform` | Phân bổ chi phí Log Ingestion |
| `Environment` | `dev` | Cô lập môi trường |

---

## 4. Tham chiếu IaC / GitOps
- Gắn trực tiếp vào VPC `sre-platform-dev-vpc` trong [01-vpc.tf](../../iac/terraform/envs/dev/01-vpc.tf).

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
```bash
aws ec2 describe-flow-logs --region ap-southeast-1 --query "FlowLogs[].{Id:FlowLogId,Status:FlowLogStatus,Traffic:TrafficType}"
```
- **PASS:** `FlowLogStatus = ACTIVE` và log stream xuất hiện trong `/aws/vpc/sre-platform-dev-flow-logs`.
