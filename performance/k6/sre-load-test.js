import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Ramp-up lên 10 VUs
    { duration: '1m', target: 30 },  // Duy trì tải 30 VUs (Load Test)
    { duration: '30s', target: 60 }, // Đẩy lên tải đỉnh 60 VUs (Stress Test)
    { duration: '30s', target: 0 },  // Ramp-down về 0
  ],
  thresholds: {
    // SLO 1: 95% requests hoàn tất dưới 300ms
    http_req_duration: ['p(95)<300', 'p(99)<600'],
    // SLO 2: Tỷ lệ lỗi HTTP 5xx dưới 0.1%
    http_req_failed: ['rate<0.001'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://order-service.reliability-shop.svc.cluster.local:8080';

export default function () {
  // GIAO DỊCH 1: XEM DANH SÁCH ĐƠN HÀNG (READ HEAVY - HIT REDIS CACHE)
  let resOrders = http.get(`${BASE_URL}/api/orders`);
  check(resOrders, {
    'GET /api/orders status is 200': (r) => r.status === 200,
    'GET /api/orders response < 300ms': (r) => r.timings.duration < 300,
  });

  sleep(0.5);

  // GIAO DỊCH 2: TẠO ĐƠN HÀNG MỚI (WRITE HEAVY - HIT POSTGRESQL & SQS)
  const id = `${__VU}-${__ITER}-${Date.now()}`;
  const payload = JSON.stringify({
    customer: `k6-user-${__VU}`,
    item: 'item-dev-cloud',
    quantity: 1,
    amount: 49.99,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': `k6-${id}`,
    },
  };

  let resCreate = http.post(`${BASE_URL}/api/orders`, payload, params);
  check(resCreate, {
    'POST /api/orders status is 201': (r) => r.status === 201,
    'POST /api/orders response < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}

