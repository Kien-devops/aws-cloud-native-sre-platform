# 06.04 Triển khai ReliabilityShop base

## Console path và handoff

- Console: `ECR > Repositories` xác nhận các image digest tồn tại; `Secrets Manager` xác nhận tên secret, không đọc giá trị vào evidence.
- Handoff GitOps: manifest base nằm tại `gitops/applications/base/`.

## Checklist

- [ ] Tạo namespace, ServiceAccount, NetworkPolicy, PDB và quota.
- [ ] Dùng image digest; không dùng `latest`.
- [ ] Khai báo requests/limits, probes và topology spread.
- [ ] Tham chiếu secret qua ExternalSecret/Pod Identity.
- [ ] Kiểm tra Service selector, port và dependency endpoint.

**Expected:** workload render hợp lệ; không chứa secret; Pod có guardrail vận hành.  
**Measured:** Chưa thực hiện.  
**Gate:** `kustomize build`/validation qua; admission không từ chối manifest.  
**Cleanup:** xóa Application; xác minh PVC, load balancer và secret external còn cần hay không.
