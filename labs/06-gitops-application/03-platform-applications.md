# 06.03 Đồng bộ platform applications

## Console path và handoff

- Console: `EKS > Clusters > <cluster> > Resources` dùng quan sát, không sửa manifest.
- Handoff GitOps: Argo CD sync lần lượt `ingress`, `cert-manager`, `external-secrets`, `monitoring`, `keda`, `karpenter`, `argo-rollouts`, `chaos-mesh` từ `gitops/platform/`.

## Checklist

- [ ] Pin chart/image version và cấu hình resource requests/limits.
- [ ] Đồng bộ CRD/controller trước custom resources.
- [ ] Kiểm tra Pod Identity, webhook, events và controller logs.
- [ ] Không bật auto-prune trước khi review ownership/diff.
- [ ] Lưu Argo revision và health của từng application.

**Expected:** application nền tảng `Synced/Healthy`; webhook và CRD sẵn sàng.  
**Measured:** Chưa thực hiện.  
**Gate:** không có Pod crashloop, webhook lỗi hoặc diff ngoài dự kiến.  
**Cleanup:** gỡ theo thứ tự ngược; xóa custom resources trước controller/CRD.
