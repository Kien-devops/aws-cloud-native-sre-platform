# Runbook và postmortem

## 1. Hai tài liệu khác nhau

- **Runbook:** hướng dẫn xử lý một triệu chứng đã biết, dùng trong incident.
- **Postmortem:** phân tích sau sự cố để tìm yếu tố hệ thống và ngăn tái diễn.

~~~text
Alert -> Runbook -> chẩn đoán -> mitigation -> xác minh recovery
Incident đóng -> Postmortem -> action items -> theo dõi hoàn thành
~~~

## 2. Runbook mẫu: Order Service lỗi 5xx cao

**Trigger:** alert OrderServiceHighErrorRate firing 10 phút.

**Impact:** người dùng không tạo được đơn; có thể phát sinh retry và backlog.

**Kiểm tra chỉ đọc:**

~~~bash
kubectl -n reliability-shop get deploy,pod,svc,endpointslice
kubectl -n reliability-shop get events --sort-by=.lastTimestamp
kubectl -n reliability-shop logs deploy/order-service --since=15m
~~~

1. Xác nhận SLI, request volume và phạm vi region/AZ/version.
2. Kiểm tra release gần nhất, readiness, OOM, DB pool, SQS và dependency.
3. Nếu tương quan với release, rollback về image digest đã biết tốt qua GitOps.
4. Nếu dependency nghẽn, giảm retry, bảo vệ queue và áp dụng circuit breaker đã duyệt.
5. Xác minh end-to-end; theo dõi error rate, p95 và backlog.

**Escalation:** SEV-1 nếu checkout ngừng toàn bộ hoặc có nguy cơ mất/nhân đôi dữ liệu.

## 3. Mẫu postmortem không đổ lỗi

- Incident ID, thời gian UTC, severity, owner.
- Impact định lượng và user journey bị ảnh hưởng.
- Timeline dựa trên alert, deploy, audit log.
- Root cause và contributing factors; không dừng ở lỗi cá nhân.
- Điều gì phát hiện tốt/chậm, mitigation nào hiệu quả/rủi ro.
- Action item có owner, deadline, ưu tiên và tiêu chí hoàn thành.

~~~text
Five Whys chỉ là công cụ gợi ý. Với hệ phân tán, có thể có nhiều nguyên nhân
và điều kiện đồng thời; không ép mọi sự cố thành một chuỗi tuyến tính.
~~~

## 4. Expected và Measured

| Kết quả | Nội dung |
| --- | --- |
| **Expected** | Người trực làm theo runbook có thể xác định phạm vi, rollback và xác minh recovery mà không cần kiến thức ngầm. |
| **Measured** | Chưa diễn tập. Ghi thời gian acknowledge, mitigation, recovery, bước sai/thiếu và evidence. |

## 5. Troubleshooting và production

- Runbook lỗi thời: gắn owner, ngày review, test trong game day.
- Lệnh nguy hiểm: đánh dấu rõ precondition, blast radius và rollback; không nhúng secret.
- Postmortem không tạo cải tiến: giới hạn action, ưu tiên theo rủi ro và theo dõi tới khi đóng.
- Không dùng postmortem để đánh giá cá nhân; tập trung guardrail, thiết kế và quy trình.
