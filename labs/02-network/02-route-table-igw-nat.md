# 02.02 — Route Tables, Internet Gateway & NAT Gateway

> **Phạm vi:** Network Routing & FinOps Egress | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Strict Tier Isolation:** Public Subnets định tuyến ra Internet qua IGW; Private App Subnets đi ra ngoài (pull image, gọi AWS API) một chiều qua NAT Gateway; Private DB Subnets tuyệt đối không có route `0.0.0.0/0` ra Internet.
- **FinOps Optimization (Dev):** Sử dụng 1 NAT Gateway tại `ap-southeast-1a` cho môi trường `dev` để tiết kiệm ~$32/tháng (Production nâng cấp lên 1 NAT Gateway/AZ để đảm bảo High Availability).

---

## 2. Đặc tả Tài nguyên (Resource Inventory & Config)

| Resource Type | Tên Resource (Naming) | Tham số Cấu hình Cốt lõi |
| :--- | :--- | :--- |
| **Internet Gateway** | `sre-platform-dev-igw` | Gắn trực tiếp vào `sre-platform-dev-vpc` |
| **Elastic IP** | `sre-platform-dev-nat-eip-1a` | Domain: `vpc` |
| **NAT Gateway** | `sre-platform-dev-nat-1a` | Đặt tại `sre-platform-dev-public-1a`, gắn `sre-platform-dev-nat-eip-1a` |
| **Public Route Table** | `sre-platform-dev-rt-public` | Route `0.0.0.0/0` -> `igw`; Associate: `public-1a`, `public-1b` |
| **Private App Route Table** | `sre-platform-dev-rt-private-app` | Route `0.0.0.0/0` -> `nat-1a`; Associate: `private-app-1a`, `private-app-1b` |
| **Private DB Route Table** | `sre-platform-dev-rt-private-db` | Chỉ có route `10.0.0.0/16` (`local`) + S3 Gateway; Associate: `private-db-1a`, `private-db-1b` |

---

## 3. Chiến lược Tagging & Labels

| Tag Key | Tag Value | Mục đích |
| :--- | :--- | :--- |
| `Name` | `sre-platform-dev-{igw,nat-1a,rt-*}` | Định danh rõ chức năng định tuyến |
| `Project` | `sre-platform` | Phân bổ chi phí NAT Gateway |
| `Environment` | `dev` | Cô lập môi trường |

---

## 4. Tham chiếu IaC / GitOps
- [01-vpc.tf](../../iac/terraform/envs/dev/01-vpc.tf) — Khai báo `aws_internet_gateway`, `aws_eip`, `aws_nat_gateway`, 3 `aws_route_table` và `aws_route_table_association`.

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
```bash
aws ec2 describe-route-tables --filters "Name=tag:Project,Values=sre-platform" --region ap-southeast-1 --query "RouteTables[].{Name:Tags[?Key=='Name']|[0].Value,Routes:Routes[].DestinationCidrBlock}"
```
- **PASS:** `rt-private-db` không có route `0.0.0.0/0`, `rt-private-app` trỏ `0.0.0.0/0` qua `nat-1a`, `rt-public` trỏ `0.0.0.0/0` qua `igw`.
