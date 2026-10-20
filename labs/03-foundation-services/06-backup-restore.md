# 03.06 — Backup và restore dữ liệu

## Input

- RDS PostgreSQL và ElastiCache đã tạo.
- KMS, retention, restore owner và ngân sách đã được duyệt.

## Console steps

1. RDS → Databases → Backups: xác nhận automated backup, retention và maintenance window.
2. Tạo manual snapshot cho checkpoint lab nếu cần.
3. ElastiCache → Backups: xác nhận snapshot/retention của Redis hoặc Valkey.
4. Ghi rõ snapshot giữ lại hay xóa khi cleanup.

## Verify / Output

- Expected: backup policy đúng, snapshot có timestamp và encryption.
- Measured Result: Chưa thực hiện; không ghi connection string.
- Output: snapshot identifier đã redact và restore test plan.

## Gate / Troubleshooting / Cleanup

- Gate: restore owner, thời gian và chi phí snapshot đã được duyệt.
- Restore lỗi: kiểm tra subnet group, security group, KMS và quota.
- Cleanup: không xóa final snapshot nếu chưa có approval; xóa snapshot tạm sau khi xác nhận.
