# Performance engineering với k6

## Mục tiêu và loại test

Đo giới hạn theo SLO, không chỉ tạo tải.

| Test | Mục tiêu |
| --- | --- |
| Smoke | Kiểm tra script và luồng |
| Load | Xác minh tải dự kiến |
| Stress | Tìm saturation và điểm gãy |
| Spike | Kiểm tra tăng tải đột ngột |
| Soak | Tìm leak, queue buildup và degradation |

~~~text
k6 -> ALB -> ReliabilityShop -> RDS/Redis/SQS
 |                 |
 + client metrics  + OTel/Prometheus/traces
~~~

## Script k6

~~~javascript
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 20,
  duration: '10m',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

export default function () {
  const res = http.get(String(__ENV.BASE_URL) + '/api/products');
  check(res, { 'status 200': (r) => r.status === 200 });
}
~~~

Không hard-code token; dùng test account và secret injection. Dữ liệu tạo đơn cần unique và cleanup.

## Phương pháp

1. Warm-up, cố định version và cấu hình.
2. Chạy smoke rồi tăng tải có kiểm soát.
3. Đo client latency cùng CPU throttling, memory, GC, DB pool, cache hit và queue age.
4. Mỗi lần chỉ thay một biến; chạy lặp để thấy variance.
5. Dừng khi error, latency hoặc data risk vượt giới hạn.

| Kết quả | Nội dung |
| --- | --- |
| **Expected** | Tải mục tiêu đạt p95 < 500 ms, lỗi < 1%, saturation trong guardrail. |
| **Measured** | Chưa benchmark. Ghi commit SHA, region, node type, dataset, k6 output và dashboard. |

## Troubleshooting và production

- Client hết CPU/port: chạy distributed generator và đo máy phát tải.
- p99 cao CPU thấp: xem DB lock, pool, retry, network và trace.
- Throughput không tăng khi thêm Pod: tìm bottleneck tại DB, queue hoặc load balancer.
- Cache làm kết quả giả: mô tả hit ratio và dataset.
- Không load test production nếu chưa có window, giới hạn chi phí, owner và stop condition.
