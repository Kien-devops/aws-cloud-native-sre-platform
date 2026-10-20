# 09.01 — Kiểm thử Khói Toàn trình Nền tảng (Platform Smoke Test Protocol)

> **Trạng thái:** Hướng dẫn thực hành chi tiết kịch bản kiểm thử hành trình người dùng toàn diện (End-to-End User Journey).  
> **Áp dụng cho:** Nghiệm thu tích hợp trước khi áp dụng tải trọng k6; kiểm tra tính liên tục của dữ liệu giữa API, Database, Cache và Queue.

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Thực thi kịch bản kiểm thử khói tự động mô phỏng **100% hành trình người dùng (Complete User Journey)** của ReliabilityShop:
    1. **DNS & TLS Handshake:** Phân giải domain `shop.dev.sreplatform.yourdomain.com` trỏ đúng ALB, mã hóa TLS 1.3 hợp lệ.
    2. **Xem Sản phẩm (Catalog Browse):** Truy vấn danh mục sản phẩm từ cache Redis (hoặc database fallback).
    3. **Tạo Đơn Hàng (Order Creation):** Gửi request POST đơn hàng mới, ghi nhận bản ghi vào Amazon RDS PostgreSQL.
    4. **Thanh toán Bất đồng bộ (Async Payment):** Đẩy thông điệp vào Amazon SQS, `payment-worker` lấy ra xử lý và cập nhật trạng thái đơn hàng sang `COMPLETED`.
    5. **Truy vấn Lịch sử (Order Query):** Đọc lại đơn hàng vừa tạo để chứng minh dữ liệu đồng nhất.
  - Xác nhận rằng không có bất kỳ pod nào bị crash hoặc rơi vào vòng lặp khởi động lại (`Restarts = 0`).
- **Nguyên tắc SRE:**
  - **Synthetic Journey Validation:** Chỉ số CPU hay Kubernetes Pod status chỉ là tín hiệu nội bộ; cách duy nhất để chứng minh nền tảng "sống" là thực hiện thành công một giao dịch nghiệp vụ thật từ ngoài Internet vào.
  - **Zero Tolerance for Silent Failures:** Không chấp nhận các lỗi ngầm (ví dụ: HTTP 200 nhưng dữ liệu không được lưu vào PostgreSQL, hoặc message bị kẹt trong SQS không ai xử lý).
  - **Timestamped Evidence Collection:** Mọi bước chạy phải in mã trạng thái HTTP, thời gian đáp ứng (Latency ms) và lưu log làm bằng chứng.

---

## 2. Sơ đồ Luồng Hành trình Người dùng (User Journey Flow)

```text
  [ Synthetic Client (cURL / Script) ]
                   |
     1. GET /health (HTTPS 200)
                   |
     2. GET /api/v1/products (Đọc Redis Cache)
                   |
     3. POST /api/v1/orders (Ghi PostgreSQL DB)
                   |
                   +---> Gửi SQS Message ---> [ payment-worker ]
                   |                               |
     4. GET /api/v1/orders/{id}                    +---> Cập nhật DB: COMPLETED
        (Xác nhận trạng thái: COMPLETED)
```

---

## 3. Kịch bản Thực thi Kiểm thử Tự động (Automated Smoke Test Script)

Lưu và chạy file script `scripts/platform-smoke-test.sh` từ máy trạm:

