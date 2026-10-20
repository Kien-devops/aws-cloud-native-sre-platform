# 04. Luồng request của ứng dụng

## Mục tiêu

Mô tả giao dịch ReliabilityShop xuyên qua API Gateway, Auth, Order, Inventory, PostgreSQL, Redis và SQS. Luồng này là cơ sở để định nghĩa SLI và kiểm tra liên kết metrics, logs, traces.

## Luồng đồng bộ

```text
Client -> API Gateway -> Auth
                    -> Order -> Inventory
                             -> PostgreSQL
                             -> Redis nếu có
```

1. Client gửi request; SDK tạo hoặc tiếp nhận `traceparent`.
2. API Gateway kiểm tra route và chuyển trace context.
3. Auth xác thực token nhưng không ghi token vào log.
4. Order kiểm tra idempotency key, gọi Inventory và ghi transaction cần thiết.
5. Response chỉ thành công khi điều kiện nghiệp vụ bắt buộc hoàn tất.

## Luồng bất đồng bộ

```text
Order -> SQS -> Payment Worker -> Payment dependency
          |          |
       queue age  retry/DLQ
```

Producer xử lý timeout và duplicate. Consumer phải idempotent, có visibility timeout phù hợp, DLQ và metric tuổi message cũ nhất.

## Dữ liệu quan sát

- HTTP method, route chuẩn hóa, status, service version và latency histogram.
- `trace_id`, `span_id` và correlation ID không chứa secret.
- DB query duration, pool usage, queue depth/age và retry count.
- Kết quả nghiệp vụ: order accepted, rejected, duplicated hoặc failed.

## Verification

```bash
curl -i https://<host>/health
curl -i -H 'Idempotency-Key: test-001' https://<host>/orders
```

**Expected:** response đúng contract, trace đi qua Order và dependency, log có correlation fields. URL và payload là minh họa.

## Troubleshooting

- 401/403: issuer, audience, clock skew và route policy.
- 5xx khi DB chậm: trace span, pool exhaustion, locks và retry storm.
- Message duplicate: idempotency, ack timing và visibility timeout.
- Trace đứt ở SQS: truyền correlation metadata phù hợp qua message.

## Production considerations

Timeout nhỏ hơn deadline caller; retry có giới hạn và jitter. Schema migration tương thích ngược. Cần rate limit, validation, PII redaction, DLQ replay procedure và transaction boundary rõ ràng.
