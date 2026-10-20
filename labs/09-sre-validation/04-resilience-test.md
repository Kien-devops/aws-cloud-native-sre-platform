# 09.04 Resilience test

## Checklist

- [ ] Chốt một fault, blast radius, owner, abort threshold và rollback.
- [ ] Ghi baseline 15 phút trước fault.
- [ ] Kiểm tra Pod/AZ failure, dependency timeout hoặc queue backlog trong staging.
- [ ] Quan sát SLI, events, traces và dữ liệu order/payment.
- [ ] Đo detection, mitigation và recovery time.

**Expected:** suy giảm có kiểm soát; không mất hoặc nhân đôi dữ liệu.  
**Measured:** Chưa thực hiện.  
**Gate:** fault được dọn sạch, steady state phục hồi và action item có owner.  
**Cleanup:** rollback fault, xóa CR/job/test data, xác nhận không còn schedule.
