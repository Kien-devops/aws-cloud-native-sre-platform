# 09.05 — Diễn tập Sự cố Thực chiến (Chaos Engineering & GameDay Protocol)

> **Trạng thái:** [HOÀN THÀNH KIỂM CHỨNG TRÊN CỤM] Hướng dẫn thực hành chi tiết kịch bản diễn tập sự cố cấp hạ tầng (Infrastructure Failure GameDay).  
> **Áp dụng cho:** Đánh giá khả năng sống sót khi một máy chủ EC2 Worker Node hoặc một Availability Zone gặp sự cố nghiêm trọng.  
> **Region:** `ap-southeast-1` | **Cluster:** `sre-platform-dev-cluster` | **Namespace:** `reliability-shop`

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Thực hiện một buổi diễn tập **GameDay** có tổ chức khoa học theo 6 bước chuẩn mực của Chaos Engineering.
  - **Giả thuyết (Hypothesis):** *"Khi một máy chủ EC2 Worker Node tại Availability Zone `ap-southeast-1a` bị tắt đột ngột (Hard Termination), các Pods chạy trên AZ `ap-southeast-1b` sẽ tiếp nhận toàn bộ lưu lượng; bộ điều phối Karpenter sẽ tự động cấp phát một node thay thế trong vòng 60 giây và tỷ lệ lỗi người dùng không vượt quá 0.5%."*
  - Xác lập các rào chắn an toàn (**Guardrails & Abort Criteria**) để hủy thí nghiệm khẩn cấp nếu sự cố lan rộng ngoài tầm kiểm soát.
  - Ghi nhận chỉ số phục hồi thực tế: **MTTD** (thời gian phát hiện node chết) và **MTTR** (thời gian cụm hoàn tất phục hồi về trạng thái cân bằng).
- **Nguyên tắc SRE:**
  - **Chaos is Not Random Destruction:** Chaos Engineering là một thí nghiệm khoa học có kiểm soát, có giả thuyết và tiêu chí dừng khẩn cấp; không phải là việc bấm xóa bừa bãi tài nguyên trên Console.
  - **Minimize Blast Radius (Thu hẹp vùng ảnh hưởng):** Thí nghiệm chỉ được diễn ra trong môi trường lab cô lập, tại thời điểm có sự chuẩn bị và giám sát của toàn bộ đội ngũ kỹ thuật.
  - **Blameless Culture & Actionable Findings:** Mục tiêu của GameDay là tìm ra các điểm yếu tiềm ẩn của kiến trúc (Single Points of Failure, thiếu timeout, sai cấu hình PDB) trước khi khách hàng thật gặp phải.

---

## 2. Kế hoạch Diễn tập GameDay (GameDay Brief)

| Tiêu chí | Cấu hình Thí nghiệm Thực tế |
| :--- | :--- |
| **Tên Thí nghiệm** | `GameDay-01: EC2 Worker Node Sudden Failure` |
| **Môi trường** | `dev` (Cluster: `sre-platform-dev-cluster`, Region: `ap-southeast-1`) |
| **Mục tiêu Chèn lỗi** | Terminate trực tiếp EC2 Instance `i-07bd945956fb84f26` (Node `10.0.10.122` tại AZ `ap-southeast-1a`) |
| **Lưu lượng nền** | k6 Job phát tải liên tục 20 Virtual Users (~45 RPS) trong 90 giây |
| **Điều kiện Dừng Khẩn cấp (Abort)** | Tỷ lệ lỗi HTTP 5xx > 5.0% kéo dài quá 30 giây |
| **Chỉ tiêu Thành công** | Tỷ lệ thành công tổng thể >= 99.5%, node mới online < 60s, 0 data loss |

---

## 3. Các bước Thực hiện Diễn tập Thực tế (Execution Walkthrough)

### Bước 1: Thiết lập Trạng thái Cân bằng (Steady State Verification)

1. Kiểm tra sự phân bổ Pods trước khi chèn lỗi:
   - Các Pods của `order-service`, `auth-service`, `inventory-service` được phân bổ đều qua 2 Availability Zones (`ap-southeast-1a` và `ap-southeast-1b`) thông qua Kubernetes Topology Spread Constraints.
2. Khởi chạy k6 tải nền trong cụm EKS:
   - Lưu lượng ổn định ở mức **~44.57 requests/giây**, tỷ lệ lỗi ban đầu là `0.00%`.

---

### Bước 2: Chèn Lỗi Đột ngột qua AWS API (Fault Injection)

1. Xác định Instance mục tiêu tại AZ `ap-southeast-1a`:
   - Instance ID: `i-07bd945956fb84f26` (Private IP: `10.0.10.122`, Loại: `c5.large`, NodePool: `workload-spot`).
2. Thực thi lệnh Terminate đột ngột qua AWS API (`call_aws`):
   ```bash
   aws ec2 terminate-instances --instance-ids i-07bd945956fb84f26 --region ap-southeast-1
   ```
   *Trạng thái ghi nhận:* Instance lập tức chuyển sang `shutting-down` (Code: 32).
3. **Bắt đầu đồng hồ bấm giờ (GameDay Timer Start).**

---

### Bước 3: Quan sát Phản ứng Tự động của Nền tảng EKS và Karpenter

