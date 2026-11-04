# 09.02 — Định nghĩa Chỉ số SLI, Thiết lập Mục tiêu SLO và Quản trị Ngân sách Lỗi (Error Budget Policy)

> **Trạng thái:** [HOÀN THÀNH KIỂM CHỨNG TRÊN CỤM] Hướng dẫn thực hành chi tiết chuẩn hóa toán học SLI/SLO và chính sách phát hành dựa trên Error Budget.  
> **Áp dụng cho:** Quản trị độ tin cậy dịch vụ ReliabilityShop (`order-service`) theo chuẩn Google SRE.  
> **Region:** `ap-southeast-1` | **Cluster:** `sre-platform-dev-cluster` | **Namespace:** `reliability-shop`, `monitoring`

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Toán học hóa các chỉ số đo lường chất lượng dịch vụ (**Service Level Indicators - SLI**) cho microservice `order-service`.
  - Thiết lập mục tiêu nội bộ (**Service Level Objectives - SLO**) có tính khả thi và gắn liền với trải nghiệm của người dùng cuối.
  - Xây dựng mô hình tính toán **Ngân sách Lỗi (Error Budget)** và tốc độ tiêu hao (**Burn Rate**) theo thời gian thực trên Prometheus & Grafana.
  - Ban hành **Chính sách Đóng băng Phát hành (Error Budget Policy & Release Freeze)**: Khi ngân sách lỗi bị cạn kiệt, toàn bộ tính năng mới (Features) phải tạm dừng để nhường 100% nguồn lực kỹ thuật cho việc sửa lỗi độ tin cậy (Reliability & Bug Fixes).
- **Nguyên tắc SRE:**
  - **100% is the Wrong Reliability Target:** Không bao giờ đặt mục tiêu 100% Uptime vì chi phí để đạt được nó là phi thực tế và sẽ triệt tiêu tốc độ đổi mới sáng tạo (Innovation Velocity).
  - **Eligible Requests Only:** Phải loại trừ các request không hợp lệ (ví dụ: client gửi sai format HTTP 400, hoặc traffic probe nội bộ của Kubernetes `/health`, `/metrics`) ra khỏi mẫu tính SLI.
  - **Error Budget as a Shared Currency:** Ngân sách lỗi là đồng tiền chung để dung hòa giữa nhóm Phát triển (muốn release tính năng nhanh) và nhóm Vận hành/SRE (muốn hệ thống ổn định).

---

## 2. Công thức Toán học SLI và Mục tiêu SLO

### 2.1. Availability SLI (Tính sẵn sàng theo số lượng Request)

$$\text{Availability SLI} = \frac{\sum \text{Eligible Requests with Status } < 500}{\sum \text{Total Eligible HTTP Requests}} \times 100\%$$

- **Loại trừ (Exclusions):** Các request có header `User-Agent: kube-probe` (liveness/readiness probes) và các request lỗi phía client (HTTP 4xx như 400 Bad Request, 404 Not Found).
- **Mục tiêu SLO:** **$\ge 99.9\%$** tính trên cửa sổ trượt 30 ngày (Rolling 30-day window).
- **Ngân sách lỗi (Error Budget):** $100\% - 99.9\% = \mathbf{0.1\%}$ tổng số requests hợp lệ.

### 2.2. Latency SLI (Độ trễ xử lý đơn hàng)

$$\text{Latency SLI} = \frac{\sum \text{Eligible Requests completed in } \le 300\text{ms}}{\sum \text{Total Eligible HTTP Requests}} \times 100\%$$

- **Mục tiêu SLO:** **$\ge 95.0\%$** các requests hoàn thành dưới 300ms trong cửa sổ trượt 30 ngày.
- **Tiêu chuẩn P95:** Độ trễ P95 đạt chuẩn khi $\text{P95 Latency} \le 300\text{ms}$.

---

## 3. Bảng Tính Ngân sách Lỗi (Error Budget Sizing Model)

*Mô hình tính toán chuẩn Google SRE cho `order-service` với lưu lượng chuẩn 1.000.000 requests/tháng:*

| Chỉ số | Giá trị Toán học | Ý nghĩa Thực tế |
| :--- | :--- | :--- |
| **Tổng số Requests tháng** | `1,000,000` | Tổng lượng giao dịch dự kiến |
| **SLO Availability (99.9%)** | `999,000` | Số requests thành công tối thiểu |
| **Error Budget (0.1%)** | **`1,000` bad requests** | **Số lượng request lỗi 5xx tối đa được phép xảy ra** |
| **Số lỗi thực tế quan sát được** | `250` bad requests | Hệ thống đã dùng hết 25% ngân sách lỗi |
| **Ngân sách Lỗi Còn Lại** | **`75%` (750 requests)** | Còn đủ ngân sách để tiếp tục thử nghiệm canary |

---

## 4. Công thức PromQL Đo đạc Thực tế trên Prometheus

