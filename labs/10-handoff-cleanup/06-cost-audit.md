# 10.06 — FinOps Orphan Resource & $0.00 Cost Audit

> **Phạm vi:** Post-Cleanup Cost Verification | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Zero Orphan Billing Leaks:** Các tài nguyên dễ gây rò rỉ chi phí ngầm sau khi xóa cluster gồm **Unattached Elastic IPs** (`$0.005/giờ`), **Available EBS Volumes (PVC)** (`$0.08/GB-tháng`), **Lingering ALBs** (`$0.025/giờ`) và **NAT Gateways** (`$0.045/giờ`). Phải xác minh tất cả bằng `0`.

---

## 2. Bảng Kiểm tra Tài nguyên Mồ côi (`ap-southeast-1`)

| Tài nguyên Có phí | Lệnh Kiểm tra | Kết quả Yêu cầu |
| :--- | :--- | :--- |
| **EC2 Instances** | `aws ec2 describe-instances --filters "Name=instance-state-name,Values=running,pending"` | `0` instances |
| **NAT Gateways** | `aws ec2 describe-nat-gateways --filter "Name=state,Values=available"` | `0` NAT Gateways |
| **Elastic IPs** | `aws ec2 describe-addresses` | `0` unassociated EIPs |
| **EBS Volumes** | `aws ec2 describe-volumes --filters "Name=status,Values=available"` | `0` orphan volumes |
| **Load Balancers (ALB)** | `aws elbv2 describe-load-balancers` | `0` ALBs |
| **EKS / RDS / ElastiCache** | `aws eks list-clusters`, `describe-db-instances`, `describe-replication-groups` | `0` active resources |

---

## 3. Chiến lược Tagging & Labels
- Kiểm tra thêm bằng AWS Billing / Cost Explorer sau 24h để xác nhận Daily Spend về `$0.00`.

---

## 4. Tham chiếu IaC / GitOps
- [10.05 Reverse Cleanup Order](05-cleanup-order.md)

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
- **PASS:** Toàn bộ 6 danh mục trên trả về rỗng (`0` tài nguyên tính phí đang chạy), đạt tiêu chuẩn FinOps **$0.00/ngày**.
