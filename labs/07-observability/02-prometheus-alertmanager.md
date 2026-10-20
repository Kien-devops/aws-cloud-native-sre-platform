# 07.02 Prometheus và Alertmanager

## Handoff

- Console: kiểm tra EKS node/Pod health; không sửa rule trực tiếp trên UI.
- GitOps: khai báo ServiceMonitor, recording rule và Alertmanager route trong `observability/prometheus/` và `observability/alertmanager/`.

## Checklist

- [ ] Scrape đúng namespace, label và port metrics.
- [ ] Đặt retention, storage và giới hạn cardinality.
- [ ] Tạo rule availability, latency, error rate, saturation và queue age.
- [ ] Route alert tới receiver đúng owner; có inhibition cho incident gốc.
- [ ] Test alert bằng metric có kiểm soát, sau đó xác nhận resolve.

**Expected:** target `UP`; rule evaluate thành công; alert tới đúng receiver.  
**Measured:** Chưa thực hiện.  
**Gate:** không có target quan trọng `DOWN`, rule lỗi hoặc alert không owner.  
**Cleanup:** xóa rule thử nghiệm và silence sau kiểm tra.
