# 10.05 Cleanup theo thứ tự ngược

## Thứ tự đề xuất

`workload/Ingress → Argo applications → add-ons/controllers → EKS node/cluster → RDS/Redis/SQS/ECR → endpoints/NAT → VPC → KMS/CloudTrail`.

## Checklist

- [ ] Xác nhận môi trường đúng và approval cho tài nguyên có dữ liệu.
- [ ] Tạo inventory/snapshot trước xóa; giữ final snapshot RDS theo policy.
- [ ] Xóa consumer trước queue/DLQ; workload trước database.
- [ ] KMS key deletion có waiting period; không xóa key đang mã hóa backup/state.
- [ ] Kiểm tra orphan ENI, EIP, ALB, log group và NAT sau cleanup.

**Expected:** không còn tài nguyên tính phí ngoài danh sách giữ lại.  
**Measured:** Chưa thực hiện.  
**Gate:** từng deletion có log, owner và recovery boundary; không force-delete dữ liệu chưa backup.  
**Cleanup:** cập nhật inventory và budget sau khi deletion hoàn tất.
