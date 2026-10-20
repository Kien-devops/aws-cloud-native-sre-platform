# 03.04 - ElastiCache Redis/Valkey

## Mục tiêu

Tạo cache private, mã hóa khi truyền/lưu và giới hạn truy cập từ workload.

## Input

- Subnet group nhiều AZ, security group nguồn ứng dụng và KMS key.
- Engine/version, node class, replicas, auth token/Secrets Manager và maintenance window.

## Console steps

1. Mở **Amazon ElastiCache > Subnet groups > Create subnet group**; chọn private subnets.
2. Chọn **Caches > Create** và engine/version đã được duyệt.
3. Chọn subnet group, bật encryption at rest/in-transit và auth token nếu hỗ trợ.
4. Gán SG chỉ mở cổng cache từ SG ứng dụng; đặt backup/maintenance.
5. Tạo cache, chờ **Available**, ghi endpoint nhưng không ghi secret.

## Verify

- Cache ở private subnet, không có public endpoint.
- Encryption, auth, replicas/failover và SG đúng thiết kế.
- Theo dõi connections, evictions và memory headroom.

## Output

- **Expected:** Redis/Valkey subnet group, encryption và SG đúng thiết kế.
- **Measured Result:** Chưa thực hiện; không ghi auth token hoặc endpoint nhạy cảm.

Replication group ID, endpoint/port, subnet group, SG ID, engine/version, encryption/failover và timestamp.

## Gate

Ứng dụng có timeout/cache-miss fallback; cache không là nguồn dữ liệu duy nhất cho order/payment.

## Cleanup

Xóa test keys/data trước khi xóa replication group. Kiểm tra snapshot, subnet group và alarms còn tính phí.

