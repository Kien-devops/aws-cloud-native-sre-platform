# 06.06 First sync và smoke test

## Console path và handoff

- Console: `EC2 > Load Balancers > <alb> > Target groups` và `Route 53 > Hosted zones` kiểm tra target/DNS.
- Handoff: Argo CD sync application dev; dùng `kubectl`, DNS và HTTP client để xác minh.

## Checklist

- [ ] Application `Synced/Healthy`, revision đúng commit đã review.
- [ ] Pod `Ready`, phân tán node/AZ; EndpointSlice có backend.
- [ ] ALB target healthy; chứng chỉ hợp lệ; DNS phân giải đúng.
- [ ] Chạy health, frontend và một user journey không phá dữ liệu.
- [ ] Lưu timestamp, commit, digest, status code và events liên quan.

**Expected:** request đi `DNS -> ALB -> Service -> Pod` thành công.  
**Measured:** Chưa thực hiện.  
**Gate:** smoke pass; không có error/event nghiêm trọng trong cửa sổ quan sát.  
**Cleanup:** abort sync/revert commit; xóa ALB orphan sau khi controller đã gỡ Ingress.
