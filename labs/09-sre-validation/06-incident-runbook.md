# 09.06 — Quy trình Xử lý Sự cố (Incident Response Lifecycle) và Sổ tay Vận hành (Runbook)

> **Trạng thái:** Hướng dẫn thực hành chuẩn mực SRE Incident Management và Mẫu Báo cáo Không đổ lỗi (Blameless Postmortem).  
> **Áp dụng cho:** Quản trị vòng đời sự cố từ khâu nhận cảnh báo (Acknowledge), Chẩn đoán (Triage), Khắc phục (Mitigate) đến Phân tích nguyên nhân gốc rễ (RCA).

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Ban hành quy trình phản ứng sự cố (**Incident Response Lifecycle**) rõ ràng, chuẩn hóa các mốc thời gian: **MTTD** (Phát hiện), **MTTA** (Tiếp nhận), **MTTR** (Khôi phục dịch vụ).
  - Thiết lập **Ma trận Phân loại Mức độ Nghiêm trọng (Severity Matrix P1 - P4)** gắn liền với tốc độ tiêu hao Ngân sách Lỗi (Burn Rate).
  - Xây dựng **Sổ tay Vận hành Hành động (Actionable Runbook)** từng bước: Giúp kỹ sư On-call chẩn đoán nguyên nhân và đưa ra biện pháp khắc phục (Mitigation) trong vòng dưới 10 phút.
  - Áp dụng văn hóa **Hậu kiểm Không Đổ lỗi (Blameless Postmortem)**: Tập trung vào khiếm khuyết của hệ thống và quy trình, không quy trách nhiệm cá nhân.
- **Nguyên tắc SRE:**
  - **Mitigate First, Investigate Later:** Khi sự cố đang xảy ra, ưu tiên số 1 là **cứu dịch vụ người dùng** (bằng cách rollback, scale-up hoặc cô lập lỗi), không tốn thời gian debug sâu code lúc hệ thống đang sập.
  - **Never Restart Pods Blindly:** Không lạm dụng việc restart pods hàng loạt khi chưa biết nguyên nhân; nếu nguyên nhân là do DB quá tải, việc restart sẽ tạo ra thảm họa Stampede làm sập luôn DB.
  - **Clear Escalation Path:** Nếu sau 15 phút không tìm ra hướng mitigation cho sự cố P1, bắt buộc phải kích hoạt kênh Escalation tới Tech Lead và Architecture Board.

---

## 2. Ma trận Phân cấp Sự cố (Severity Matrix)

| Cấp độ | Định nghĩa và Tác động | Tiêu chí Kích hoạt | Thời gian Phản hồi (SLA) |
| :--- | :--- | :--- | :--- |
| **P1 — Critical** | Hệ thống ngừng hoạt động diện rộng, không thể tạo đơn hàng | Burn Rate > 14.4x, Lỗi 5xx > 5% | **<= 5 phút** (Paging 24/7, mở War Room) |
| **P2 — Major** | Suy giảm hiệu năng nghiêm trọng, độ trễ tăng vọt | Burn Rate > 6.0x, p95 > 500ms | **<= 15 phút** (Paging On-call) |
| **P3 — Minor** | Lỗi một tính năng phụ trợ (ví dụ: gửi email chậm) | SQS Backlog tăng, Lỗi 5xx < 1% | **<= 1 giờ** (Slack notification) |
| **P4 — Low** | Cảnh báo nội bộ, không ảnh hưởng người dùng | Đĩa cứng > 70%, 1 pod restart lẻ loi | Xử lý trong giờ hành chính |

---

## 3. Sổ tay Chẩn đoán Nhanh (On-Call Triage Runbook)

Khi nhận được cảnh báo P1 `OrderServiceFastBurnRate`:

```text
[ Nhận Alert P1 ]
        |
        v
1. Bước 1: Tiếp nhận (Acknowledge) trên PagerDuty / Slack để báo nhóm đã có người xử lý.
        |
        v
2. Bước 2: Mở Grafana SRE Golden Signals Dashboard
        |--> Tỷ lệ lỗi 5xx xuất hiện từ lúc nào?
        |--> Endpoint nào bị lỗi? (/api/v1/orders hay /api/v1/products)
        |
        v
3. Bước 3: Kiểm tra Lịch sử Thay đổi Gần nhất (Recent Changes)
        |--> Mở Argo CD: Có đợt Sync / Deploy nào diễn ra trong 30 phút qua không?
        |    |-> NẾU CÓ: Kích hoạt ngay LỆNH ROLLBACK (Hồi phục trong 60s)!
        |
        v
4. Bước 4: Kiểm tra Sức khỏe Phụ thuộc (AWS Console)
        |--> RDS Console: CPU có chạm 100% không? Connections có cạn kiệt không?
        |--> ElastiCache Console: Redis có bị timeout không?
        |
        v
5. Bước 5: Xem Trace Span và Log Exception (Loki & Tempo)
        |--> Mở Grafana Explore -> Lọc log: {service="order-service"} |= "error"
        |--> Xác định chính xác Stack Trace (ví dụ: DB connection pool exhausted).
```

---

## 4. Các Phương án Giảm nhẹ Khẩn cấp (Emergency Mitigation Playbook)