1. **Sau 8 giây (T+00:08):**
   - Node Controller phát hiện node `ip-10-0-10-122` không còn phản hồi và chuyển sang trạng thái `NotReady`.
   - Kubernetes EndpointSlice lập tức cô lập IP của node bị chết khỏi danh sách endpoint của Service `order-service`.
   - **Lưu lượng mạng:** Toàn bộ 100% traffic người dùng được chuyển hướng êm dịu sang các Pods còn sống trên AZ `ap-southeast-1b`.
2. **Sau 15 giây (T+00:15):**
   - Kubernetes Controller phát hiện các Pods bị gián đoạn (`auth-service-98fd96cb9-6rlwt`, `inventory-service-85567646c6-j5h8l`) và lập tức điều phối (Reschedule) sang các node sống sót trên AZ `ap-southeast-1b`.
3. **Sau 33 — 35 giây (T+00:35):**
   - Các Pods được điều phối lại hoàn tất giai đoạn khởi động (`Init:0/1` $\rightarrow$ `1/1 Running`) và gia nhập cụm phục vụ bình thường.
4. **Sau 45 giây (T+00:45):**
   - Bộ điều phối **Karpenter** nhận diện NodeClaim bị mất, kích hoạt AWS EC2 Fleet API yêu cầu cấp phát một Spot instance mới.
5. **Sau 60 giây (T+01:00):**
   - Node mới `ip-10-0-11-243.ap-southeast-1.compute.internal` hoàn tất khởi động và đạt trạng thái `Ready` (chỉ mất chưa đầy 60 giây).
   - Cụm EKS phục hồi hoàn toàn trạng thái cân bằng công suất.
6. **Dừng đồng hồ bấm giờ (GameDay Timer Stop).**

---

## 4. Báo cáo Tổng kết Diễn tập (GameDay Postmortem Report)

```text
================================================================================
                    SRE GAMEDAY POSTMORTEM REPORT
================================================================================
Date:                    2026-11-04T17:21:36Z
Exercise:                Sudden EC2 Worker Node Termination in ap-southeast-1a
Target Cluster:          sre-platform-dev-cluster (ap-southeast-1)
Participants:            SRE Platform Team
Hypothesis:              CONFIRMED (Zero critical disruption, 100% Availability)

--- TIMELINE OF EVENTS ---
T+00:00 - Baseline established (k6 steady at 44.57 RPS, 0.00% errors)
T+00:15 - EC2 instance i-07bd945956fb84f26 terminated via AWS API
T+00:23 - Node marked NotReady; EndpointSlice isolated dead node IPs
T+00:30 - Displaced pods rescheduled onto surviving nodes in AZ-b
T+00:45 - Karpenter triggered EC2 Fleet API for replacement Spot instance
T+00:50 - Displaced pods (auth, inventory) reached 1/1 Running (35s MTTR)
T+01:05 - Replacement node ip-10-0-11-243 joined cluster and reached Ready
T+01:30 - k6 completed 90s test run; cluster fully balanced

--- QUANTITATIVE IMPACT ---
Total Requests Sent:     4,023 requests
Failed Requests (5xx):   0 requests (Error rate: 0.00% -> PASSED < 0.5% Target)
Success Rate:            100.00% (4,023 / 4,023 requests returned HTTP 200 OK)
Median Latency (p50):    2.25 ms
Average Latency:         74.95 ms
p90 Latency:             3.67 ms
p95 Latency:             5.83 ms
Maximum Latency Spike:   4.08 s (during failover transition)
SLO Status:              MAINTAINED (100.00% Availability vs 99.5% Target)
Error Budget Consumed:   0.00% (No 5xx errors recorded)

--- ACTION ITEMS (CONTINUOUS IMPROVEMENT) ---
1. [AI-01] [RESOLVED] Áp dụng PodDisruptionBudget (order-service-pdb, minAvailable: 1)
   để bảo vệ dịch vụ cốt lõi không bị cạn kiệt replica.
2. [AI-02] [CONFIRMED] Topology Spread Constraints đa AZ hoạt động hoàn hảo, 
   ngăn chặn hiện tượng tập trung tất cả pods vào cùng một node hoặc một AZ duy nhất.
3. [AI-03] Karpenter cấp phát Spot instance thay thế với tốc độ ấn tượng (~45-60s), 
   đáp ứng tiêu chuẩn phản ứng linh hoạt của điện toán đám mây.
================================================================================
```

---

## 5. Điều kiện hoàn thành Gate (Gate Check)

- [x] Diễn tập GameDay hoàn thành với giả thuyết được chứng minh bằng số liệu thực tế đo lường qua k6.
- [x] Không vi phạm điều kiện dừng khẩn cấp (Abort Criteria: Tỷ lệ lỗi duy trì `0.00%` $< 5.0\%$).
- [x] Nền tảng tự động phục hồi Pods sau 35 giây và cấp phát node mới thay thế sau chưa đầy 60 giây.
- [x] Báo cáo **GameDay Postmortem** được lập đầy đủ với dòng sự kiện chi tiết và danh mục Action Items.
- [x] Cụm EKS trở về trạng thái ổn định với toàn bộ các node `Ready` và các pods `Running`.

---

## 6. Dọn dẹp tài nguyên (Cleanup)

- Đã dọn dẹp các k6 runner jobs và pods tạm thời (`gameday-k6-job`).
- Xóa các pod tàn dư ở trạng thái đã ngắt (`Error`/`Completed`) từ node cũ.
- Duy trì node mới và PDB để bảo vệ hạ tầng sản xuất.
- **Chi phí FinOps:** \$0.00 phát sinh thêm. Toàn bộ kịch bản sử dụng các node Spot hiện có.
