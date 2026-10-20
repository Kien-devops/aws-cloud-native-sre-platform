# 09.01 Platform smoke test

## Checklist

- [ ] DNS phân giải đúng ALB; TLS hợp lệ.
- [ ] Frontend, API gateway và health endpoint trả kết quả đúng.
- [ ] Service discovery, RDS/Redis/SQS connectivity pass.
- [ ] Pod/Node/ALB target healthy; không có event nghiêm trọng.
- [ ] Chạy journey xem sản phẩm → tạo đơn → thanh toán giả lập.

**Expected:** request flow hoàn tất trong môi trường dev mà không bypass policy.  
**Measured:** Chưa thực hiện.  
**Gate:** smoke pass và evidence đủ timestamp/revision.  
**Cleanup:** xóa dữ liệu test theo key đã đánh dấu; không xóa dữ liệu thật.
