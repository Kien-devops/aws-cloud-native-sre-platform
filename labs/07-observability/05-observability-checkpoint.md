# 07.05 Checkpoint observability

## Bài kiểm tra end-to-end

1. Gửi một request hợp lệ qua DNS/ALB.
2. Lấy correlation/trace ID đã redacted.
3. Xác nhận metrics request, log service và trace downstream cùng ID.
4. Kích hoạt một lỗi staging có kiểm soát; xác nhận alert, dashboard và resolve.
5. Ghi timestamp, revision, query và ảnh chụp đã che dữ liệu nhạy cảm.

**Expected:** một request nối được metrics → logs → traces; alert có owner và runbook.  
**Measured:** Chưa thực hiện.  
**Gate:** telemetry đủ để chẩn đoán lỗi mà không làm lộ secret; pass mới sang phase 08.  
**Cleanup:** xóa fault/silence/test data; khôi phục cấu hình baseline.
