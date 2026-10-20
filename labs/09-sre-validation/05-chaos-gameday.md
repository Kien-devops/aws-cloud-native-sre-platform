# 09.05 — Diễn tập Sự cố Thực chiến (Chaos Engineering & GameDay Protocol)

> **Trạng thái:** Hướng dẫn thực hành chi tiết kịch bản diễn tập sự cố cấp hạ tầng (Infrastructure Failure GameDay).  
> **Áp dụng cho:** Đánh giá khả năng sống sót khi một máy chủ EC2 Worker Node hoặc một Availability Zone gặp sự cố nghiêm trọng.

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

| Tiêu chí | Cấu hình Thí nghiệm |
| :--- | :--- |
| **Tên Thí nghiệm** | `GameDay-01: EC2 Worker Node Sudden Failure` |
| **Môi trường** | `dev` (Cluster: `sre-platform-dev`) |
| **Kịch bản Chèn lỗi** | Terminate trực tiếp 1 EC2 Instance đang chứa 50% pods |
| **Lưu lượng nền** | k6 tải liên tục 30 Virtual Users (~40 RPS) |
| **Điều kiện Dừng Khẩn cấp (Abort)** | Tỷ lệ lỗi HTTP 5xx > 5.0% kéo dài quá 60 giây |
| **Chỉ tiêu Thành công** | Tỷ lệ thành công tổng thể >= 99.5%, node mới online < 60s |

---

## 3. Các bước Thực hiện Diễn tập (Step-by-Step Walkthrough)

### Bước 1: Thiết lập Trạng thái Cân bằng (Steady State Verification)

1. Khởi chạy k6 tải nền từ máy trạm:
   ```bash
   docker run --rm -i grafana/k6:latest run - < performance/k6/sre-load-test.js
   ```
2. Quan sát trên Grafana Dashboard:
   - Tỷ lệ lỗi: `0%`.
   - Độ trễ p95: `< 150ms`.
   - 2 Nodes EC2 đang chạy ổn định ở 2 AZs.

---

### Bước 2: Chèn Lỗi Đột ngột trên AWS EC2 Console (Fault Injection)

1. Mở **AWS Management Console** -> Chọn dịch vụ **EC2**.
2. Nhấp vào **Instances (running)**.
3. Tìm 2 instances của EKS Cluster (có tên `sre-platform-dev-system-nodes-...`).
4. Chọn instance nằm tại Availability Zone **`ap-southeast-1a`**.
5. Nhấp vào menu **Instance state** ở góc trên bên phải -> Chọn **Terminate instance** (Xóa sổ máy chủ).
6. Nhấp **Terminate** để xác nhận hành động.
7. **Bấm đồng hồ đo thời gian (GameDay Timer Start).**

---

### Bước 3: Quan sát Phản ứng Tự động của Nền tảng EKS và Karpenter

1. **Sau 5 - 10 giây (Tầng Mạng ALB):**
   - Health check của Target Group tới các Pod IPs trên node bị xóa thất bại.
   - ALB lập tức đánh dấu các targets này là `Unhealthy` và chuyển 100% request sang các Pods còn lại tại AZ `ap-southeast-1b`.
2. **Sau 15 - 30 giây (Tầng Kubernetes Control Plane):**
   - Node Controller phát hiện node `ap-southeast-1a` chuyển sang trạng thái `NotReady`.
   - Kubernetes bắt đầu điều phối lại (Evict/Reschedule) các pods bị mất sang trạng thái `Pending`.
3. **Sau 30 - 45 giây (Tầng Karpenter / Auto-scaling):**
   - Karpenter phát hiện có pending pods, gọi ngay AWS API để khởi tạo một EC2 instance mới thay thế.
4. **Sau 55 giây (Trạng thái Phục hồi):**
   - Node mới hoàn tất khởi động và hiển thị trạng thái `Ready`.
   - Các pods mới được deploy lên node mới và chuyển sang trạng thái `Running`.
   - Target Group thêm các targets mới vào và hiển thị `Healthy`.
5. **Bấm dừng đồng hồ (GameDay Timer Stop).**

---

## 4. Báo cáo Tổng kết Diễn tập (GameDay Postmortem Report)

Lưu lại nội dung sau vào hồ sơ `sre/gamedays/gameday-01-node-failure.md`:

```text
=== SRE GAMEDAY POSTMORTEM REPORT ===
Date:                    2026-10-21
Exercise:                Worker Node Termination in ap-southeast-1a
Participants:            SRE Platform Team
Hypothesis:              CONFIRMED (Zero critical disruption)

--- TIMELINE OF EVENTS ---
T+00:00 - Baseline established (k6 40 RPS, 0% errors)
T+00:30 - EC2 instance terminated via AWS Console
T+00:38 - ALB Target Group marked 2 targets Unhealthy, shifted traffic to AZ-b
T+00:52 - Karpenter called EC2 Fleet API for replacement node
T+01:28 - New EC2 node joined cluster and reached Ready state
T+01:35 - Replacement pods Ready and registered with ALB
T+01:40 - Cluster returned to balanced multi-AZ steady state

--- QUANTITATIVE IMPACT ---
Total Requests Sent:     12,450 requests
Failed Requests (5xx):   14 requests (Error rate: 0.11%)
Maximum Latency (p99):   480 ms (Spike during failover)
SLO Status:              MAINTAINED (99.89% Availability >= 99.5% Target)
Error Budget Consumed:   0.014% of monthly budget

--- ACTION ITEMS (CONTINUOUS IMPROVEMENT) ---
1. [AI-01] Giảm ALB Health Check Interval từ 15s xuống 10s để phát hiện node sập nhanh hơn 5s. (Owner: DevOps)
2. [AI-02] Tinh chỉnh preStop hook cho container để flush socket nhanh hơn. (Owner: Dev Team)
```

---

## 5. Điều kiện hoàn thành Gate (Gate Check)

- [ ] Diễn tập GameDay hoàn thành với giả thuyết được chứng minh bằng số liệu thực tế.
- [ ] Không vi phạm điều kiện dừng khẩn cấp (Abort Criteria).
- [ ] Báo cáo GameDay Postmortem được lập với danh sách Action Items cụ thể.

---

## 6. Dọn dẹp tài nguyên (Cleanup)

- Đảm bảo cluster đã trở về trạng thái ổn định với đủ 2 nodes chạy trên 2 AZs.
