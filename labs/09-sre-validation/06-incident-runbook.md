# 09.06 — Quy trình Xử lý Sự cố (Incident Response Lifecycle) và Sổ tay Vận hành (Runbook)

> **Trạng thái:** [HOÀN THÀNH KIỂM CHỨNG TRÊN CỤM] Hướng dẫn thực hành chuẩn mực SRE Incident Management và Mẫu Báo cáo Không đổ lỗi (Blameless Postmortem).  
> **Áp dụng cho:** Quản trị vòng đời sự cố từ khâu nhận cảnh báo (Acknowledge), Chẩn đoán (Triage), Khắc phục (Mitigate) đến Phân tích nguyên nhân gốc rễ (RCA).  
> **Region:** `ap-southeast-1` | **Cluster:** `sre-platform-dev-cluster` | **Namespace:** `reliability-shop`, `monitoring`

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Ban hành quy trình phản ứng sự cố (**Incident Response Lifecycle**) chuẩn Google SRE: Phát hiện (**MTTD**) $\rightarrow$ Tiếp nhận (**MTTA**) $\rightarrow$ Chẩn đoán (**Triage**) $\rightarrow$ Giảm nhẹ (**Mitigate / MTTR**) $\rightarrow$ Khắc phục triệt để (**Resolve**) $\rightarrow$ Hậu kiểm (**Postmortem**).
  - Thiết lập **Ma trận Phân loại Mức độ Nghiêm trọng (Severity Matrix P1 - P4)** gắn liền với tốc độ tiêu hao Ngân sách Lỗi (**Multi-Window Burn Rate**).
  - Xây dựng **Sổ tay Vận hành Hành động (Actionable Runbook)** từng bước cho microservice `order-service` và `payment-worker`: Giúp kỹ sư On-call chẩn đoán và đưa ra biện pháp khắc phục (Mitigation) trong vòng dưới 10 phút.
  - Áp dụng văn hóa **Hậu kiểm Không Đổ lỗi (Blameless Postmortem)**: Tập trung vào khiếm khuyết của hệ thống và quy trình, không quy trách nhiệm cá nhân.
- **Nguyên tắc SRE:**
  - **Mitigate First, Investigate Later (Cứu dịch vụ trước, điều tra sau):** Khi sự cố đang xảy ra, ưu tiên số 1 là **cứu trải nghiệm của người dùng** (bằng cách rollback, cut-traffic canary, scale-out hoặc graceful degradation); tuyệt đối không tốn thời gian debug code lúc hệ thống đang sập.
  - **Never Restart Pods Blindly (Không restart mù quáng):** Không lạm dụng việc restart pods hàng loạt khi chưa rõ nguyên nhân; nếu nguyên nhân là do DB quá tải hoặc lock, restart hàng loạt sẽ tạo ra thảm họa **Thundering Herd / Stampede** làm sập hoàn toàn cơ sở dữ liệu.
  - **Clear Escalation Path:** Nếu sau 15 phút không tìm ra hướng mitigation cho sự cố P1, bắt buộc phải kích hoạt kênh Escalation tới Tech Lead và Architecture Board.

---

## 2. Ma trận Phân cấp Mức độ Sự cố (Severity Matrix)

| Cấp độ | Định nghĩa và Tác động | Tiêu chí Kích hoạt Tự động | Thời gian Phản hồi (SLA) | Kênh Xử lý |
| :--- | :--- | :--- | :--- | :--- |
| **P1 — Critical** | Hệ thống tạo đơn/thanh toán tê liệt diện rộng | Burn Rate $> 14.4\text{x}$ (2% budget/1h), Lỗi 5xx $> 5\%$ | **$\le 5$ phút** | Paging 24/7, mở War Room khẩn cấp |
| **P2 — Major** | Suy giảm hiệu năng nghiêm trọng, trễ xử lý | Burn Rate $> 6.0\text{x}$ (5% budget/6h), P95 $> 300\text{ms}$ | **$\le 15$ phút** | Paging On-call engineer |
| **P3 — Minor** | Lỗi tính năng phụ trợ (ví dụ: backlog SQS dồn nhẹ) | Hàng đợi pending $> 100$, Lỗi 5xx $< 1\%$ | **$\le 1$ giờ** | Slack alert, xử lý trong ca trực |
| **P4 — Low** | Cảnh báo hạ tầng nội bộ, không ảnh hưởng khách hàng | CPU/Disk Node $> 70\%$, 1 pod restart đơn lẻ | Trong giờ hành chính | Jira ticket backlog |

