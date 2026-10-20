# 09.07 Go-live gate

## Checklist quyết định

- [ ] Infrastructure, security và ownership checklist đạt.
- [ ] Smoke, SLO baseline, observability và rollback đạt.
- [ ] Không còn critical/high chưa có exception có hạn sử dụng.
- [ ] Backup/restore và chi phí đã review; quota còn đủ.
- [ ] Có owner on-call, runbook, escalation và cửa sổ thay đổi.

**Expected:** ghi rõ `GO`, `NO-GO` hoặc `GO WITH EXCEPTION`, kèm người phê duyệt và thời gian.  
**Measured:** Chưa thực hiện.  
**Gate:** chỉ `GO` khi evidence thật đủ; staging/prod promotion là quyết định riêng.  
**Cleanup:** nếu `NO-GO`, revert thay đổi thử nghiệm và lập danh sách blocker.
