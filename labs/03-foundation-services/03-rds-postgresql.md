# 03.03 - Amazon RDS PostgreSQL

## Mục tiêu

Tạo database lab trong private subnets, mã hóa, backup và security group tối thiểu.

## Input

- DB subnet group gồm ít nhất hai AZ và private subnets.
- Security group chỉ cho phép nguồn ứng dụng trên cổng PostgreSQL.
- KMS key, backup retention, instance class, storage và maintenance window.

## Console steps

1. Mở **Amazon RDS > Subnet groups > Create DB subnet group**; chọn VPC/private subnets nhiều AZ.
2. Vào **Databases > Create database**, chọn PostgreSQL và cấu hình lab.
3. Chọn **Public access: No**, DB subnet group và security group riêng.
4. Bật encryption, backup retention, deletion protection theo môi trường.
5. Tạo DB, chờ **Available**, ghi endpoint nhưng không ghi mật khẩu.

## Verify

- Trạng thái `Available`, backup/Multi-AZ đúng mục tiêu.
- Public access tắt; SG không mở `0.0.0.0/0:5432`.
- Events và CloudWatch metrics không có cảnh báo chưa xử lý.

## Output

- **Expected:** DB ở private subnet, encryption/backup đúng, security group chỉ mở từ workload.
- **Measured Result:** Chưa thực hiện; không ghi endpoint/password.

DB identifier, endpoint/port, subnet group, SG ID, AZ/Multi-AZ, encryption key, backup retention và timestamp.

## Gate

Workload private kết nối được qua SG; backup policy, connection limit/pool và owner đã xác định.

## Cleanup

Snapshot nếu cần giữ dữ liệu; sau đó xóa DB theo deletion protection/final snapshot policy. Kiểm tra snapshot, log group và ENI.

