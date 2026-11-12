# 07.06 — AWS CloudWatch Foundation Dashboard & SQS DLQ Alarms

> **Phạm vi:** AWS Managed Infrastructure Telemetry | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Infrastructure Layer Telemetry:** Giám sát trực tiếp tài nguyên AWS Managed (RDS CPU/Connections, ElastiCache Memory/Hits, SQS Queue Depth & Age of Oldest Message) trên CloudWatch.
- **Zero Unnoticed Poison Pills:** Cài CloudWatch Alarm báo động ngay khi DLQ có `>= 1` message (`ApproximateNumberOfMessagesVisible > 0`).

---

## 2. Đặc tả Tài nguyên CloudWatch

| Resource Type | Tên Resource (Naming) | Tham số Cấu hình Cốt lõi |
| :--- | :--- | :--- |
| **CloudWatch Dashboard** | `sre-platform-dev-foundation` | Widgets: RDS (`CPUUtilization`, `DatabaseConnections`), Redis (`CurrConnections`, `CacheHits/Misses`), SQS (`dev/staging/prod` queues & DLQs) |
| **CloudWatch Alarm** | `reliability-shop-dev-dlq-not-empty` | Metric: `AWS/SQS ApproximateNumberOfMessagesVisible`, Threshold: `>= 1` trong `1 period (60s)` |
| **CloudWatch Alarm** | `sre-platform-dev-rds-high-cpu` | Metric: `AWS/RDS CPUUtilization`, Threshold: `> 80%` trong `5 minutes` |

---

## 3. Chiến lược Tagging & Labels

| Tag Key | Tag Value | Mục đích |
| :--- | :--- | :--- |
| `Project` | `sre-platform` | Phân loại dashboard & alarm |
| `Environment` | `dev` \| `prod` | Định danh mức độ ưu tiên cảnh báo |

---

## 4. Tham chiếu IaC / GitOps
- Bằng chứng thực tế: [aws-cloudwatch-foundation-telemetry.png](../../docs/images/evidence/aws-cloudwatch-foundation-telemetry.png)

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
```bash
aws cloudwatch describe-alarms --alarm-name-prefix reliability-shop --region ap-southeast-1 --query "MetricAlarms[].{Name:AlarmName,State:StateValue}"
```
- **PASS:** Dashboard `sre-platform-dev-foundation` hiển thị đầy đủ metrics của cả 3 môi trường SQS, RDS và Redis; Alarms ở trạng thái `OK` (hoặc `ALARM` đúng khi test poison pill).
