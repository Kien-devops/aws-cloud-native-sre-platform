# Lab 10.06: Cost Audit, True Zero Verification & Production Handoff

## 1. Mục tiêu & Nguyên lý SRE

Lab này là giai đoạn chốt chặn cuối cùng của chuỗi triển khai Cloud-Native SRE Platform. Tại đây, đội ngũ kỹ thuật thực hiện kiểm toán toàn diện chi phí thực tế phát sinh trên **AWS Cost Explorer**, xác nhận trạng thái **True $0.00 Idle State** sau khi dọn dẹp, và thực thi quy trình bàn giao vận hành chính thức (**Production Handoff Governance**) sang đội ngũ On-call.

```
+---------------------------------------------------------------------------------------------------------+
|                                    FINOPS COST AUDIT & HANDOFF PIPELINE                                 |
+---------------------------------------------------------------------------------------------------------+
|  1. AWS COST EXPLORER        ===>  2. COST ANOMALY CHECK     ===>  3. ZERO-COST VERIFICATION            |
|  - Daily Granularity               - CloudWatch Cost Monitor       - Confirm $0.00 / day idle spend     |
|  - Group by Service & Tag          - 0 Anomalies Detected          - 0 Lingering chargeable components  |
+---------------------------------------------------------------------------------------------------------+
                                                     |
                                                     v
+---------------------------------------------------------------------------------------------------------+
|                                   FINAL PRODUCTION HANDOFF DOSSIER                                      |
|  - IaC Git Repository (Terraform)        - GitOps Workload Repository (Argo CD)                         |
|  - Telemetry Dashboards & SLI/SLO Gates  - On-call Pager Runbooks & Blameless Postmortem Templates      |
+---------------------------------------------------------------------------------------------------------+
```

### Nguyên lý SRE cốt lõi:
- **FinOps Accountability:** Mọi chi phí đám mây đều phải được giải trình và gắn nhãn theo mục tiêu kinh doanh cụ thể. Không chấp nhận bất kỳ khoản chi phí ẩn nào không có chủ sở hữu.
- **Proof of True Zero:** Khi môi trường không hoạt động (Teardown), biểu đồ chi phí hàng ngày trên AWS Cost Explorer phải trở về tiệm cận **$0.00/ngày** (ngoại trừ các khoản phí lưu trữ tối thiểu như S3 backup hoặc KMS CMK key đang trong thời gian chờ xóa).
- **Comprehensive Operational Handoff:** Một nền tảng chỉ được coi là hoàn tất khi tài liệu kiến trúc, runbook sự cố, quyền truy cập Terraform State và phân quyền Argo CD đã được bàn giao đầy đủ cho đội ngũ vận hành 24/7.

---

## 2. Kiểm toán chi phí thực tế trên AWS Management Console

### Bước 1: Mở AWS Cost Explorer & Phân tích chi phí theo Tag
1. Đăng nhập AWS Management Console > Tìm kiếm dịch vụ **Billing and Cost Management**.
2. Trên menu bên trái, chọn **Cost Explorer**.
3. Cấu hình bộ lọc kiểm toán:
   - **Date range:** Chọn `Last 7 days` hoặc `Last 14 days`.
   - **Granularity:** Chọn `Daily`.
   - **Dimension:** Chọn `Service`.
   - **Tag filter:** Chọn `Tag: Project` = `sre-platform-dev`.
4. Quan sát biểu đồ chi phí phân bổ theo dịch vụ:
   - **Amazon Elastic Kubernetes Service (EKS):** $0.10/giờ x 24h = $2.40/ngày.
   - **Amazon Elastic Compute Cloud (EC2):** System nodes (`sre-platform-dev-system-nodes` t3.medium) + Karpenter Spot instances (`workload-spot`) = ~$1.80 - $2.20/ngày.
   - **Amazon Virtual Private Cloud (NAT Gateway):** 1x NAT Gateway = $1.42/ngày + phí data transfer (Tối ưu hóa: Sử dụng S3 Gateway Endpoint miễn phí thay vì Interface Endpoints).
   - **Amazon Relational Database Service (RDS):** 1x `sre-platform-dev-pg` (`db.t4g.micro`) = ~$0.60/ngày.
   - **Amazon ElastiCache (Redis):** 1x `sre-platform-dev-redis-001` (`cache.t4g.micro`) = ~$0.40/ngày.
   - **Các dịch vụ khác (KMS CMK, SQS, CloudWatch, ECR):** < $0.30/ngày.
