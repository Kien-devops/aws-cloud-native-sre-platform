# Error budget và burn rate

## 1. Ngân sách lỗi

Với SLO availability 99,9%:

~~~text
Error budget = 1 - SLO = 0,1%
Budget 30 ngày = 30 x 24 x 60 x 0,001 = 43,2 phút
Budget request = eligible requests x (1 - SLO)
~~~

Burn rate cho biết tốc độ tiêu thụ budget:

~~~text
Burn rate = observed error rate / allowed error rate
~~~

SLO 99,9% có allowed error rate 0,001. Error rate 1% tạo burn rate 10 và có thể dùng hết budget 30 ngày trong khoảng 3 ngày.

## 2. Recording rule

~~~yaml
groups:
  - name: reliabilityshop-slo
    rules:
      - record: service:http_error_ratio:rate5m
        expr: |
          sum by (service) (rate(http_server_requests_seconds_count{status_code=~"5.."}[5m]))
          /
          sum by (service) (rate(http_server_requests_seconds_count[5m]))
      - record: service:slo_burn_rate:rate5m
        expr: service:http_error_ratio:rate5m / 0.001
~~~

## 3. Multi-window, multi-burn-rate

| Mức | Cửa sổ ngắn / dài | Burn rate | Hành động |
| --- | --- | --- | --- |
| Page nhanh | 5 phút / 1 giờ | 14,4 | Điều tra ngay |
| Page chậm | 30 phút / 6 giờ | 6 | Điều tra trong ca |
| Ticket | 2 giờ / 1 ngày | 3 | Lập kế hoạch sửa |
| Ticket chậm | 6 giờ / 3 ngày | 1 | Theo dõi xu hướng |

~~~promql
(service:http_error_ratio:rate5m{service="order"} / 0.001 > 14.4)
and
(service:http_error_ratio:rate1h{service="order"} / 0.001 > 14.4)
~~~

Với traffic thấp, thêm điều kiện số lỗi tối thiểu để một request không tạo page.

## 4. Chính sách phát hành

- Budget trên 50%: phát hành bình thường qua canary.
- Budget 20-50%: giảm tần suất, ưu tiên reliability.
- Budget dưới 20%: chỉ phát hành bản sửa lỗi hoặc thay đổi được phê duyệt.
- Budget cạn: đóng băng feature release tới khi owner xác nhận recovery.

## 5. Xác minh, troubleshooting

1. Tạo lỗi có kiểm soát trong test.
2. Đối chiếu error ratio với recording rule.
3. Kiểm tra cả cửa sổ ngắn và dài trước khi page.
4. Xác nhận Alertmanager route đúng và tự resolve.

| Kết quả | Nội dung |
| --- | --- |
| **Expected** | Lỗi 5xx liên tục làm burn rate vượt ngưỡng; alert chỉ firing khi cả hai cửa sổ thỏa. |
| **Measured** | Chưa đo. Ghi fault timeline, giá trị cửa sổ và notification evidence. |

- `NaN`: mẫu số bằng 0; thêm điều kiện traffic tối thiểu.
- Alert chập chờn: tăng `for`, kiểm tra scrape gap.
- Budget lệch dashboard: thống nhất SLO, timezone và eligible events.
- Không reset budget sau deploy; budget thuộc cửa sổ SLO.
- Tách SLO theo journey để traffic lớn không che lỗi service critical.