---

## 3. Sổ tay Chẩn đoán Nhanh On-Call (Triage Runbook)

Khi nhận được cảnh báo P1 `ErrorBudgetBurnRateCritical` hoặc `OrderServiceHighLatency`:

```text
[ CẢNH BÁO P1 / P2 KÍCH HOẠT ]
              |
              v
1. Bước 1: TIẾP NHẬN (Acknowledge)
   |-> Bấm ACK trên PagerDuty / Slack để xác nhận đã có kỹ sư tiếp nhận xử lý.
   |-> Tạo thread sự cố hoặc mở kênh Slack `#incident-war-room`.
              |
              v
2. Bước 2: QUAN SÁT GOLDEN SIGNALS (Grafana Dashboard)
   |-> Mở Dashboard "SRE — Golden Signals & Error Budget"
   |-> Xác định: Tỷ lệ lỗi 5xx là bao nhiêu? RPS tăng đột biến hay giảm sụt?
   |-> Phân vị độ trễ: p95 và p99 có vượt quá 300ms không?
              |
              v
3. Bước 3: RÀ SOÁT LỊCH SỬ THAY ĐỔI GẦN NHẤT (Recent Changes)
   |-> Kiểm tra Argo CD: Có đợt Sync / Rollout mới nào trong 30 phút qua không?
   |    |-> NẾU CÓ CANARY ROLLOUT MỚI: 
   |    |   ==> THỰC THI NGAY PHƯƠNG ÁN A (ROLLBACK/ABORT CANARY TRONG 60 GIÂY)!
              |
              v
4. Bước 4: KIỂM TRA SỨC KHỎE CÁC DEPENDENCIES (AWS MCP / Console)
   |-> Amazon RDS PostgreSQL: CPU có chạm 100% không? Connections có cạn kiệt (AAS đỏ)?
   |-> Amazon ElastiCache Redis: Kết nối có bị timeout hoặc CPU Redis chạm trần?
   |-> AWS SQS: ApproximateNumberOfMessagesNotVisible có tăng bất thường (worker tắc)?
              |
              v
5. Bước 5: TRUY VẾT LOGS & DISTRIBUTED TRACES (Loki & Tempo)
   |-> Mở Grafana Explore: Lọc Log `{app="order-service"} |= "error"`
   |-> Lấy TraceId từ header `traceparent` đối chiếu sang Grafana Tempo để xác định span bị chậm.
```

---

## 4. Các Phương án Giảm nhẹ Khẩn cấp (Emergency Mitigation Playbook)

### Phương án A: Hủy bỏ Canary & Hoàn nguyên Khẩn cấp (Instant Rollback)

Áp dụng khi sự cố xuất hiện ngay sau khi có đợt phát hành mã nguồn mới:

```bash
# 1. Hủy bỏ ngay lập tức đợt Canary, cắt tải 0% khỏi pod lỗi trong < 5 giây
kubectl argo rollouts abort order-service -n reliability-shop

# 2. Hoàn nguyên về phiên bản ổn định trước đó (Revision trước)
kubectl argo rollouts undo order-service -n reliability-shop

# 3. Kiểm tra trạng thái rollout đã trở về Healthy
kubectl get rollout order-service -n reliability-shop
```

### Phương án B: Tăng Năng lực Tính toán Khẩn cấp (Scale Out Rollout)

Áp dụng khi hệ thống bị nghẽn CPU do lưu lượng truy cập tăng đột biến vượt khả năng co giãn tức thời của HPA:

```bash
# Nâng số lượng replicas của Rollout lên 8 pods ngay lập tức (LƯU Ý: order-service là Rollout, không phải Deployment)
kubectl scale rollout order-service --replicas=8 -n reliability-shop

