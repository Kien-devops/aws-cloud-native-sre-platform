# 06. Reliability Engineering

## Khái niệm

- **Availability:** mức dịch vụ sử dụng được theo SLI đã định nghĩa.
- **Resilience:** khả năng chịu tác động và phục hồi.
- **Fault tolerance:** tiếp tục phục vụ khi một thành phần hỏng.
- **Self-healing:** tự sửa một lớp lỗi cụ thể.

Deployment có ba replica chỉ là cấu hình; availability thực tế còn phụ thuộc placement, readiness, ingress và dependency.

## Các mẫu thiết kế

- Timeout và deadline tránh request treo vô hạn.
- Retry exponential backoff + jitter, chỉ cho lỗi tạm thời.
- Circuit breaker ngừng gọi dependency đang hỏng.
- Bulkhead tách pool, thread hoặc queue.
- Idempotency chống xử lý trùng order/payment.
- Graceful degradation giữ chức năng tối thiểu khi dependency lỗi.
- Graceful shutdown và connection draining tránh drop request khi rollout.

## Ví dụ ReliabilityShop

Inventory timeout không nên làm Order retry vô hạn. Order có thể trả lỗi tạm thời, queue công việc nếu nghiệp vụ cho phép hoặc dùng cache với freshness rõ ràng. Business correctness quyết định chiến lược, không chỉ latency.

## Verification

```bash
kubectl get pdb,deploy,pods -n <namespace>
kubectl describe pod <pod> -n <namespace>
```

Dùng k6 tạo tải ổn định, inject một fault được duyệt, đo error rate, p95/p99 và thời gian user journey phục hồi. Không dùng thời gian container restart thay MTTR.

## Troubleshooting

- Retry storm: số lần retry, timeout chain và downstream saturation.
- Rollout lỗi: readiness, maxUnavailable, maxSurge và capacity.
- PDB không bảo vệ: selector sai, replica thiếu hoặc fault ngoài eviction API.
- Fallback trả dữ liệu cũ: freshness và business limit chưa rõ.

## Production considerations

Resilience có chi phí: replica, headroom, multi-AZ, backup và telemetry. Cần kiểm tra data recovery, dependency contract và cách tắt chế độ degrade. “Zero downtime” không phải bảo đảm tuyệt đối.