### Phương án A: Hoàn nguyên Khẩn cấp (Rollback Deployment)
Nếu sự cố xuất hiện ngay sau một đợt phát hành:
```bash
# Sử dụng Argo Rollouts để rollback ngay lập tức
kubectl argo rollouts abort order-service -n reliability-shop
kubectl argo rollouts set image order-service app=<ACCOUNT_ID>.dkr.ecr.ap-southeast-1.amazonaws.com/reliabilityshop/order-service:git-v1.0.0 -n reliability-shop
```

### Phương án B: Tăng Năng lực Tính toán Khẩn cấp (Scale Out)
Nếu hệ thống bị nghẽn do lượng truy cập đột biến vượt quá dự báo:
```bash
# Nâng tạm thời mức tối thiểu của HPA để ép Kubernetes giữ sẵn pods
kubectl scale deployment order-service --replicas=8 -n reliability-shop
```

### Phương án C: Cắt Tải Tính năng Phụ (Feature Degradation)
Nếu cơ sở dữ liệu PostgreSQL bị quá tải CPU 100%:
- Kích hoạt chế độ Read-Only cho danh mục sản phẩm từ Redis Cache.
- Tạm dừng các cronjobs hoặc các tác vụ báo cáo analytics đang truy vấn vào DB.

---

## 5. Mẫu Báo cáo Hậu kiểm Không Đổ lỗi (Blameless Postmortem Template)

Lưu tại `sre/postmortems/incident-YYYY-MM-DD-<tên-sự-cố>.md`:

```markdown
# Blameless Postmortem: Sự cố Gián đoạn Order API [INC-2026-1021]

## 1. Tóm tắt Sự cố (Executive Summary)
- **Thời gian bắt đầu (UTC):** 2026-10-21T03:10:00Z
- **Thời gian kết thúc (UTC):** 2026-10-21T03:22:00Z
- **Tổng thời gian gián đoạn:** 12 phút
- **Mức độ:** P1 (Critical)
- **Tác động người dùng:** Khoảng 450 đơn hàng bị lỗi 500; tiêu hao 4.5% Ngân sách Lỗi tháng.
- **Chỉ số SRE:** MTTD = 2 phút, MTTA = 1 phút, MTTR = 9 phút.

## 2. Dòng Thời gian Diễn biến (Timeline)
- **03:10** - Bắt đầu triển khai phiên bản mới `git-v1.2.0`.
- **03:12** - Alertmanager phát cảnh báo P1 `OrderServiceFastBurnRate` về Slack và PagerDuty.
- **03:13** - Kỹ sư On-call tiếp nhận (Acknowledge) và mở War Room.
- **03:15** - Triage xác định lỗi xuất phát từ câu lệnh SQL thiếu index trên bảng `orders` làm nghẽn DB connection pool.
- **03:18** - Quyết định kích hoạt Phương án A: Rollback về phiên bản `git-v1.0.0`.
- **03:21** - Rollback hoàn tất; toàn bộ traffic trở về bình thường.
- **03:22** - Tỷ lệ lỗi 5xx trở về 0%; đóng sự cố.

## 3. Phân tích Nguyên nhân Gốc rễ theo 5-Whys
1. **Tại sao người dùng gặp lỗi 500?** Vì `order-service` không lấy được kết nối database.
2. **Tại sao không lấy được kết nối?** Vì connection pool 100 kết nối bị chiếm giữ toàn bộ bởi các truy vấn chậm.
3. **Tại sao truy vấn lại bị chậm?** Vì phiên bản mới thực hiện quét toàn bộ bảng (Table Scan) thay vì dùng Index.
4. **Tại sao code thiếu index lại được release?** Vì bài kiểm thử ở môi trường dev chạy trên database quá ít dữ liệu mẫu nên không phát hiện chậm.
5. **Tại sao không phát hiện trước khi promote?** Vì thiếu bước chạy load test k6 tự động trong quy trình staging.

## 4. Những điều Đã Làm Tốt & Cần Cải thiện
- **Tốt:** Alert phát rất nhanh (2 phút); quy trình rollback tự động của Argo Rollouts hoạt động chuẩn xác.
- **Cần cải thiện:** Cần có thêm database linter để chặn các query thiếu index ngay từ khâu CI.

## 5. Danh sách Hành động Phòng ngừa (Action Items)
| Mã | Hành động Cụ thể | Người phụ trách | Hạn chót | Ticket |
| :--- | :--- | :--- | :--- | :--- |
| **AI-01** | Thêm index cho cột `customer_id` trên PostgreSQL | Database Team | 2026-10-25 | SRE-101 |
| **AI-02** | Bổ sung bài load test k6 bắt buộc trước khi merge PR sang prod | QA/DevOps | 2026-10-28 | SRE-102 |
| **AI-03** | Cấu hình PgBouncer connection pooler để chặn cạn kiệt kết nối | SRE Team | 2026-11-02 | SRE-103 |
```

---

## 6. Điều kiện hoàn thành Gate (Gate Check)

- [ ] Sổ tay Runbook được tài liệu hóa với đầy đủ các bước Acknowledge -> Triage -> Mitigate.
- [ ] Mẫu Blameless Postmortem được áp dụng và hiểu rõ bởi toàn bộ thành viên nhóm.
- [ ] Các chỉ số MTTD, MTTA, MTTR được xác định phương pháp đo đạc chính xác.
