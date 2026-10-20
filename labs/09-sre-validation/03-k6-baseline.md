# 09.03 — Kiểm thử Tải Toàn diện với Grafana k6 và Thiết lập Số liệu Cơ sở (Baseline Performance)

> **Trạng thái:** Hướng dẫn thực hành chi tiết 5 hồ sơ kiểm thử hiệu năng (k6 Profiles) và thiết lập đường chuẩn (Baseline).  
> **Áp dụng cho:** Đo đạc thông lượng (Throughput RPS), độ trễ phân vị (p50/p95/p99) và kiểm chứng giới hạn tải của nền tảng EKS.

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Thực thi bộ **5 kịch bản kiểm thử tải bằng Grafana k6**:
    1. **Smoke Test:** Tải tối thiểu (5 VUs trong 1 phút) để kiểm tra script.
    2. **Load Test:** Tải vận hành kỳ vọng (50 VUs trong 10 phút) để đo đạc chỉ số ổn định (Steady State).
    3. **Stress Test:** Tải tăng dần (từ 50 lên 150 VUs) để tìm điểm gãy đổ (Breaking Point) của hệ thống.
    4. **Spike Test:** Tăng vọt tức thì (từ 0 lên 200 VUs trong 10 giây) để kiểm chứng tốc độ phản ứng của HPA và Karpenter.
    5. **Soak Test:** Tải duy trì dài hạn (30 VUs trong 2 giờ) để phát hiện rò rỉ bộ nhớ (Memory Leaks) hoặc cạn kiệt Connection Pool của Database.
  - Thiết lập **Bảng Số liệu Cơ sở (Baseline Scorecard)** để so sánh khách quan trước và sau khi tối ưu hóa hạ tầng.
- **Nguyên tắc SRE:**
  - **No Anecdotal Performance (Không khẳng định hiệu năng bằng cảm tính):** Mọi tuyên bố về khả năng chịu tải phải được chứng minh bằng biểu đồ k6 thực tế, có số lượng Virtual Users (VUs) và phân vị độ trễ cụ thể.
  - **Tail Latency Matters (p99 quan trọng hơn trung bình):** Thời gian đáp ứng trung bình (Average) thường che giấu các vấn đề nghiêm trọng; SRE tập trung giám sát phân vị **p95** và **p99** để bảo vệ nhóm người dùng bị ảnh hưởng nặng nề nhất.
  - **Closed-Loop Measurement:** Trong lúc k6 phát tải, phải đồng thời quan sát CPU/Memory trên EKS Nodes, RDS CPU & Connections trên AWS Console để tìm ra chính xác nút thắt cổ chai (Bottleneck).

---

## 2. Kịch bản Kiểm thử k6 Đầy đủ (`performance/k6/sre-load-test.js`)

Tạo file k6 script hoàn chỉnh:

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

// 1. CẤU HÌNH CÁC NGƯỠNG KIỂM TRA SLO (THRESHOLDS)
export const options = {
  stages: [
    { duration: '2m', target: 20 },  // Ramp-up lên 20 VUs
    { duration: '5m', target: 50 },  // Duy trì tải ổn định 50 VUs (Load Test)
    { duration: '2m', target: 120 }, // Đẩy lên tải cực đại 120 VUs (Stress Test)
    { duration: '2m', target: 0 },   // Ramp-down về 0
  ],
  thresholds: {
    // SLO 1: 95% requests phải hoàn tất dưới 300ms
    http_req_duration: ['p(95)<300', 'p(99)<600'],
    // SLO 2: Tỷ lệ lỗi HTTP 5xx phải dưới 0.1%
    http_req_failed: ['rate<0.001'],
  },
};

const BASE_URL = 'https://shop.dev.sreplatform.yourdomain.com';

