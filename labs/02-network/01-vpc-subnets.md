# 02.01 — VPC và subnets đa AZ

> Trạng thái: Hướng dẫn Console-first; tạo mạng private-first cho EKS và data services.

## Input

- CIDR VPC không trùng mạng kết nối dự kiến.
- Tối thiểu hai AZ; phân loại public, private và database subnets.
- Naming/tag từ phase 00.

## Console path

1. Mở **VPC → Your VPCs → Create VPC**.
2. Tạo VPC với DNS resolution và DNS hostnames bật.
3. Mở **VPC → Subnets → Create subnet**; tạo subnet theo từng AZ.
4. Gắn tags chính xác cho public/private subnet và EKS discovery theo thiết kế.

## Verify

- [ ] Subnet phân bố tối thiểu hai AZ.
- [ ] CIDR không chồng lấn.
- [ ] Public subnet không chứa workload/data private.
- [ ] Route table association đã xác định cho từng subnet.

## Output

- VPC ID, subnet IDs, AZ và CIDR đã redact.
- Expected: có nền mạng đủ cho EKS, RDS và ElastiCache.
- Measured Result: ghi trạng thái subnet và timestamp.

## Gate

Dừng nếu CIDR chồng lấn, subnet sai AZ hoặc tag khiến ALB/Karpenter nhận diện sai.

## Cleanup

Xóa resources phụ thuộc trước; không xóa VPC khi còn ENI, NAT, endpoint hoặc database.
