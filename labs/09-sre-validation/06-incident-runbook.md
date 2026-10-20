# 09.06 Incident response

## Luồng

`Alert → acknowledge → triage → mitigate → verify recovery → communicate → postmortem`

## Checklist

- [ ] Alert liên kết service, owner, severity và runbook.
- [ ] Ghi timeline UTC, revision, change và evidence.
- [ ] Ưu tiên giảm blast radius: pause rollout, rollback hoặc load shed.
- [ ] Kiểm tra dữ liệu và dependency trước khi đóng incident.
- [ ] Tạo action item có owner/due date; không đổ lỗi cá nhân.

**Expected:** người trực xử lý theo một quy trình nhất quán và có audit trail.  
**Measured:** Chưa thực hiện.  
**Gate:** runbook được diễn tập; escalation và rollback contact hoạt động.  
**Cleanup:** đóng alert/silence, cập nhật runbook và lưu postmortem.
