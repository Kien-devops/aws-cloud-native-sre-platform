# 07.03 Loki và Tempo

## Handoff

- GitOps: triển khai backend từ `observability/loki/` và `observability/tempo/`; cấu hình storage/retention theo môi trường.
- CLI: kiểm tra ingest, compaction, PVC và query sample.

## Checklist

- [ ] Log structured JSON có `service`, `env`, `level`, `trace_id`.
- [ ] Trace propagation giữ `traceparent` qua HTTP và SQS.
- [ ] Đặt retention, tenant/access policy và giới hạn label cardinality.
- [ ] Kiểm tra disk, WAL, compaction và lỗi exporter.
- [ ] Không ghi token, password, full request body hoặc PII nhạy cảm.

**Expected:** tìm được log và trace của cùng một request.  
**Measured:** Chưa thực hiện.  
**Gate:** query có dữ liệu mới; backend không vượt storage/error budget.  
**Cleanup:** xóa dữ liệu thử nghiệm theo retention; không xóa bucket/PVC dùng cho production.
