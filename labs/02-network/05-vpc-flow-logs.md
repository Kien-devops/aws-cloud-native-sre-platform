# 02.05 — VPC Flow Logs

> Trạng thái: Khuyến nghị; có chi phí lưu trữ/ingest tùy destination.

## Input

- VPC/subnet/ENI cần quan sát.
- CloudWatch Log Group hoặc S3 destination, retention và IAM role.

## Console path

1. Mở **VPC → Your VPCs → chọn VPC → Flow logs → Create flow log**.
2. Chọn traffic type `ALL` hoặc phạm vi tối thiểu đã phê duyệt.
3. Chọn CloudWatch Logs/S3, retention và IAM role phù hợp.
4. Gắn tag và ghi rõ owner/cost center.

## Verify

- [ ] Flow log ở trạng thái active.
- [ ] Destination nhận record sau khi có traffic.
- [ ] Log Group có retention, encryption và access policy giới hạn.
- [ ] Không dùng flow logs để ghi secret hoặc kết luận ứng dụng nếu chưa đối chiếu metric.

## Output

- Flow log ID, destination, filter và retention.
- Expected: truy được accepted/rejected traffic theo ENI.
- Measured Result: timestamp của record đầu tiên và query đã redact.

## Gate

Xác nhận chi phí và quyền đọc log trước khi bật `ALL` trên toàn VPC.

## Cleanup

Tắt flow log sau lab nếu không cần; giữ log theo retention/audit policy rồi mới xóa destination.
