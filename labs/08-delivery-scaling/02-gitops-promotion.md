# 08.02 Promotion qua GitOps

## Handoff

- CI mở PR cập nhật digest trong `gitops/applications/overlays/<env>/`.
- Argo CD sync sau merge; không deploy trực tiếp bằng kubeconfig từ CI.

## Checklist

- [ ] PR có test, scan, SBOM, reviewer và change scope.
- [ ] Render/diff overlay; xác nhận chỉ workload mong muốn thay đổi.
- [ ] Sync dev, chờ rollout và kiểm tra SLI.
- [ ] Promotion staging/prod cần approval riêng và revision cố định.
- [ ] Lưu commit, digest, Argo revision, events và health result.

**Expected:** revision Git, image digest và rollout liên kết một-một.  
**Measured:** Chưa thực hiện.  
**Gate:** dev pass smoke/SLO gate; staging/prod chưa tự động promote khi thiếu approval.  
**Cleanup:** revert PR hoặc pin lại digest trước nếu phát hiện lỗi.
