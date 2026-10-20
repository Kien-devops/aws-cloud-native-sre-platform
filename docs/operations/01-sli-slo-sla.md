# SLI, SLO và SLA cho ReliabilityShop

> Tài liệu thiết kế. Các con số là ví dụ; chỉ ghi **Measured** khi có dữ liệu thực kèm thời gian và nguồn đo.

## 1. Khái niệm

- **SLI:** chỉ số đo trải nghiệm thực tế, ví dụ tỷ lệ request thành công.
- **SLO:** mục tiêu nội bộ cho SLI trong một cửa sổ, ví dụ availability >= 99,9% trong 30 ngày.
- **SLA:** cam kết với khách hàng, thường có điều khoản bồi hoàn. SLA nên thấp hơn SLO để tạo biên vận hành.

~~~text
Người dùng -> ALB -> API Gateway -> Order Service -> RDS/SQS
     |                    |
     +--- kết quả HTTP ---+--> Prometheus --> SLI --> SLO --> Error budget
~~~

## 2. SLI theo request

~~~text
Availability = good requests / eligible requests
Latency SLI = requests <= ngưỡng / eligible requests
~~~

~~~promql
(
  sum(rate(http_server_requests_seconds_count{service="order",status_code!~"4..",route!="/health"}[30d]))
-
  sum(rate(http_server_requests_seconds_count{service="order",status_code=~"5..",route!="/health"}[30d]))
)
/
sum(rate(http_server_requests_seconds_count{service="order",status_code!~"4..",route!="/health"}[30d]))
~~~

## 3. SLO đề xuất

| User journey | SLI | SLO minh họa | Cửa sổ |
| --- | --- | --- | --- |
| Xem sản phẩm | Request thành công | 99,95% | Rolling 30 ngày |
| Tạo đơn hàng | Request thành công | 99,9% | Rolling 30 ngày |
| Thanh toán | Request thành công | 99,9% | Rolling 30 ngày |
| Tạo đơn hàng | Latency <= 500 ms | 99% | Rolling 30 ngày |

Không gộp mọi service thành một SLO. Cần chốt cách tính timeout, retry, 429, hủy request và lỗi dependency.

## 4. Xác minh

1. Ghi version ứng dụng, khoảng thời gian, traffic và PromQL.
2. So sánh metric server với ALB hoặc k6 để phát hiện thiếu dữ liệu.
3. Kiểm tra good <= eligible và mẫu số khác 0.
4. Lưu dashboard hoặc dữ liệu thô cùng timestamp UTC.

| Kết quả | Nội dung |
| --- | --- |
| **Expected** | SLO 99,9% cho phép khoảng 43 phút lỗi trong 30 ngày nếu đo liên tục. |
| **Measured** | Chưa có dữ liệu thực. Điền SLI, cửa sổ, datasource và evidence sau khi chạy. |

## 5. Troubleshooting và production

- SLI luôn 100%: kiểm tra timeout tại ALB hoặc request không tới Pod.
- Mẫu số tăng đột biến: kiểm tra health check, bot và route không nhận diện.
- Dashboard lệch k6: đồng bộ timezone, retry và mã trạng thái được tính.
- Không dùng user_id, order_id hoặc URL động làm label.
- Version hóa SLO như code; dùng recording rule cho truy vấn dài hạn.
- Không dùng CPU hoặc trạng thái Pod làm SLI chính cho trải nghiệm người dùng.
