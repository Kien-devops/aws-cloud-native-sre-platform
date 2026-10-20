# Kỹ thuật resilience

Resilience là khả năng tiếp tục cung cấp giá trị, suy giảm có kiểm soát và phục hồi khi component lỗi.

## 1. Failure model của ReliabilityShop

~~~text
Client -> ALB -> API Gateway -> Order Service -> RDS
                                |       |
                                |       +-> Redis
                                +-> SQS -> Order Worker -> Payment
~~~

| Failure | Thiết kế phản ứng |
| --- | --- |
| Một Pod/AZ lỗi | Replica trải nhiều AZ, PDB và topology spread |
| Payment chậm | Timeout, circuit breaker, idempotency, trạng thái pending |
| RDS failover | Connection retry có jitter, pool giới hạn, health check |
| Redis lỗi | Cache miss về nguồn dữ liệu; không làm mất tính đúng |
| SQS backlog | KEDA scale worker, DLQ, age-of-oldest-message alert |

## 2. Pattern chính

- Timeout giảm dần theo request path; downstream timeout nhỏ hơn upstream.
- Retry chỉ cho lỗi transient, có exponential backoff và jitter.
- Retry budget ngăn retry storm; không retry thao tác không idempotent.
- Bulkhead tách pool/thread/queue giữa luồng critical và non-critical.
- Load shedding trả lỗi nhanh khi quá tải thay vì làm sập toàn hệ thống.
- Idempotency key bảo vệ tạo đơn và thanh toán khỏi xử lý lặp.

## 3. HA và DR

Multi-AZ xử lý lỗi AZ, không tự động giải quyết lỗi logic, xóa dữ liệu hoặc lỗi region. RTO/RPO phải gắn với backup, replication và bài restore đã đo. Không gọi kiến trúc là multi-region ready nếu chưa có routing, data consistency, failover/failback và diễn tập.

## 4. Xác minh

1. Lập baseline SLI, latency và saturation.
2. Chèn một fault có giới hạn trong staging.
3. Quan sát client, service, dependency và recovery.
4. Xác minh dữ liệu: không mất/nhân đôi order.
5. Rollback fault, lưu evidence và action.

| Kết quả | Nội dung |
| --- | --- |
| **Expected** | Mất một Pod không làm gián đoạn journey; Payment timeout chuyển order sang trạng thái có thể khôi phục. |
| **Measured** | Chưa có phép đo. Ghi fault, blast radius, SLI, recovery time và data check. |

## 5. Troubleshooting và production

- Retry làm latency tăng: giảm attempt, thêm jitter, kiểm tra retry nhiều tầng.
- PDB chặn node drain: so replica, maxUnavailable và capacity còn lại.
- Multi-AZ nhưng Pod cùng AZ: kiểm tra topology spread và node group.
- Recovery application nhưng dữ liệu sai: thêm invariant/conciliation test.
- Mọi resilience control đều có cost và complexity; ưu tiên theo failure mode thực tế.