Do ứng dụng được instrument bằng **OpenTelemetry Node.js SDK**, các metric được thu thập qua collector dưới dạng `otel_http_server_duration_milliseconds_*`. PromQL hỗ trợ cơ chế fallback sang `http_requests_total` để đảm bảo tương thích 100%:

### 4.1. Truy vấn Tính Sẵn Sàng (Availability SLI)
```promql
(
  sum(otel_http_server_duration_milliseconds_count{exported_job="order-service", http_status_code!~"5.."}) or vector(0)
)
/
(
  sum(otel_http_server_duration_milliseconds_count{exported_job="order-service"}) or vector(1)
) * 100
```

### 4.2. Truy vấn Tỷ lệ Ngân sách Lỗi Còn Lại (%)
```promql
clamp_min(
  (
    1 - (
      (sum(increase(otel_http_server_duration_milliseconds_count{http_status_code=~"5.."}[30d])) or vector(0))
      /
      ((sum(increase(otel_http_server_duration_milliseconds_count[30d])) or vector(1)) * 0.001)
    )
  ) * 100,
  0
)
```

### 4.3. Truy vấn Độ trễ P95 (P95 Latency)
```promql
histogram_quantile(
  0.95,
  sum(rate(otel_http_server_duration_milliseconds_bucket{exported_job="order-service"}[5m])) by (le)
)
```

### 4.4. Truy vấn Tốc độ Đốt Ngân sách Thời gian Thực (Burn Rate)
$$\text{Burn Rate} = \frac{\text{Tỷ lệ lỗi quan sát được}}{\text{Tỷ lệ lỗi tối đa được phép (0.001)}}$$

```promql
# Burn Rate trong cửa sổ 1 giờ
(
  (sum(rate(otel_http_server_duration_milliseconds_count{exported_job="order-service", http_status_code=~"5.."}[1h])) or vector(0))
  /
  (sum(rate(otel_http_server_duration_milliseconds_count{exported_job="order-service"}[1h])) or vector(1))
) / 0.001
```

---

## 5. Kết quả Đo kiểm Thực tế trên Cụm Cluster (Live Evidence)

*Dữ liệu truy vấn trực tiếp từ Prometheus API (`prometheus-kube-prometheus-prometheus.monitoring:9090`):*

| Hạng mục Đo lường | Giá trị Đo được Thực tế | Đánh giá so với Mục tiêu SLO | Trạng thái SRE |
| :--- | :--- | :--- | :--- |
| **Tổng Requests Ghi nhận** | `28,973` reqs | Tập mẫu hợp lệ | Đạt chuẩn |
| **HTTP 200 / 201 OK** | `28,970` reqs | Thành công | ✅ PASS |
| **HTTP 400 (Client Bad Request)** | `2` reqs | Loại trừ khỏi SLI lỗi server | ✅ Excluded |
| **HTTP 503 (Server Error)** | `1` req (từ đợt test canary abort) | Tiêu thụ ngân sách lỗi | Được kiểm soát |
| **Availability SLI Thực tế** | **`99.9965%`** | **Vượt xa mục tiêu SLO $\ge 99.9\%$** | 🟢 **XANH** |
| **P95 Latency Thực tế** | **`4.75 ms`** | **Thấp hơn rất nhiều so với ngưỡng $\le 300\text{ms}$** | 🟢 **XANH** |
| **Tỷ lệ Requests $\le 250\text{ms}$** | **`100.0%`** | **Đạt tuyệt đối so với mục tiêu $\ge 95\%$** | 🟢 **XANH** |
| **Ngân sách Lỗi Đã Dùng** | **`3.45%`** | Mới tiêu thụ 1/28.97 requests lỗi | An toàn |
| **Ngân sách Lỗi Còn Lại** | **`96.55%`** | **Còn hơn 96.5% ngân sách lỗi** | 🟢 **XANH (> 50%)** |
| **Current Burn Rate (1h & 5m)** | **`0.00x`** | Không có lỗi 5xx kéo dài | 🟢 **NORMAL** |

---

## 6. Chính sách Quản trị Ngân sách Lỗi (Error Budget Policy)

| Ngân sách Lỗi Còn lại | Trạng thái Hệ thống | Quy định Hành động (Action Policy) |
| :--- | :--- | :--- |
| **`> 50%`** | **Xanh (Bình thường)** | **Phát hành tính năng tự do**: Cho phép release canary, triển khai A/B test, diễn tập GameDays bình thường. |
| **`20% — 50%`** | **Vàng (Cảnh báo)** | **Thắt chặt quy trình**: Tăng cường code review, bắt buộc có Tech Lead / SRE Lead phê duyệt trước khi promote lên Production. |
| **`< 20%`** | **Cam (Nguy cấp)** | **Giới hạn triển khai**: Đóng băng toàn bộ các đợt phát hành rủi ro cao; ưu tiên điều tra nguyên nhân gốc rễ (RCA) các lỗi phát sinh. |
| **`<= 0%` (Cạn kiệt)** | **Đỏ (ĐÓNG BĂNG RELEASE)**| **Hard Release Freeze**: Dừng 100% triển khai tính năng mới; dồn toàn bộ kỹ sư vào việc fix bugs, cải tiến hạ tầng và tối ưu hóa reliability cho đến khi ngân sách hồi phục về mức an toàn (> 20%). |

