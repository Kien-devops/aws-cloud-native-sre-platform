# 00.01 — Tài khoản, Region và danh tính

> Trạng thái: Hướng dẫn Console-first; chưa thực hiện trên AWS.

## Input

- Tài khoản AWS dùng riêng cho lab, không phải production.
- Region mục tiêu và tối thiểu hai Availability Zone.
- IAM principal có quyền giới hạn, thời hạn rõ ràng.

## Console path

1. Mở **AWS Console → Account** và đối chiếu tài khoản/alias.
2. Chọn Region ở thanh điều hướng.
3. Mở **IAM → Dashboard** để xác nhận principal đang dùng.
4. Mở **Service Quotas**; kiểm tra VPC, EIP, NAT Gateway, EKS, RDS và ElastiCache.

## Verify

- [ ] Đúng account và Region.
- [ ] Có ít nhất hai AZ sẵn sàng.
- [ ] Không dùng root user cho thao tác thường ngày.
- [ ] Quota đủ cho cấu hình dự kiến.

## Output

- Ghi alias account, Region, AZ và principal đã redact.
- Expected: preflight đạt.
- Measured Result: `Chưa thực hiện` cho tới khi có bằng chứng thật.

## Gate

Dừng khi sai account/Region, dùng root, thiếu quota hoặc chưa có owner cleanup.

## Cleanup

Không tạo tài nguyên. Đăng xuất và thu hồi quyền tạm thời khi kết thúc.
