# 07.01 OpenTelemetry Collector

## Handoff

- Console: `EKS > Clusters > <cluster> > Resources` xác nhận namespace và Pod.
- GitOps/CLI: triển khai collector từ `observability/opentelemetry/`; dùng `kubectl` xem queue, exporter và events.

## Checklist

- [ ] Chọn OTLP endpoint, protocol, TLS và sampling.
- [ ] Bật batch, retry, memory limit và queue có giới hạn.
- [ ] Redact secret/PII trước khi xuất telemetry.
- [ ] Cấu hình instrumentation cho frontend, gateway và service.
- [ ] Kiểm tra collector không làm request ứng dụng thất bại khi backend telemetry lỗi.

**Expected:** collector `Ready`, exporter gửi được dữ liệu; backpressure có cảnh báo.  
**Measured:** Chưa thực hiện.  
**Gate:** không mất telemetry ngoài ngưỡng đã chấp nhận; resource usage trong budget.  
**Cleanup:** tắt instrumentation trước khi gỡ collector; giữ dashboard lỗi đủ thời gian điều tra.
