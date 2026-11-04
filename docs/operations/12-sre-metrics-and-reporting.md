# Chỉ số SRE và báo cáo

Báo cáo SRE nối trải nghiệm người dùng, reliability, delivery và chi phí. Số dashboard không tự chứng minh chất lượng.

## 1. Nhóm chỉ số

| Nhóm | Chỉ số ReliabilityShop | Câu hỏi |
| --- | --- | --- |
| Reliability | SLI/SLO, error budget, burn rate | Người dùng có đạt mục tiêu? |
| Incident | Số incident, MTTA, MTTR, recurrence | Phản ứng có nhanh? |
| Delivery | Change failure rate, lead time, frequency | Phát hành có an toàn? |
| Performance | RPS, p50/p95/p99, saturation | Nút thắt ở đâu? |
| Capacity | Headroom, Pending, quota | Còn chỗ cho peak/failure? |
| Cost | Cost/request, cluster cost, idle | Reliability tốn bao nhiêu? |
| Security | Critical findings, patch age | Rủi ro có giảm? |

## 2. Công thức

~~~text
Availability = good requests / eligible requests
MTTR = tổng thời gian phục hồi / số incident
Change failure rate = release gây incident / tổng release
Cost per order = chi phí phân bổ / số order thành công
~~~

Luôn ghi định nghĩa, cửa sổ, timezone và nguồn dữ liệu.

## 3. Dashboard tối thiểu

- Overview: SLO, burn rate, active incidents, error budget.
- Service: RPS, error, p95/p99, saturation, dependency.
- Queue/worker: depth, oldest age, throughput, DLQ.
- Kubernetes: desired/ready, Pending, throttling, node headroom.
- AWS: ALB 5xx/target health, RDS connections/CPU/IOPS, cost anomaly.

PromQL error ratio minh họa:

~~~promql
sum by (service) (rate(http_server_requests_seconds_count{status_code=~"5.."}[5m]))
/
sum by (service) (rate(http_server_requests_seconds_count[5m]))
~~~

## 4. Báo cáo và xác minh

1. Chốt dữ liệu, timezone UTC và cửa sổ.
2. Ghi Expected, Measured, chênh lệch và nguyên nhân.
3. Nêu incident, budget, release risk và action owner.
4. Gắn raw evidence; ẩn account ID, ARN đầy đủ và PII.
5. Tách số quan sát được khỏi target, forecast và formal PASS.

| Kết quả | Nội dung |
| --- | --- |
| **Expected** | Báo cáo tái lập được từ query/dashboard, mỗi chỉ số có owner, action có deadline. |
| **Measured** | Chưa có dữ liệu vận hành thực. Điền datasource, query và timestamp. |

## 5. Troubleshooting và production

- Số liệu lệch: label, timezone, late data, scrape gap, thay đổi SLO.
- MTTR giảm giả: kiểm tra timestamp declare/recovery.
- Cost/request tăng: tách traffic, transfer, idle node và shared cost.
- KPI bị tối ưu sai: ghép reliability với delivery, security và cost.
- Báo cáo ngoài team phải redaction; raw evidence giới hạn quyền.