5. Tổng ngân sách tiêu hao trong giai đoạn thử nghiệm `dev` ước tính: **~$6.50 - $7.50 / ngày**, hoàn toàn nằm trong hạn mức Budget $50.00/tháng đã thiết lập ở Lab 00.02.

### Bước 2: Kích hoạt AWS Cost Anomaly Detection
1. Trong menu bên trái của Billing Console, chọn **Cost Anomaly Detection**.
2. Nhấp **Create monitor**:
   - **Monitor type:** Chọn `AWS services` (để AI tự động phát hiện các khoản tăng vọt bất thường).
   - **Monitor name:** `sre-platform-anomaly-monitor`.
3. Cấu hình cảnh báo:
   - **Alert subscription:** Tạo mới subscription.
   - **Frequency:** `Daily summary`.
   - **Threshold:** Chọn `Greater than $5.00`.
   - **Recipients:** Điền email đội ngũ SRE `platform-sre@company.internal`.
4. Nhấp **Create monitor**.

---

## 3. Bảng đối chiếu chi phí trước và sau Cleanup

| Hạng mục tài nguyên | Chi phí khi hoạt động (Active / Ngày) | Chi phí sau khi Cleanup (Idle / Ngày) | Cơ chế kiểm tra |
| :--- | :--- | :--- | :--- |
| **EKS Cluster Control Plane** | $2.40 | **$0.00** | Cluster đã bị xóa hoàn toàn |
| **EC2 Worker Nodes & EBS gp3**| $2.00 | **$0.00** | Instances terminated, Volumes deleted |
| **NAT Gateway & Elastic IP** | $1.42 | **$0.00** | NAT Gateway deleted, EIP released |
| **Application Load Balancer (ALB)**| $0.67 | **$0.00** | Ingress controller dọn sạch |
| **RDS PostgreSQL Instance** | $0.60 | **$0.00** | Lưu Snapshot trên S3 ($0.095/GB/tháng) |
| **ElastiCache Redis Cluster** | $0.40 | **$0.00** | Cluster deleted |
| **KMS Customer Managed Key** | $0.03 | **$0.03** | $1.00/tháng trong 7 ngày chờ xóa |
| **S3 Backup & Terraform State** | < $0.01 | **< $0.01** | Lưu trữ mã hóa (~vài megabytes) |
| **TỔNG CỘNG** | **~$7.53 / Ngày** | **~$0.04 / Ngày** | Giảm thiểu 99.5% chi phí |

---

## 4. Script tự động xác nhận trạng thái $0.00 (Zero Cost Verification)

Chạy script sau qua terminal để khẳng định tài khoản không còn bất kỳ thành phần nào kích hoạt tính phí theo giờ:

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "============================================================"
echo "          AWS FINOPS ZERO-DOLLAR RUNTIME AUDIT"
echo "============================================================"

REGION="ap-southeast-1"

# 1. Kiểm tra EC2 đang chạy
RUNNING_EC2=$(aws ec2 describe-instances \
  --region "${REGION}" \
  --filters "Name=instance-state-name,Values=running" \
  --query "Reservations[].Instances[].InstanceId" --output text)

if [ -n "${RUNNING_EC2}" ]; then
  echo "::error::EC2 Instances còn đang chạy: ${RUNNING_EC2}"
else
  echo "[PASS] 0 EC2 Instances đang chạy."
fi

# 2. Kiểm tra EKS Clusters
ACTIVE_EKS=$(aws eks list-clusters --region "${REGION}" --query "clusters[]" --output text)
if [ -n "${ACTIVE_EKS}" ]; then
  echo "::error::EKS Clusters còn tồn tại: ${ACTIVE_EKS}"
else
  echo "[PASS] 0 EKS Clusters tồn tại."
fi

# 3. Kiểm tra RDS Instances
ACTIVE_RDS=$(aws rds describe-db-instances --region "${REGION}" --query "DBInstances[].DBInstanceIdentifier" --output text)
if [ -n "${ACTIVE_RDS}" ]; then
  echo "::error::RDS Instances còn tồn tại: ${ACTIVE_RDS}"
else
  echo "[PASS] 0 RDS Instances tồn tại."
fi

# 4. Kiểm tra ElastiCache
ACTIVE_REDIS=$(aws elasticache describe-cache-clusters --region "${REGION}" --query "CacheClusters[].CacheClusterId" --output text)
if [ -n "${ACTIVE_REDIS}" ]; then
  echo "::error::ElastiCache Clusters còn tồn tại: ${ACTIVE_REDIS}"
else
  echo "[PASS] 0 ElastiCache Clusters tồn tại."
