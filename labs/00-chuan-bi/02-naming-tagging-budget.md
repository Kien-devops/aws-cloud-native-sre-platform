# 00.02 — Quy ước tên, tag và ngân sách

> Trạng thái: Hướng dẫn Console-first; chưa thực hiện trên AWS.

## Input

- Tên project, environment, owner và ngày hết hạn lab.
- Ngân sách tối đa và thời gian tồn tại dự kiến.
- Danh sách cost drivers: NAT Gateway, EKS, ALB, RDS, ElastiCache, public IPv4, logs.

## Console path

1. Mở **Resource Groups & Tag Editor → Tag policies/Tag Editor** để thống nhất tag.
2. Mở **Billing and Cost Management → Budgets → Create budget**.
3. Tạo cảnh báo actual/forecast ở các ngưỡng 50%, 80% và 100%.
4. Đặt quy ước tên `rs-<env>-<region>-<component>`.

## Verify

- [ ] Tag bắt buộc: `Project`, `Application`, `Environment`, `Owner`, `ManagedBy`, `Purpose`, `ExpiresAt`.
- [ ] Budget có email/đích cảnh báo hợp lệ.
- [ ] Mọi tài nguyên mới có owner và TTL.

## Output

- Bảng tên/tag chuẩn dùng cho các lab sau.
- Expected: có budget và stop condition rõ ràng.
- Measured Result: lưu ARN budget và timestamp đã redact.

## Gate

Không tạo tài nguyên tính phí khi chưa có budget, TTL và người chịu trách nhiệm cleanup.

## Cleanup

Giữ budget trong suốt vòng đời lab; xóa khi project kết thúc và đã xác nhận không còn tài nguyên.
