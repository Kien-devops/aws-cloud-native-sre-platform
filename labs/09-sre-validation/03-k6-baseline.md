# 09.03 Baseline k6

## Handoff

- Handoff CLI: chạy script trong `performance/k6/` hoặc repo ứng dụng; target chỉ dev/staging đã phê duyệt.
- Quan sát Grafana/Prometheus, ALB và dependency metrics trong cùng cửa sổ.

## Checklist

- [ ] Định nghĩa smoke/load/stress/spike/soak và stop condition.
- [ ] Giới hạn VU, duration, request rate và dữ liệu test.
- [ ] Đo p50/p95/p99, throughput, error rate, saturation và queue age.
- [ ] Ghi commit script, target URL đã redacted và timestamp UTC.
- [ ] So sánh baseline trước/sau thay đổi.

**Expected:** baseline lặp lại được; không gây chi phí hoặc dữ liệu ngoài phạm vi.  
**Measured:** Chưa thực hiện.  
**Gate:** SLO và capacity threshold được xác định từ kết quả thật.  
**Cleanup:** dừng test, xóa dữ liệu seed, tắt runner và tải xuống evidence cần thiết.
