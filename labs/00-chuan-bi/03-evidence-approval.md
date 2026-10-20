# 00.03 — Bằng chứng, phê duyệt và ranh giới thao tác

> Trạng thái: Hướng dẫn; không lưu secret hoặc credential vào Git.

## Input

- Tên lab, account/Region, owner và cửa sổ thực hiện.
- Danh sách thao tác có thể tạo chi phí, thay đổi IAM/network hoặc xóa dữ liệu.

## Console path

1. Tạo bản ghi lab ngoài secret store với các trường: `Target`, `Expected`, `Measured Result`, timestamp.
2. Mở **AWS CloudTrail → Event history** khi cần đối chiếu thao tác.
3. Đánh dấu approval gate trước Create, public access, IAM change, replacement và Delete.

## Verify

- [ ] Evidence không chứa password, token, access key, private key, secret value.
- [ ] Account ID, full ARN, IP nhạy cảm và email đã redact khi commit.
- [ ] Có stop condition và rollback cho từng thao tác rủi ro.

## Output

- Checklist evidence dùng chung cho các lab.
- Expected: mọi kết luận phân biệt rõ Expected và Measured Result.
- Measured Result mặc định: `Chưa thực hiện`.

## Gate

Dừng nếu không xác định được blast radius, rollback hoặc người phê duyệt.

## Cleanup

Xóa bản nháp chứa dữ liệu nhạy cảm; giữ evidence đã redact cùng timestamp và nguồn kiểm chứng.
