# 10.04 Rebuild và restore

## Checklist

- [ ] Xác định backup, version, encryption key và dependency cần restore.
- [ ] Dựng môi trường thử nghiệm từ code/state đã version hóa.
- [ ] Restore RDS/Redis cần thiết; kiểm tra schema, dữ liệu và secret reference.
- [ ] Reinstall EKS add-on/GitOps; chạy smoke và SLO checks.
- [ ] Đo thời gian từ bắt đầu đến service usable và dữ liệu đạt invariant.

**Expected:** rebuild lặp lại được; RTO/RPO chỉ ghi theo số đo thật.  
**Measured:** Chưa thực hiện.  
**Gate:** restore evidence được review; không gọi `multi-region DR` nếu chưa diễn tập failover.  
**Cleanup:** xóa môi trường restore sau khi lưu evidence; giữ backup theo retention.
