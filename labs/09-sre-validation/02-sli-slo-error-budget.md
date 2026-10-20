# 09.02 SLI, SLO và error budget

## Checklist

- [ ] Chốt eligible/good request, timeout, retry, 4xx/5xx và cửa sổ đo.
- [ ] Tạo recording rule cho availability, latency và dependency.
- [ ] Đối chiếu server metrics với ALB/k6 để phát hiện thiếu mẫu.
- [ ] Tính error budget và burn rate; gắn owner/runbook.
- [ ] Lưu PromQL, datasource, timestamp và raw evidence.

**Expected:** SLO được tính từ dữ liệu có mẫu số hợp lệ; dashboard không luôn 100% vì thiếu traffic.  
**Measured:** Chưa thực hiện.  
**Gate:** SLI/SLO được review; chưa gọi PASS nếu chưa có cửa sổ đo thực.  
**Cleanup:** xóa query/dashboard thử nghiệm; giữ recording rule versioned.
