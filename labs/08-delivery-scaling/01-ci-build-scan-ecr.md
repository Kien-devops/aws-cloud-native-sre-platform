# 08.01 CI, kiểm thử, scan và ECR

## Handoff

- Console: `ECR > Repositories > <repo>` kiểm tra scan-on-push, immutable tag và lifecycle.
- Handoff CI: Repo `app3` chạy unit/integration/contract test, SAST/SCA, secret scan, image scan và push digest.

## Checklist

- [ ] GitHub Actions dùng OIDC, action pin theo SHA và quyền tối thiểu.
- [ ] Tạo SBOM/provenance; không ghi credential vào log.
- [ ] Tag chứa commit SHA; deployment dùng digest.
- [ ] Kiểm tra vulnerability policy và exception có expiry.
- [ ] Giữ artifact cũ đủ lâu cho rollback.

**Expected:** pipeline pass; ECR có digest và scan result đạt policy.  
**Measured:** Chưa thực hiện.  
**Gate:** không có critical/high chưa được phê duyệt; digest truy được về commit.  
**Cleanup:** xóa image test theo lifecycle; không xóa digest đang là rollback target.
