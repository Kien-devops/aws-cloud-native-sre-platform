# 10.06 Cost audit và bàn giao

## Checklist

- [ ] Kiểm tra `Billing > Cost Explorer`, Budgets và anomaly detection theo tag.
- [ ] Tách chi phí NAT, EKS, EC2, RDS, Redis, logs, metrics và data transfer.
- [ ] Xác định idle resource, overprovision, retention và quota gây phí.
- [ ] Ghi owner, hành động tối ưu và ngày review tiếp theo.
- [ ] Bàn giao dashboard, runbook, inventory, Terraform state và Argo URL an toàn.

**Expected:** chi phí khớp mục tiêu môi trường; khoản bất thường có owner.  
**Measured:** Chưa thực hiện.  
**Gate:** handoff checklist được ký; không còn credential hoặc dữ liệu nhạy cảm trong artifact.  
**Cleanup:** xóa file tạm/evidence chưa cần; giữ audit record theo policy.
