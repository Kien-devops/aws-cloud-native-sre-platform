# 02.03 — VPC endpoints

> Trạng thái: Tùy chọn; dùng để giảm NAT egress khi phù hợp.

## Input

- Services cần private access: S3, DynamoDB, ECR API/DKR, STS, CloudWatch Logs, SSM.
- Subnets, route tables và security group cho interface endpoints.

## Console path

1. Mở **VPC → Endpoints → Create endpoint**.
2. Chọn VPC và service theo Region.
3. Dùng **Gateway** cho S3/DynamoDB khi phù hợp; dùng **Interface** cho dịch vụ cần ENI.
4. Giới hạn policy, subnets và security group; bật private DNS cho interface endpoint khi cần.

## Verify

- [ ] Endpoint ở đúng VPC/Region.
- [ ] Route table có prefix list cho gateway endpoint.
- [ ] Interface endpoint có private DNS, SG và ENI healthy.
- [ ] Không tạo endpoint trùng gây chi phí không cần thiết.

## Output

- Endpoint IDs, services, route tables/SG đã redact.
- Expected: đường private tới AWS APIs hoạt động.
- Measured Result: kiểm tra trạng thái `Available` và route.

## Gate

So sánh chi phí endpoint với NAT trước khi tạo nhiều interface endpoint.

## Cleanup

Xóa endpoint sau consumer; kiểm tra route/SG còn tham chiếu trước khi xóa.
