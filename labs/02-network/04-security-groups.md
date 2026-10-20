# 02.04 — Security groups theo luồng

> Trạng thái: Bắt buộc; deny-by-default cho data plane.

## Input

- Luồng dự kiến: ALB → EKS, EKS → RDS, EKS → Redis, EKS → AWS APIs.
- SG riêng cho ALB, node/pod, RDS, Redis và VPC endpoints.

## Console path

1. Mở **VPC → Security groups → Create security group**.
2. Tạo SG theo vai trò, không dùng một SG cho toàn bộ hệ thống.
3. Mở inbound chỉ từ SG nguồn cần thiết; egress tối thiểu theo thiết kế.
4. Gắn SG vào đúng subnet/resource trước khi Create.

## Verify

- [ ] RDS/Redis chỉ nhận từ SG workload.
- [ ] Không mở DB/Redis tới `0.0.0.0/0`.
- [ ] Public inbound chỉ nằm ở ALB ports 80/443 nếu có lý do.
- [ ] Rule có mô tả owner và mục đích.

## Output

- SG matrix: nguồn, đích, port, lý do, expiry.
- Expected: mọi luồng cần thiết được phép, luồng ngoài bị chặn.
- Measured Result: kiểm tra rule/attachment trên Console.

## Gate

Dừng trước rule public hoặc rule mở rộng hơn thiết kế; yêu cầu approval và expiry.

## Cleanup

Gỡ SG rules không còn dùng; xóa SG sau khi detach ENI và resources phụ thuộc.
