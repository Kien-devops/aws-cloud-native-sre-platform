# Quản lý sự cố ReliabilityShop

Mục tiêu: khôi phục trải nghiệm người dùng an toàn trước, điều tra nguyên nhân sâu sau.

~~~text
Alert / người dùng báo -> Triage -> Declare -> Mitigate -> Recover -> Review
                                      |
                                      +-> cập nhật stakeholder
~~~

## 1. Severity

| Mức | Ví dụ | Phản ứng |
| --- | --- | --- |
| SEV-1 | Checkout ngừng toàn bộ, mất dữ liệu hoặc sự cố bảo mật nghiêm trọng | Page ngay, Incident Commander |
| SEV-2 | User journey chính suy giảm đáng kể | Page team sở hữu |
| SEV-3 | Ảnh hưởng nhỏ, có workaround | Ticket ưu tiên |
| SEV-4 | Cảnh báo sớm hoặc vấn đề nội bộ | Backlog |

## 2. Vai trò

- **Incident Commander:** điều phối, phân công, escalation.
- **Operations Lead:** điều tra và thực hiện mitigation.
- **Communications Lead:** cập nhật stakeholder/status page.
- **Scribe:** ghi timeline, giả thuyết, lệnh và quyết định.

## 3. Quy trình

1. Xác nhận impact bằng SLI, synthetic check và phản hồi người dùng.
2. Declare incident; tạo ID, severity, owner và timestamp UTC.
3. Kiểm tra deploy, config, feature flag, dependency và AWS event gần nhất.
4. Chọn mitigation ít rủi ro: rollback image, tắt feature, chuyển traffic hoặc scale có giới hạn.
5. Xác minh recovery từ phía người dùng; theo dõi một cửa sổ ổn định.
6. Đóng incident khi impact hết và action owner rõ.

Ví dụ: tỷ lệ tạo đơn lỗi tăng sau release `order-service`. Rollback immutable image về digest trước, không rebuild cùng tag. Kiểm tra ALB 5xx, SLI, queue depth, DB connections và request end-to-end.

## 4. Mẫu cập nhật

~~~text
[2026-10-20 10:15 UTC] SEV-2 - Checkout lỗi tăng tại production.
Impact: khoảng X% request tạo đơn thất bại; phạm vi đang xác minh.
Mitigation: rollback order-service từ digest A về digest B.
Trạng thái: đang theo dõi SLI và backlog SQS.
Cập nhật tiếp theo: 10:30 UTC hoặc khi có thay đổi lớn.
~~~

Tách rõ `đã quan sát`, `giả thuyết`, `hành động`; không ghi phỏng đoán thành nguyên nhân.

## 5. Xác minh recovery

| Kết quả | Nội dung |
| --- | --- |
| **Expected** | Error rate, latency về baseline, backlog giảm, không có lỗi dữ liệu, alert resolved. |
| **Measured** | Chưa có dữ liệu. Điền biểu đồ, truy vấn, release digest, request thử và timestamp. |

## 6. Troubleshooting và production

- Quá nhiều người cùng sửa: IC chỉ định một Operations Lead, tạm khóa thay đổi khác.
- Rollback không phục hồi: kiểm tra DB migration, queue backlog, cache và dependency.
- Metric xanh nhưng người dùng lỗi: kiểm tra CDN, ALB, DNS và synthetic ngoài cluster.
- Chuẩn hóa UTC; tự động thu deploy, alert và audit event.
- Quyền break-glass phải có audit và thời hạn.
- Không failover hoặc sửa DB nếu chưa có owner, backup và rollback.
- Sau incident cần postmortem không đổ lỗi, action có owner và deadline.
