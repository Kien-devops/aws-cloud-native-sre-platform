# 08.05 Canary với Argo Rollouts

## Handoff

- Console: kiểm tra ALB target health và CloudWatch request metrics.
- GitOps: Rollout, stable/canary Service và AnalysisTemplate trong `gitops/platform/argo-rollouts/` hoặc overlay ứng dụng.

## Checklist

- [ ] Chuẩn hóa success rate, p95, saturation và business metric.
- [ ] Đặt bước traffic, pause, timeout, failure limit và abort policy.
- [ ] Kiểm tra routing thật qua ALB/Ingress; header test không thay traffic thật.
- [ ] Dùng image digest và migration tương thích ngược.
- [ ] Xác định người có quyền promote/abort.

**Expected:** analysis pass thì tăng traffic; fail thì stable nhận lại traffic.  
**Measured:** Chưa thực hiện.  
**Gate:** canary không làm SLO xấu hơn baseline; abort đã kiểm chứng.  
**Cleanup:** hoàn tất hoặc abort rollout; xóa analysis thử nghiệm và giữ revision rollback.
