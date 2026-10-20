# 09.02 — Định nghĩa Chỉ số SLI, Thiết lập Mục tiêu SLO và Quản trị Ngân sách Lỗi (Error Budget Policy)

> **Trạng thái:** Hướng dẫn thực hành chi tiết chuẩn hóa toán học SLI/SLO và chính sách phát hành dựa trên Error Budget.  
> **Áp dụng cho:** Quản trị độ tin cậy dịch vụ ReliabilityShop theo chuẩn Google SRE.

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Toán học hóa các chỉ số đo lường chất lượng dịch vụ (**Service Level Indicators - SLI**) cho microservice `order-service`.
  - Thiết lập mục tiêu nội bộ (**Service Level Objectives - SLO**) có tính khả thi và gắn liền với trải nghiệm của người dùng cuối.
  - Xây dựng mô hình tính toán **Ngân sách Lỗi (Error Budget)** và tốc độ tiêu hao (**Burn Rate**) theo thời gian thực trên Prometheus.
  - Ban hành **Chính sách Đóng băng Phát hành (Error Budget Policy & Release Freeze)**: Khi ngân sách lỗi bị cạn kiệt, toàn bộ tính năng mới (Features) phải tạm dừng để nhường 100% nguồn lực kỹ thuật cho việc sửa lỗi độ tin cậy (Reliability & Bug Fixes).
- **Nguyên tắc SRE:**
  - **100% is the Wrong Reliability Target:** Không bao giờ đặt mục tiêu 100% Uptime vì chi phí để đạt được nó là phi thực tế và sẽ triệt tiêu tốc độ đổi mới sáng tạo (Innovation Velocity).
  - **Eligible Requests Only:** Phải loại trừ các request không hợp lệ (ví dụ: client gửi sai format HTTP 400, hoặc traffic probe nội bộ của Kubernetes `/health`) ra khỏi mẫu tính SLI.
  - **Error Budget as a Shared Currency:** Ngân sách lỗi là đồng tiền chung để dung hòa giữa nhóm Phát triển (muốn release tính năng nhanh) và nhóm Vận hành/SRE (muốn hệ thống ổn định).

---

## 2. Công thức Toán học SLI và Mục tiêu SLO

### 2.1. Availability SLI (Tính sẵn sàng theo số lượng Request)

$$\text{Availability SLI} = \frac{\sum \text{Eligible Requests with Status } < 500}{\sum \text{Total Eligible HTTP Requests}} \times 100\%$$

- **Loại trừ (Exclusions):** Các request có header `User-Agent: kube-probe` (liveness/readiness probes) và các request tới endpoint `/health`, `/ready`, `/metrics`.
- **Mục tiêu SLO:** **$\ge 99.9\%$** tính trên cửa sổ trượt 30 ngày (Rolling 30-day window).
- **Ngân sách lỗi (Error Budget):** $100\% - 99.9\% = \mathbf{0.1\%}$ tổng số requests hợp lệ.

### 2.2. Latency SLI (Độ trễ xử lý đơn hàng)

$$\text{Latency SLI} = \frac{\sum \text{Eligible Requests completed in } \le 300\text{ms}}{\sum \text{Total Eligible HTTP Requests}} \times 100\%$$

- **Mục tiêu SLO:** **$\ge 95.0\%$** các requests hoàn thành dưới 300ms trong cửa sổ trượt 30 ngày.

---

## 3. Bảng Tính Ngân sách Lỗi (Error Budget Sizing Model)

*Giả định hệ thống tiếp nhận trung bình 1.000.000 requests mỗi tháng:*

| Chỉ số | Giá trị Toán học | Ý nghĩa Thực tế |
| :--- | :--- | :--- |
| **Tổng số Requests tháng** | `1,000,000` | Tổng lượng giao dịch dự kiến |
| **SLO Availability (99.9%)** | `999,000` | Số requests thành công tối thiểu |
| **Error Budget (0.1%)** | **`1,000` bad requests** | **Số lượng request lỗi 5xx tối đa được phép xảy ra** |
| **Số lỗi thực tế quan sát được** | `250` bad requests | Hệ thống đã dùng hết 25% ngân sách lỗi |
| **Ngân sách Lỗi Còn Lại** | **`75%` (750 requests)** | Còn đủ ngân sách để tiếp tục thử nghiệm canary |

---

## 4. Công thức PromQL Đo đạc và Cảnh báo Burn Rate

### 4.1. Truy vấn Tỷ lệ Ngân sách Lỗi Còn Lại (%)
```sql
(
  1 - (
    sum(increase(http_requests_total{service="order-service", status=~"5.."}[30d]))
    /
    (sum(increase(http_requests_total{service="order-service"}[30d])) * 0.001)
  )
) * 100
```

### 4.2. Truy vấn Tốc độ Đốt Ngân sách Thời gian Thực (Burn Rate)
$$\text{Burn Rate} = \frac{\text{Tỷ lệ lỗi quan sát được}}{\text{Tỷ lệ lỗi tối đa được phép (0.001)}}$$

```sql
# Burn Rate trong cửa sổ 1 giờ
(
  sum(rate(http_requests_total{service="order-service", status=~"5.."}[1h]))
  /
  sum(rate(http_requests_total{service="order-service"}[1h]))
) / 0.001
```

---

## 5. Chính sách Quản trị Ngân sách Lỗi (Error Budget Policy)

| Ngân sách Lỗi Còn lại | Trạng thái Hệ thống | Quy định Hành động (Action Policy) |
| :--- | :--- | :--- |
| **`> 50%`** | **Xanh (Bình thường)** | Phát hành tính năng tự do, thử nghiệm canary, chạy GameDays. |
| **`20% — 50%`** | **Vàng (Cảnh báo)** | Tăng cường review PR, bắt buộc có Tech Lead phê duyệt trước khi promote lên prod. |
| **`< 20%`** | **Cam (Nguy cấp)** | Đóng băng toàn bộ các đợt phát hành rủi ro cao; ưu tiên phân tích các nguyên nhân gây lỗi. |
| **`<= 0%` (Cạn kiệt)** | **Đỏ (ĐÓNG BĂNG RELEASE)**| **Hard Freeze:** Dừng 100% triển khai tính năng mới; dồn toàn bộ kỹ sư vào việc fix bugs, cải tiến hạ tầng và tối ưu hóa reliability cho đến khi ngân sách hồi phục. |

---

## 6. Điều kiện hoàn thành Gate (Gate Check)

- [ ] Công thức SLI Availability và Latency được văn bản hóa chính thức.
- [ ] Bảng dashboard trên Grafana hiển thị chính xác % Error Budget còn lại.
- [ ] Nhóm kỹ thuật và Product Manager ký duyệt cam kết tuân thủ Error Budget Policy.

---

## 7. Dọn dẹp tài nguyên (Cleanup)

- Không dọn dẹp; các công thức này là bộ khung pháp lý và kỹ thuật phục vụ việc đánh giá kết quả k6 ở bài 09.03.
