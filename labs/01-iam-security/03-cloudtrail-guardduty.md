# 01.03 — CloudTrail và GuardDuty

> Trạng thái: Hướng dẫn; bật theo budget và chính sách account lab.

## Input

- S3 bucket hoặc CloudWatch Logs destination đã được phê duyệt.
- Email/đích nhận cảnh báo bảo mật.

## Console path

1. Mở **CloudTrail → Trails → Create trail**; bật management events và chọn vùng phù hợp.
2. Cấu hình encryption, log file validation và destination theo policy.
3. Mở **GuardDuty → Get started**; bật detector tại Region mục tiêu.
4. Cấu hình SNS/EventBridge notification nếu cần.

## Verify

- [ ] CloudTrail ghi được `Create*`, `AssumeRole` và thay đổi network/IAM.
- [ ] GuardDuty detector ở trạng thái enabled.
- [ ] Log destination có retention và access policy giới hạn.

## Output

- Trail/detector status, retention và owner.
- Expected: có audit trail cho thao tác lab.
- Measured Result: lưu event ID/timestamp đã redact.

## Gate

Xác nhận chi phí S3, CloudWatch Logs và GuardDuty trước khi bật mở rộng.

## Cleanup

Giữ log theo retention policy; chỉ xóa trail/detector sau khi hoàn tất điều tra và lưu evidence cần thiết.