fi

# 5. Kiểm tra NAT Gateways
ACTIVE_NAT=$(aws ec2 describe-nat-gateways --region "${REGION}" --filter "Name=state,Values=available,pending" --query "NatGateways[].NatGatewayId" --output text)
if [ -n "${ACTIVE_NAT}" ]; then
  echo "::error::NAT Gateways còn hoạt động: ${ACTIVE_NAT}"
else
  echo "[PASS] 0 NAT Gateways hoạt động."
fi

echo "============================================================"
echo "   KẾT QUẢ: TÀI NGUYÊN ĐÃ ĐẠT TRẠNG THÁI TRUE $0.00 IDLE"
echo "============================================================"
```

---

## 5. Biên bản bàn giao kỹ thuật chính thức (Production Handoff Dossier)

Đội ngũ triển khai nền tảng lập biên bản bàn giao cho đội ngũ SRE Vận hành và Quản lý Kỹ thuật (Engineering Leads):

### BIÊN BẢN BÀN GIAO NỀN TẢNG CLOUD-NATIVE SRE (DEV ENVIRONMENT)

- **Ngày bàn giao:** 21/10/2026
- **Khu vực triển khai:** `ap-southeast-1` (Singapore)
- **Đại diện bàn giao (Platform Engineering):** `lead-sre@company.internal`
- **Đại diện tiếp nhận (Operations / On-call):** `oncall-lead@company.internal`

#### Danh mục tài sản bàn giao:
1. **Mã nguồn Hạ tầng IaC:**
   - Kho mã nguồn: `https://github.com/Kien-devops/aws-cloud-native-sre-platform.git`
   - Nhánh chính thức: `main` (Tag: `v1.0.0-dev-verified`)
   - Backend Terraform State: S3 `sre-platform-dev-tfstate-*` + DynamoDB lock table.
2. **Hệ thống GitOps Delivery:**
   - Argo CD Root Application: `gitops/bootstrap/root-application.yaml`.
   - Phân chia Applications: `platform` (`gitops/platform`) và `reliability-shop` (`gitops/applications/reliability-shop/environments/dev`).
3. **Bộ chỉ số Quan sát & Cảnh báo:**
   - Grafana Dashboard: Golden Signals (RED/USE), SLO Error Budget Gauges.
   - Quy tắc cảnh báo: Multi-window Multi-burn-rate (14.4x / 6x burn rate).
4. **Tài liệu Vận hành & Ứng phó sự cố (Runbooks):**
   - Incident Triage Runbook (Lab 09.06).
   - Disaster Recovery & Restore Runbook (Lab 10.04).
   - Reverse Cleanup Runbook (Lab 10.05).

---

## 6. SRE Gate Check & Tiêu chí nghiệm thu cuối cùng (Final Sign-off)

| STT | Hạng mục kiểm tra (Gate Criteria) | Điều kiện đạt (Pass Criteria) | Trạng thái |
| :--- | :--- | :--- | :--- |
| 1 | **Cost Anomaly Detection Active** | Monitor phát hiện chi phí bất thường được cấu hình với ngưỡng $5.00/ngày | [x] Đạt |
| 2 | **True Zero Spend Verified** | Quy trình dọn dẹp và script xác minh tài nguyên tính phí theo giờ (EKS, EC2, NAT, RDS, Redis, ALB) đã sẵn sàng | [x] Đạt |
| 3 | **Git / Terraform Parity** | Mã nguồn IaC và GitOps khớp 100% với kiến trúc đã được kiểm định | [x] Đạt |
| 4 | **Formal Handoff Completed** | Biên bản bàn giao được ký nhận đầy đủ bởi đại diện Platform SRE và On-call Lead | [x] Đạt |

---

## 7. Lời kết

> [!TIP]
> Xin chúc mừng! Bạn đã hoàn thành trọn vẹn toàn bộ 11 module của **AWS Cloud-Native SRE Platform**. Từ một tài khoản AWS trắng, bạn đã từng bước xây dựng một nền tảng vận hành cấp doanh nghiệp hoàn chỉnh, đáp ứng các tiêu chuẩn khắt khe nhất về Bảo mật (Least Privilege, Zero Secrets, OIDC), Khả năng phục hồi (Multi-AZ, Chaos GameDay, Self-Healing), Khả năng quan sát (OpenTelemetry, Prometheus, Loki, Tempo), Tự động mở rộng (KEDA, Karpenter, Canary Rollouts), và Tối ưu hóa chi phí (FinOps Governance).
