# 10.01 Inventory và owner

## Console path

`Resource Groups/Tag Editor`, `EKS`, `EC2`, `RDS`, `ElastiCache`, `SQS`, `ECR`, `KMS`, `CloudWatch`.

## Checklist

- [ ] Liệt kê resource, Region, environment, owner, data class và lifecycle.
- [ ] Gắn tag cost center, service, managed-by và backup policy.
- [ ] Đối chiếu resource thực tế với Terraform/GitOps manifest.
- [ ] Đánh dấu resource orphan, shared và rollback-critical.
- [ ] Redact Account ID/full ARN trong evidence Git.

**Expected:** không còn resource không owner hoặc không biết nguồn tạo.  
**Measured:** Chưa thực hiện.  
**Gate:** inventory được owner review trước import/cleanup.  
**Cleanup:** không xóa resource chỉ vì thiếu tag; xác minh dependency trước.
