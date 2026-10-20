# 01.04 — Quy tắc Secret và redaction

> Trạng thái: Quy định bắt buộc cho mọi lab; chưa tạo secret thật.

## Input

- Danh sách trường nhạy cảm: password, token, access key, private key, connection string.
- Secret owner, rotation interval và nơi lưu chính thức.

## Console path

1. Khi cần secret, dùng **Secrets Manager → Store a new secret** với KMS key phù hợp.
2. Đặt tên theo environment, không đặt giá trị secret trong tên/tag.
3. Cấp quyền đọc bằng IAM/Pod Identity tối thiểu; không đưa secret vào Git, image hoặc log.

## Verify

- [ ] Không xuất giá trị secret trong Console screenshot/evidence.
- [ ] Log, trace, CI artifact và Terraform output đã được redact.
- [ ] Có rotation và revoke plan.

## Output

- Metadata secret: name, owner, KMS alias, rotation policy.
- Expected: workload chỉ nhận secret runtime.
- Measured Result: `Chưa thực hiện` nếu chưa có consumer.

## Gate

Dừng nếu secret xuất hiện trong terminal, commit, issue, dashboard hoặc file state.

## Cleanup

Rotate/revoke secret trước khi xóa; xử lý recovery window và kiểm tra consumer còn tồn tại.
