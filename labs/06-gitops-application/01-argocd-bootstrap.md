# 06.01 Bootstrap Argo CD

## Mục tiêu

Cài Argo CD đã pin phiên bản và khóa quyền truy cập quản trị.

## Console path và handoff

- Console: `Amazon EKS > Clusters > <cluster> > Overview/Resources` chỉ dùng xác nhận cluster `ACTIVE`.
- Handoff CLI/GitOps: cập nhật kubeconfig bằng role được phép; cài manifest/Helm từ `gitops/bootstrap/`; không tạo workload bằng Console.

## Checklist

- [ ] Xác nhận context trỏ đúng account, Region và cluster `dev`.
- [ ] Tạo namespace `argocd`; cài phiên bản đã pin.
- [ ] Đổi hoặc vô hiệu hóa mật khẩu admin mặc định; cấu hình RBAC/SSO dự kiến.
- [ ] Giới hạn Service/Ingress; không công khai API server hoặc Argo CD thiếu xác thực.
- [ ] Ghi chart/version, commit và controller events.

**Expected:** Pod Argo CD `Ready`; API/UI truy cập qua kênh được kiểm soát.  
**Measured:** Chưa thực hiện.  
**Gate:** tất cả component khỏe; credential mặc định không còn hiệu lực.  
**Cleanup:** xóa release/namespace chỉ khi chưa có Application quản lý workload.