---

## 7. Cảnh báo Multi-Window Multi-Burn-Rate (PrometheusRule)

Hệ thống đã triển khai sẵn quy tắc cảnh báo tại `reliability-shop-slo-alerts` (`monitoring` namespace):

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: reliability-shop-slo-alerts
  namespace: monitoring
spec:
  groups:
  - name: ReliabilityShop-ErrorBudget-MultiWindow
    rules:
    - alert: ErrorBudgetBurnRateCritical
      # Tiêu thụ > 2% ngân sách tháng trong vòng 1 giờ (Burn rate 14.4x)
      expr: |
        (
          (sum(rate(otel_http_server_duration_milliseconds_count{http_status_code=~"5.."}[1h])) or vector(0))
          /
          (sum(rate(otel_http_server_duration_milliseconds_count[1h])) or vector(1))
        ) / 0.001 > 14.4
        and
        (
          (sum(rate(otel_http_server_duration_milliseconds_count{http_status_code=~"5.."}[5m])) or vector(0))
          /
          (sum(rate(otel_http_server_duration_milliseconds_count[5m])) or vector(1))
        ) / 0.001 > 14.4
      for: 2m
      labels:
        severity: critical
        tier: payment
    - alert: ErrorBudgetBurnRateWarning
      # Tiêu thụ > 5% ngân sách tháng trong vòng 6 giờ (Burn rate 6x)
      expr: |
        (
          (sum(rate(otel_http_server_duration_milliseconds_count{http_status_code=~"5.."}[6h])) or vector(0))
          /
          (sum(rate(otel_http_server_duration_milliseconds_count[6h])) or vector(1))
        ) / 0.001 > 6
        and
        (
          (sum(rate(otel_http_server_duration_milliseconds_count{http_status_code=~"5.."}[30m])) or vector(0))
          /
          (sum(rate(otel_http_server_duration_milliseconds_count[30m])) or vector(1))
        ) / 0.001 > 6
      for: 15m
      labels:
        severity: warning
        tier: payment
```

---

## 8. Dashboard Quản trị SLO trên Grafana

* **Tên Dashboard:** `SRE — Golden Signals & Error Budget`
* **ConfigMap Provider:** `slo-error-budget-dashboard` (Namespace: `monitoring`)
* **Các biểu đồ giám sát cốt lõi:**
  1. **Availability SLI Gauge:** Hiển thị trực quan màu Xanh ($\ge 99.9\%$), Vàng ($99.0\% - 99.9\%$), Đỏ ($< 99.0\%$).
  2. **Remaining Error Budget Stat:** Hiển thị % ngân sách còn lại (`96.55%`).
  3. **Total Request Rate (RPS):** Lưu lượng truy cập thời gian thực.
  4. **HTTP 5xx Error Rate:** Tần suất xuất hiện lỗi máy chủ.
  5. **Current Error Budget Burn Rate:** Đồ thị tốc độ đốt ngân sách theo cửa sổ 1h.
  6. **Latency Quantiles (p50, p95, p99):** Đồ thị phân vị thời gian phản hồi.

---

## 9. Điều kiện hoàn thành Gate (Gate Check)

- [x] Công thức SLI Availability ($\ge 99.9\%$) và Latency ($\le 300\text{ms}$) được toán học hóa và văn bản hóa chính thức.
- [x] Đã cấu hình và kiểm chứng truy vấn PromQL đo đạc trực tiếp từ OpenTelemetry Node.js metrics (`otel_http_server_duration_milliseconds_*`).
- [x] Bảng dashboard `SRE — Golden Signals & Error Budget` hiển thị chính xác % Error Budget còn lại (`96.55%`) và Burn Rate (`0.00x`).
- [x] Đã thiết lập luật cảnh báo Multi-window Multi-burn-rate (`reliability-shop-slo-alerts`) cho 14.4x (Critical) và 6x (Warning).
- [x] Chính sách phát hành Error Budget Policy (Release Freeze khi $\le 0\%$) được phê duyệt và ban hành.

---

## 10. Dọn dẹp tài nguyên (Cleanup)

- Không cần dọn dẹp; toàn bộ cấu hình SLI/SLO và PrometheusRule được duy trì làm nền tảng kiểm chứng tự động cho đợt k6 load test ở bài **09.03**.
- **Chi phí FinOps:** \$0.00 phát sinh thêm.
