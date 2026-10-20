# 08.03 HPA và KEDA

## Handoff

- Console: `SQS > Queues` kiểm tra queue/DLQ và CloudWatch metrics.
- GitOps/CLI: khai báo HPA/KEDA tại manifest ứng dụng; IAM qua Pod Identity/IRSA.

## Checklist

- [ ] HPA có min/max, target, scale-up/down stabilization.
- [ ] KEDA trỏ đúng queue URL, Region, metric và visibility timeout.
- [ ] Worker idempotent; DLQ và alert age-of-oldest-message đã có.
- [ ] Test tải staging; đo scale latency, replicas và queue age.
- [ ] Xác nhận scale down không làm mất message hoặc request.

**Expected:** Pod tăng trước khi queue age vượt SLO; scale down ổn định.  
**Measured:** Chưa thực hiện.  
**Gate:** metric hợp lệ, IAM tối thiểu, không oscillation hoặc retry storm.  
**Cleanup:** giảm tải, xóa ScaledObject/HPA thử nghiệm, giữ DLQ để điều tra.
