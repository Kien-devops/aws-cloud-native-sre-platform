# 09.05 Chaos và game day

## Handoff

- Console: xác nhận environment/alarms; production cần change approval rõ ràng.
- GitOps/CLI: áp dụng experiment từ `chaos/experiments/`; không chạy target ngoài selector.

## Checklist

- [ ] Có giả thuyết steady state và stop condition.
- [ ] Giới hạn namespace, label, duration và một fault mỗi lần.
- [ ] Có người trực, kênh liên lạc, runbook và quyền abort.
- [ ] Chụp evidence trước/trong/sau; kiểm tra ALB, Pod, SLO và dữ liệu.
- [ ] Tạo postmortem/action item sau game day.

**Expected:** hệ thống đạt giả thuyết hoặc fault dừng an toàn; không tạo incident ngoài kế hoạch.  
**Measured:** Chưa thực hiện.  
**Gate:** cleanup và review hoàn tất; không kết luận khi telemetry thiếu.  
**Cleanup:** xóa Chaos CR, schedule, silence và dữ liệu thử nghiệm.