export default function () {
  // GIAO DỊCH 1: XEM DANH MỤC SẢN PHẨM (READ HEAVY - HIT CACHE)
  let resCatalog = http.get(`${BASE_URL}/api/v1/products`);
  check(resCatalog, {
    'Catalog status is 200': (r) => r.status === 200,
    'Catalog response < 100ms': (r) => r.timings.duration < 100,
  });

  sleep(1);

  // GIAO DỊCH 2: TẠO ĐƠN HÀNG (WRITE HEAVY - HIT DB & SQS)
  const payload = JSON.stringify({
    customer_id: `user-${__VU}`,
    item_id: 'item-dev-cloud',
    quantity: 1,
    price: 49.99,
  });

  const params = {
    headers: { 'Content-Type': 'application/json' },
  };

  let resOrder = http.post(`${BASE_URL}/api/v1/orders`, payload, params);
  check(resOrder, {
    'Order created 201': (r) => r.status === 201,
    'Order response < 300ms': (r) => r.timings.duration < 300,
  });

  sleep(2);
}
```

---

## 3. Các bước Thực hiện và Quan sát (Execution Steps)

### Bước 1: Khởi chạy Kiểm thử Tải từ Terminal

```bash
# Cài đặt k6 nếu chưa có (hoặc chạy qua Docker container)
docker run --rm -i grafana/k6:latest run - < performance/k6/sre-load-test.js
```

### Bước 2: Quan sát Thời gian Thực trên AWS Console và Grafana

1. **Mở Grafana Dashboard (`http://localhost:3000`):**
   - Theo dõi biểu đồ **RPS (Throughput):** Quan sát số lượng request tăng dần từ 10 RPS lên 150+ RPS.
   - Theo dõi biểu đồ **Latency Quantiles:** Quan sát đường p95 và p99 có bị vọt lên vượt ngưỡng 300ms hay không.
2. **Mở AWS Management Console -> EC2 -> Target Groups:**
   - Quan sát số lượng targets trong Target Group tăng từ 2 lên 6-8 pods khi HPA kích hoạt.
3. **Mở Amazon RDS Console -> Performance Insights:**
   - Quan sát chỉ số **DB Load (AAS):** Đảm bảo AAS không vượt qua đường kẻ đỏ (vCPU capacity).
   - Kiểm tra xem câu lệnh SQL `INSERT INTO orders` mất bao nhiêu mili-giây.

---

## 4. Bảng Số liệu Cơ sở Đo đạc Thực tế (Baseline Scorecard)

*Sau khi k6 hoàn thành, lưu lại kết quả bảng tóm tắt vào hồ sơ lab:*

```text
=== SRE BASELINE PERFORMANCE SCORECARD ===
Test Tool:               Grafana k6 v0.51.0
Test Profile:            Combined Load & Stress Test (Peak 120 VUs)
Total Requests Executed: 48,520 requests
Test Duration:           11 minutes

--- GOLDEN SIGNALS MEASUREMENT ---
Throughput (Peak):       185.4 req/sec
Average Latency:         38.2 ms
p50 Latency (Median):    24.5 ms
p90 Latency:             78.1 ms
p95 Latency:             142.6 ms  (SLO Target: < 300 ms -> PASSED)
p99 Latency:             285.0 ms  (SLO Target: < 600 ms -> PASSED)
Failed Requests (5xx):   8 requests (Rate: 0.016% -> PASSED < 0.1%)

--- INFRASTRUCTURE CAPACITY UTILIZATION ---
EKS Nodes Scaled:        From 2 to 4 nodes (Karpenter provisioned 2 spot instances)
order-service Pods:      From 2 to 7 pods (Scaled by HPA at 72% CPU)
RDS CPU Saturation:      Peak 42% (db.t4g.micro)
RDS DB Connections:      Peak 28 / Max 112 connections
Redis Memory Used:       18.4 MiB / 500 MiB (Hit ratio: 94.2%)

OVERALL ASSESSMENT:      BASELINE ESTABLISHED — MEETS ALL PRODUCTION SLOS
```

---

## 5. Điều kiện hoàn thành Gate (Gate Check)

- [ ] Kịch bản k6 thực thi thành công toàn bộ các stages mà không bị crash.
- [ ] Các ngưỡng kiểm thử (`p95 < 300ms`, `errors < 0.1%`) đều đạt tiêu chuẩn màu xanh.
- [ ] HPA tự động co giãn số lượng pods tương ứng với tải phát sinh.
- [ ] Bảng số liệu Baseline Scorecard được ghi nhận chính xác làm mốc đối chuẩn cho các bài thử nghiệm chèn lỗi ở Lab 09.04.

---

## 6. Dọn dẹp tài nguyên (Cleanup)

- Không cần dọn dẹp; hệ thống sẽ tự động scale-down số lượng pods về 2 sau 5 phút (kết thúc stabilization window).
