# 10.03 Ownership và drift

## Ma trận owner

| Phạm vi | Owner |
| --- | --- |
| AWS network/data/cluster | Terraform |
| Kubernetes platform/application | Argo CD/Git |
| Runtime secret value | Secrets Manager/ESO |
| Image build và provenance | CI/ECR |

## Checklist

- [ ] Không có Console hotfix chưa ghi vào code.
- [ ] Argo CD `Synced/Healthy`; Terraform plan không drift ngoài dự kiến.
- [ ] Xác định resource do Helm/controller tạo, tránh import kép.
- [ ] Kiểm tra admission/RBAC và managed fields.

**Expected:** mỗi resource có đúng một owner thay đổi.  
**Measured:** Chưa thực hiện.  
**Gate:** ownership matrix được review và drift triage xong.  
**Cleanup:** revert hotfix hoặc ghi nhận change trước khi bật self-heal/prune.
