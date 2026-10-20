# 01. Tổng quan về Site Reliability Engineering

## Khái niệm

Site Reliability Engineering (SRE) dùng kỹ thuật phần mềm để vận hành dịch vụ theo mục tiêu độ tin cậy đo được. SRE biến câu hỏi “hệ thống có chạy không?” thành các câu hỏi cụ thể: request nào được tính, tỷ lệ thành công là bao nhiêu, latency người dùng thấy thế nào, sự cố được phát hiện và phục hồi trong bao lâu.

Repository hiện là scaffold. Nội dung này là thiết kế học tập, chưa chứng minh EKS, telemetry hoặc SLO đã hoạt động.

## SRE, DevOps và Observability

- **DevOps** cải thiện luồng cộng tác từ source tới production.
- **Observability** dùng metrics, logs và traces để giải thích trạng thái hệ thống.
- **SRE** dùng telemetry, SLO và error budget để quyết định ưu tiên reliability, release và vận hành.

Có dashboard nhưng không có SLO thì chưa biết lỗi ảnh hưởng người dùng tới mức nào. Có SLO nhưng thiếu trace và log liên quan thì khó tìm nguyên nhân.

## Luồng hệ thống

```text
Người dùng -> ALB -> API Gateway -> Auth/Order/Inventory
                                  -> PostgreSQL/Redis/SQS
                                             |
                         Metrics/Logs/Traces -> Backend quan sát
                                             |
                                      SLO -> Alert -> Runbook
```

## Ví dụ ReliabilityShop

Order API tăng HTTP 5xx. Restart Pod chỉ là một giả thuyết. Người trực cần kiểm tra release gần nhất, dependency timeout, DB connection pool, trace lỗi và tỷ lệ request bị ảnh hưởng. Rollback làm error rate giảm là bằng chứng mitigation hiệu quả; chưa đủ kết luận root cause nếu chưa phân tích thay đổi.

## Triển khai dự kiến

Định nghĩa service owner, user journey, SLI và SLO trước. Sau đó instrument ứng dụng, thu telemetry, tạo dashboard và burn-rate alerts. Runbook phải gắn với alert; chaos/performance test phải dùng cùng SLI để đánh giá.

## Verification

```bash
kubectl get deploy,svc,pods -A
kubectl get events -A --sort-by=.lastTimestamp
```

**Expected:** thấy workload và events nếu cluster đã triển khai. **Measured Result:** chỉ ghi sau khi chạy trên cluster thật, kèm context, timestamp và output đã che dữ liệu nhạy cảm.

## Troubleshooting

- Dashboard trống: kiểm tra scrape target, labels, time range và Collector logs.
- Alert gây nhiễu: xem lại SLI, grouping, severity và runbook link.
- Pod healthy nhưng request lỗi: kiểm tra Service, EndpointSlice, readiness và dependency.
- MTTR thấp giả tạo: phân biệt thời điểm Pod Ready với lúc user journey phục hồi.

## Production considerations

SLO phải được chủ dịch vụ chấp thuận. Error budget không dùng để phạt cá nhân. Cần ownership, escalation, audit trail, telemetry cost limit và phương án khi chính monitoring path bị lỗi.

## Tham khảo

- [Google SRE Books](https://sre.google/books/)
- [AWS Reliability Pillar](https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/welcome.html)