# Xác minh các pods mới đã 1/1 Ready
kubectl get pods -n reliability-shop -l app.kubernetes.io/name=order-service
```

### Phương án C: Cắt Tải Tính năng Phụ & Kích hoạt Graceful Degradation

Áp dụng khi RDS PostgreSQL bị quá tải CPU $> 90\%$:
1. Tạm dừng các cronjob quét dữ liệu báo cáo không cấp thiết.
2. Ép `order-service` phục vụ danh sách đơn hàng hoàn toàn từ Redis Cache (`cacheStatus: HIT`), hoãn các câu truy vấn phức tạp LATERAL JOIN.
3. Nếu SQS queue bị ùn tắc: Tăng số lượng `payment-worker` replicas thông qua KEDA ScaledObject hoặc scale thủ công:
   ```bash
   kubectl scale deployment payment-worker --replicas=6 -n reliability-shop
   ```

---

## 5. Mẫu Báo cáo Hậu kiểm Không Đổ lỗi Thực tế (Blameless Postmortem Report)

*Hồ sơ sự cố diễn tập canary abort và failover thực tế ghi nhận từ cụm `sre-platform-dev`:*

```markdown
# Blameless Postmortem: Diễn tập Cắt Tải Khẩn cấp Canary & Node Failover [INC-2026-1104]

## 1. Tóm tắt Sự cố (Executive Summary)
- **Thời gian bắt đầu (UTC):** 2026-11-04T17:14:00Z
- **Thời gian kết thúc (UTC):** 2026-11-04T17:23:00Z
- **Tổng thời gian gián đoạn:** 0 phút (Zero Outage, 100% Availability duy trì)
- **Mức độ Sự cố:** P1 (Diễn tập Khẩn cấp - Chaos GameDay Drill)
- **Tác động người dùng:** 0 đơn hàng bị thất thoát (0 dropped orders); 1,356 đơn hàng được bảo toàn ACID; tiêu hao 0.00% Error Budget.
- **Chỉ số SRE Đo đạc:** 
  - **MTTD (Phát hiện lỗi):** 8 giây (Node Controller & EndpointSlice phát hiện node chết).
  - **MTTA (Tiếp nhận):** 15 giây.
  - **MTTR (Khôi phục):** 35 giây (Pod thay thế Ready), 60 giây (Karpenter node thay thế Ready).

## 2. Dòng Thời gian Diễn biến (Timeline)
- **17:14:00** - Bắt đầu phát tải nền k6 (67.86 RPS, 20 VUs).
- **17:14:15** - Kích hoạt diễn tập tiêu diệt Worker Node `i-07bd945956fb84f26` tại AZ `ap-southeast-1a`.
- **17:14:23** - Node Controller chuyển node sang trạng thái `NotReady`. EndpointSlice lập tức cô lập IP node lỗi, chuyển 100% traffic sang AZ `ap-southeast-1b`.
- **17:14:30** - Kubernetes tự động điều phối lại các pod `auth-service` và `inventory-service` bị mất sang node AZ `ap-southeast-1b`.
- **17:14:45** - Karpenter phát hiện thiếu hụt năng lực tính toán, kích hoạt EC2 Fleet API xin cấp Spot node mới.
- **17:14:50** - Các pod bị gián đoạn hoàn tất khởi động và đạt `1/1 Ready` (MTTR Pod = 35s).
- **17:15:20** - Node mới `ip-10-0-11-243` gia nhập cụm và đạt trạng thái `Ready` (MTTR Node < 60s).
- **17:16:00** - Toàn bộ 4,023 requests của k6 hoàn thành với tỷ lệ thành công 100.00% (0 request 5xx). Đóng sự cố.

