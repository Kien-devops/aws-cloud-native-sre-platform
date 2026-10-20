# 01.02 — KMS customer managed key

> Trạng thái: Hướng dẫn Console-first; key dùng cho EKS, RDS và Secrets Manager theo nhu cầu.

## Input

- Alias key, account/Region và danh sách service principal cần dùng.
- Chính sách rotation, retention và người quản trị break-glass.

## Console path

1. Mở **Key Management Service → Customer managed keys → Create key**.
2. Chọn loại key phù hợp, đặt alias và bật **Automatic key rotation**.
3. Tạo key policy theo least privilege; tách key administrator khỏi key user.
4. Ghi ARN/alias vào tài liệu đã redact, không ghi plaintext secret.

## Verify

- [ ] Key ở đúng Region.
- [ ] Key policy không mở `Principal: *`.
- [ ] Rotation bật và CloudTrail audit được thao tác.
- [ ] Có kế hoạch xử lý khi key bị disable hoặc scheduled deletion.

## Output

- KMS alias, owner và danh sách consumer.
- Expected: key dùng được cho encryption mà không cấp quyền dư.
- Measured Result: ghi trạng thái key và timestamp.

## Gate

Approval bắt buộc trước `Disable key` hoặc `Schedule key deletion`; không xóa key đang được resource sử dụng.

## Cleanup

Gỡ consumer trước; chỉ schedule deletion sau khi xác nhận không còn dependency và có thời gian khôi phục.