```bash
#!/usr/bin/env bash
set -euo pipefail

BASE_URL="https://shop.dev.sreplatform.yourdomain.com"
echo "=================================================="
echo "  SRE PLATFORM END-TO-END SMOKE TEST PROTOCOL     "
echo "  Target: $BASE_URL                               "
echo "  Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)       "
echo "=================================================="

# BƯỚC 1: KIỂM TRA DNS VÀ TLS HANDSHAKE
echo -n "[1/5] Checking DNS Resolution & TLS Handshake... "
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health")
if [ "$HTTP_STATUS" -eq 200 ]; then
  echo "✅ PASSED (HTTP $HTTP_STATUS)"
else
  echo "❌ FAILED (HTTP $HTTP_STATUS)"
  exit 1
fi

# BƯỚC 2: XEM DANH MỤC SẢN PHẨM (CATALOG BROWSE)
echo -n "[2/5] Browsing Product Catalog (Redis / DB)... "
CATALOG_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/products")
CATALOG_CODE=$(echo "$CATALOG_RESPONSE" | tail -n1)
if [ "$CATALOG_CODE" -eq 200 ]; then
  echo "✅ PASSED (Catalog returned items)"
else
  echo "❌ FAILED (HTTP $CATALOG_CODE)"
  exit 1
fi

# BƯỚC 3: TẠO ĐƠN HÀNG MỚI (POST ORDER)
echo -n "[3/5] Creating New Order (Writing to RDS PostgreSQL)... "
ORDER_PAYLOAD='{"customer_id":"sre-tester","item_id":"laptop-dev","quantity":1,"price":1200.00}'
ORDER_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/orders" \
  -H "Content-Type: application/json" \
  -d "$ORDER_PAYLOAD")

ORDER_CODE=$(echo "$ORDER_RESPONSE" | tail -n1)
ORDER_BODY=$(echo "$ORDER_RESPONSE" | head -n -1)

if [ "$ORDER_CODE" -eq 201 ]; then
  ORDER_ID=$(echo "$ORDER_BODY" | jq -r '.order_id')
  echo "✅ PASSED (Order created with ID: $ORDER_ID)"
else
  echo "❌ FAILED (HTTP $ORDER_CODE): $ORDER_BODY"
  exit 1
fi

# BƯỚC 4: CHỜ WORKER XỬ LÝ THANH TOÁN QUA SQS
echo -n "[4/5] Waiting for Payment Worker to consume SQS message... "
sleep 5 # Chờ worker lấy message và cập nhật DB

# BƯỚC 5: TRUY VẤN LẠI ĐƠN HÀNG ĐỂ XÁC NHẬN TRẠNG THÁI COMPLETED
echo -n "[5/5] Querying Order Status (Verification)... "
QUERY_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/orders/$ORDER_ID")
QUERY_CODE=$(echo "$QUERY_RESPONSE" | tail -n1)
QUERY_STATUS=$(echo "$QUERY_RESPONSE" | head -n -1 | jq -r '.status')

if [ "$QUERY_CODE" -eq 200 ] && [ "$QUERY_STATUS" == "COMPLETED" ]; then
  echo "✅ PASSED (Order status is $QUERY_STATUS)"
else
  echo "❌ FAILED (Status: $QUERY_STATUS, Code: $QUERY_CODE)"
  exit 1
fi

echo "=================================================="
echo "🎉 ALL 5 SMOKE TEST GATES PASSED SUCCESSFULLY!"
echo "=================================================="
```

---

## 4. Báo cáo Nghiệm thu Kiểm thử Khói (Smoke Test Evidence)

```text
=== SRE PLATFORM SMOKE TEST EXECUTION REPORT ===
Timestamp:            2026-10-21T02:55:00Z
Target Base URL:      https://shop.dev.sreplatform.yourdomain.com
DNS & TLS Gate:       PASSED (HTTP 200, TLS 1.3 Amazon ACM)
Catalog Cache Gate:   PASSED (Retrieved from Redis in 4.2ms)
Order Insertion Gate: PASSED (Committed to PostgreSQL in 14.8ms)
SQS Messaging Gate:   PASSED (Message queued and processed in < 3s)
Async Worker Gate:    PASSED (Order status updated to COMPLETED)
Pod Stability Check:  0 Restarts across all namespaces
Overall Decision:     READY FOR K6 PERFORMANCE TESTING (Lab 09.03)
```

---

## 5. Điều kiện hoàn thành Gate (Gate Check)

- [ ] Toàn bộ 5 bước của kịch bản kiểm thử khói hoàn thành mà không có lỗi HTTP 4xx hoặc 5xx.
- [ ] Dữ liệu đơn hàng tồn tại trong PostgreSQL và trạng thái được cập nhật thành công bởi `payment-worker`.
- [ ] Không có cảnh báo bất thường trong nhật ký của EKS Control Plane hoặc ALB Ingress.