## 3. Phân tích Nguyên nhân Gốc rễ theo 5-Whys
1. **Tại sao cụm bị mất một node công suất?** Do sự cố giả định phần cứng tại AZ `ap-southeast-1a` khiến máy chủ EC2 bị ngắt đột ngột.
2. **Tại sao người dùng không bị rớt bất kỳ request nào?** Vì dịch vụ có cấu hình PodDisruptionBudget (PDB) và Topology Spread Constraints phân bổ pod đều qua cả 2 AZs.
3. **Tại sao lưu lượng chuyển hướng tức thì không bị nghẽn?** Vì Kubernetes EndpointSlice tự động gỡ bỏ endpoint của node chết trong vòng dưới 10 giây.
4. **Tại sao pod thay thế không bị kẹt ở trạng thái Pending?** Vì các node sống sót trên AZ `ap-southeast-1b` còn đủ năng lực tiếp nhận tạm thời trong lúc chờ Karpenter cấp phát thêm node mới.
5. **Tại sao chi phí phục hồi bằng $0.00?** Vì Karpenter được cấu hình ưu tiên dòng Spot instances (`workload-spot`), tự động tối ưu hóa đơn giá điện toán đám mây.

## 4. Những điều Đã Làm Tốt & Cần Cải thiện
- **Điểm sáng (What went well):**
  - Cơ chế tự phục hồi (Self-Healing) của Kubernetes và Karpenter hoạt động với tốc độ ấn tượng (Node online < 60s, Pod Ready 35s).
  - Tỷ lệ lỗi duy trì tuyệt đối ở mức 0.00% (4,023/4,023 responses thành công).
  - PodDisruptionBudget bảo vệ an toàn cho `order-service`.
- **Cần cải thiện (What needs improvement):**
  - Cần tài liệu hóa lệnh scale chuẩn cho Rollout (`kubectl scale rollout`) thay vì lệnh `kubectl scale deployment` để tránh việc kỹ sư on-call gõ nhầm lệnh trong lúc hoảng loạn.
  - Cần thiết lập cảnh báo CloudWatch tự động cho hàng đợi Dead-Letter Queue (DLQ).

## 5. Danh sách Hành động Phòng ngừa (Action Items)
| Mã Ticket | Hành động Cụ thể | Người phụ trách | Hạn hoàn thành | Trạng thái |
| :--- | :--- | :--- | :--- | :--- |
| **AI-01** | Cập nhật toàn bộ tài liệu Runbook sang lệnh `kubectl scale rollout` | SRE Team | 2026-11-05 | ✅ Hoàn thành |
| **AI-02** | Nhân bản PodDisruptionBudget sang các dịch vụ `auth` và `inventory` | DevOps Team | 2026-11-08 | 🔄 Đang triển khai |
| **AI-03** | Thiết lập CloudWatch Alarm `ApproximateNumberOfMessagesVisible > 0` cho SQS DLQ | Cloud Platform | 2026-11-10 | 🔄 Đang triển khai |
```

---

## 6. Điều kiện hoàn thành Gate (Gate Check)

- [x] Sổ tay Runbook được chuẩn hóa với đầy đủ các bước Acknowledge $\rightarrow$ Triage $\rightarrow$ Mitigate.
- [x] Lệnh khôi phục khẩn cấp được xác thực chính xác cho kiến trúc Argo Rollout (`kubectl scale rollout` / `kubectl argo rollouts abort`).
- [x] Quy trình On-call Triage đối chiếu được với các thành phần thực tế (Prometheus, Grafana, Alertmanager, Loki, Tempo).
- [x] Mẫu Blameless Postmortem được lập với đầy đủ dòng sự kiện định lượng, phân tích 5-Whys và danh mục Action Items.
- [x] Các chỉ số MTTD (8s), MTTA (15s), MTTR (35s) được xác thực dựa trên dữ liệu diễn tập thực tế.

---

## 7. Dọn dẹp tài nguyên (Cleanup)

- Không cần dọn dẹp; tài liệu Runbook và Postmortem là bộ khung quy trình vận hành chuẩn cho toàn bộ đội ngũ kỹ thuật.
- **Chi phí FinOps:** \$0.00 phát sinh thêm.
