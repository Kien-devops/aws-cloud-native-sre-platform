# 08.06 Rollback và kiểm chứng

## Quy trình

1. Dừng promote khi SLI vượt ngưỡng hoặc có lỗi dữ liệu.
2. Abort Rollout hoặc revert PR về revision/digest đã biết tốt.
3. Theo dõi Pod, ALB, queue, database connection và error budget.
4. Kiểm tra invariant dữ liệu, duplicate order và side effect payment.
5. Ghi nguyên nhân, thời gian phát hiện, thời gian phục hồi và quyết định.

**Expected:** stable revision phục vụ traffic; lỗi giảm về baseline; dữ liệu nhất quán.  
**Measured:** Chưa thực hiện.  
**Gate:** rollback diễn tập thành công trước go-live; migration có kế hoạch forward/rollback riêng.  
**Cleanup:** đóng incident/change, gỡ image test sau retention, không xóa artifact rollback.
