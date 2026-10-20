# 10.02 Terraform import và plan

## Handoff

- Console: dùng để xác nhận thuộc tính thực tế; không chỉnh song song khi import.
- Terraform: map resource vào module `iac/terraform/`; chạy `import`, `plan` và review replacement.

## Checklist

- [ ] Chọn state/backend đúng môi trường; khóa state.
- [ ] Tạo import map có resource ID đã redacted.
- [ ] Import từng nhóm nhỏ; chạy `plan` sau mỗi nhóm.
- [ ] Điều tra mọi `destroy`/`replace`; không apply khi chưa review.
- [ ] Lưu plan, provider/module version và reviewer.

**Expected:** plan tiến tới `No changes` hoặc diff được phê duyệt.  
**Measured:** Chưa thực hiện.  
**Gate:** không có replacement ngoài ý muốn; state backup/versioning hoạt động.  
**Cleanup:** xóa file import tạm và lock đúng quy trình; không xóa state bucket.
