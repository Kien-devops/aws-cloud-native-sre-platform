# 06.05 Overlay dev, staging và prod

## Console path và handoff

- Console: đối chiếu endpoint thực tại `RDS`, `ElastiCache`, `SQS`, `ECR`; không hard-code credential.
- Handoff Git: cấu hình tại `gitops/applications/overlays/<env>/`; promotion bằng pull request.

## Checklist

- [ ] Dev dùng resource nhỏ và retention ngắn trong giới hạn lab.
- [ ] Mỗi overlay đặt namespace, hostname, replicas và image digest riêng.
- [ ] Database/queue/secret reference khớp môi trường.
- [ ] Prod có HA, PDB, autoscaling và approval policy phù hợp.
- [ ] Render và diff cả ba overlay trước merge.

**Expected:** overlay chỉ thay giá trị môi trường; base không bị sao chép.  
**Measured:** Chưa thực hiện.  
**Gate:** không có secret/plaintext, placeholder hoặc cross-environment endpoint.  
**Cleanup:** revert commit overlay; không xóa shared data service nếu còn consumer.
