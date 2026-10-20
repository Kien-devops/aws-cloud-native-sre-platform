# 06.02 AppProject và ranh giới môi trường

## Console path và handoff

- Console: `EKS > Clusters > <cluster> > Access` kiểm tra principal quản trị.
- Handoff GitOps: khai báo AppProject trong `gitops/projects/`; review bằng pull request.

## Checklist

- [ ] Tạo project riêng cho platform và application.
- [ ] Chỉ cho phép repository, cluster và namespace cần thiết.
- [ ] Chặn cluster-scoped resource ngoài allowlist.
- [ ] Tách overlay `dev`, `staging`, `prod`; không dùng chung secret runtime.
- [ ] Quy định ai được sync, promote, abort và rollback.

**Expected:** Application ngoài phạm vi bị từ chối; dev không ghi vào prod.  
**Measured:** Chưa thực hiện.  
**Gate:** policy deny được kiểm chứng và project hợp lệ.  
**Cleanup:** xóa Application trước AppProject sau khi xác nhận orphan resources.
