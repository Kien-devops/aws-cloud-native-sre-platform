# 02.03 — VPC Gateway Endpoint (S3 Zero-Cost Data Transfer)

> **Phạm vi:** Private AWS Service Traffic & FinOps | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Zero NAT Data Processing Fee:** Lưu lượng kéo Docker image layers (ECR lưu layer trên S3), đẩy log CloudTrail hoặc đọc S3 bucket đi qua S3 Gateway Endpoint hoàn toàn **miễn phí** (`$0.00/giờ`, `$0.00/GB`), tránh tốn `$0.045/GB` qua NAT Gateway.
- **No Unnecessary Interface Endpoints:** Không tạo thêm Interface VPC Endpoints (`ecr.api`, `ecr.dkr`, `sts`, `logs`) ở môi trường dev nhằm giữ chi phí cố định ở mức tối thiểu.

---

## 2. Đặc tả Tài nguyên (Resource Inventory & Config)

| Resource Type | Tên Resource (Naming) | Tham số Cấu hình Cốt lõi |
| :--- | :--- | :--- |
| **VPC Gateway Endpoint** | `sre-platform-dev-vpce-s3` | Service: `com.amazonaws.ap-southeast-1.s3`, Type: `Gateway` |
| **Route Table Associations** | 3 Route Tables | Gắn vào `rt-public`, `rt-private-app`, `rt-private-db` (tự động chèn prefix list `pl-*` của S3) |

---

## 3. Chiến lược Tagging & Labels

| Tag Key | Tag Value | Mục đích |
| :--- | :--- | :--- |
| `Name` | `sre-platform-dev-vpce-s3` | Định danh S3 Gateway Endpoint |
| `Project` | `sre-platform` | Phân loại dự án |
| `Environment` | `dev` | Cô lập môi trường |

---

## 4. Tham chiếu IaC / GitOps
- [01-vpc.tf](../../iac/terraform/envs/dev/01-vpc.tf#L214-L231) — Resource `aws_vpc_endpoint.s3`.

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
```bash
aws ec2 describe-vpc-endpoints --filters "Name=tag:Name,Values=sre-platform-dev-vpce-s3" --region ap-southeast-1 --query "VpcEndpoints[].{State:State,Type:VpcEndpointType,RouteTables:RouteTableIds}"
```
- **PASS:** `State = available`, `VpcEndpointType = Gateway`, liên kết đủ 3 Route Tables.
