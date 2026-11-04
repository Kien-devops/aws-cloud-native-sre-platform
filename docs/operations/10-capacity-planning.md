# Capacity planning

Capacity planning chuyển dự báo nhu cầu và SLO thành tài nguyên, headroom và kế hoạch mở rộng.

~~~text
Nhu cầu dự báo x peak factor x growth
              |
              v
Throughput mỗi replica -> số replica -> node capacity -> chi phí
              |
              +-> headroom cho lỗi AZ, rollout và spike
~~~

## Công thức

~~~text
Required replicas = ceil(peak RPS / sustainable RPS per replica)
Usable node capacity = allocatable - DaemonSet - system reserve
Headroom % = (capacity - forecast load) / capacity x 100
~~~

Sustainable RPS phải lấy từ load test tại ngưỡng SLO, không lấy từ điểm service crash.

## Dữ liệu cần thu

Traffic theo giờ/ngày, seasonality, RPS từng journey, payload, cache hit, CPU/memory request, throttling, GC, DB connections/IOPS/storage, Redis eviction, SQS age/depth, Karpenter provisioning time và AWS quota.

Ví dụ peak 600 RPS, Order Service duy trì 80 RPS, headroom 30%:

~~~text
Adjusted peak = 600 x 1,3 = 780 RPS
Replicas = ceil(780 / 80) = 10
~~~

Kiểm tra thêm mất một AZ và rolling update maxSurge.

## Xác minh

- So forecast với 4-8 tuần dữ liệu thực và peak event.
- Load test tại cấu hình replica/node.
- Mô phỏng mất AZ và rollout.
- Kiểm tra AWS Service Quotas, subnet IP và thời gian cấp capacity.
- Ước tính chi phí baseline, peak và growth.

| Kết quả | Nội dung |
| --- | --- |
| **Expected** | Giữ SLO tại peak dự báo và một failure scenario đã chọn. |
| **Measured** | Chưa có dữ liệu. Điền RPS/replica, headroom, quota, node count và chi phí. |

## Troubleshooting và production

- HPA scale nhưng Pending: thiếu node, quota, subnet IP hoặc constraint.
- RDS hết connection trước CPU: dùng pool/proxy và giới hạn concurrency.
- Forecast sai mùa vụ: dùng percentile và scenario, không chỉ average.
- Review capacity hàng tháng và trước campaign/release lớn.
