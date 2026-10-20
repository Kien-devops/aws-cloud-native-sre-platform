# 02.02 — Route table, Internet Gateway và NAT Gateway

> Trạng thái: Hướng dẫn; NAT Gateway là cost driver và cần approval.

## Input

- Public/private subnet map.
- Quyết định egress: NAT Gateway, VPC endpoints hoặc kết hợp.
- Elastic IP allocation được phê duyệt nếu cần NAT.

## Console path

1. Mở **VPC → Internet gateways → Create/Attach** cho VPC.
2. Mở **VPC → Route tables**; tạo public route `0.0.0.0/0` tới IGW.
3. Mở **VPC → NAT gateways → Create NAT gateway** trong public subnet; gắn EIP.
4. Tạo private route `0.0.0.0/0` tới NAT và associate đúng private subnet.

## Verify

- [ ] Chỉ public subnet có route trực tiếp tới IGW.
- [ ] Private subnet không nhận inbound từ Internet.
- [ ] NAT ở đúng AZ hoặc có kế hoạch HA/cost rõ ràng.
- [ ] Không có route mặc định ngoài thiết kế.

## Output

- Route table associations, NAT ID/EIP đã redact.
- Expected: private workload egress được kiểm soát.
- Measured Result: kiểm tra route và trạng thái NAT trên Console.

## Gate

Approval bắt buộc trước khi tạo NAT; dừng nếu cost hoặc blast radius chưa rõ.

## Cleanup

Xóa routes, NAT Gateway và EIP sau khi dừng workload; kiểm tra trạng thái billing có độ trễ.
