# 08.06 — Diễn tập Tự động Hủy bỏ và Hoàn nguyên Nhanh (Automated Abort & Instant Rollback Drill)

> **Trạng thái:** Hướng dẫn thực hành diễn tập sự cố triển khai phiên bản lỗi (Bad Release Drill).  
> **Áp dụng cho:** Nghiệm thu khả năng tự bảo vệ của hệ thống: Tự động ngắt traffic độc hại, hoàn nguyên về bản ổn định trong vòng dưới 60 giây và bảo toàn Ngân sách Lỗi (Error Budget).

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Mô phỏng một sự cố phát hành điển hình: Đẩy một phiên bản lỗi (**Bad Canary Image: v1.2.0-buggy**) cố tình trả về mã lỗi HTTP 500 trên 10% các request.
  - Chứng minh rằng bộ điều phối **Argo Rollouts** kết hợp với **Prometheus AnalysisRun** tự động phát hiện tỷ lệ lỗi tăng vọt (`Error Rate > 0.5%`) ngay tại bước thử nghiệm 5% traffic đầu tiên.
  - Đo đạc thời gian thực hiện cơ chế **Auto-Abort**: Ngay khi phân tích thất bại, hệ thống lập tức ngắt toàn bộ traffic khỏi bản canary, kéo trọng số về 0%, và điều hướng 100% người dùng trở lại phiên bản ổn định (`Stable ReplicaSet`) mà không cần con người can thiệp.
  - Xác nhận rằng tác động tiêu hao Error Budget được giới hạn ở mức cực nhỏ (< 0.05% ngân sách tháng).
- **Nguyên tắc SRE:**
  - **Fail Safely and Revert Automatically:** Hệ thống phải có khả năng tự nhận biết mình đang bị lỗi và tự đưa về trạng thái an toàn trước khi con người kịp nhận được tin nhắn báo động.
  - **No Manual Rollbacks Under Panic:** Trong các vụ outage nửa đêm, con người thường hoảng loạn và dễ gõ nhầm lệnh. Việc tự động hóa quy trình rollback là biện pháp duy nhất giúp giảm thiểu triệt để chỉ số MTTR (Mean Time to Recovery).
  - **Zero Data Loss during Workload Rollback:** Lưu ý rằng Rollback workload chỉ khôi phục mã nguồn container; schema database phải luôn tuân thủ nguyên tắc tương thích ngược (Expand/Contract) để tránh làm hỏng dữ liệu khi code quay về phiên bản cũ.

---

## 2. Kịch bản Diễn tập Sự cố (Step-by-Step Drill)

### Bước 1: Chuẩn bị và Phát hành Phiên bản Lỗi (Bad Canary Release)

Cập nhật file `gitops/applications/reliability-shop/envs/dev/kustomization.yaml` để trỏ tới image lỗi:

```yaml
# Cố tình đổi sang phiên bản có bug gây lỗi 500
images:
  - name: <ACCOUNT_ID>.dkr.ecr.ap-southeast-1.amazonaws.com/reliabilityshop/order-service
    newTag: git-v1.2.0-buggy
```

Áp dụng thay đổi vào cluster:
```bash
kubectl apply -k gitops/applications/reliability-shop/envs/dev/
```

---

### Bước 2: Bơm Tải Người dùng qua k6 hoặc Lệnh Curl

Để Prometheus có đủ mẫu dữ liệu (Sample Size) tính toán tỷ lệ lỗi, chạy script tạo traffic nền:

```bash
# Gửi 100 requests liên tục vào endpoint Order API
for i in {1..100}; do
  curl -s -o /dev/null -w "%{http_code}\n" https://shop.dev.sreplatform.yourdomain.com/api/v1/orders \
    -H "Content-Type: application/json" \
    -d '{"item_id":"test","quantity":1}'
  sleep 0.2
done
```

Quan sát kết quả:
- Khoảng 95% requests trả về `201 Created` (phục vụ bởi 4 pods Stable v1.0.0).
- Khoảng 5% requests trả về `500 Internal Server Error` (rơi vào 1 pod Canary v1.2.0-buggy).

---

### Bước 3: Quan sát Tiến trình Tự động Abort trên Terminal

Chạy lệnh theo dõi Rollout:

```bash
kubectl argo rollouts get rollout order-service -n reliability-shop --watch
```

**Tiến trình diễn ra trong thực tế:**
1. **Phép đo 1 (Sau 30s):** `AnalysisRun` truy vấn Prometheus -> Thấy tỷ lệ lỗi là `5.2%` (vượt xa ngưỡng cho phép `<= 0.5%`) -> Đánh dấu thất bại lần 1 (`✖ 1`).
2. **Phép đo 2 (Sau 60s):** Phép đo tiếp tục thất bại lần 2 (`✖ 2`) -> Đạt ngưỡng `failureLimit: 2`.
3. **Kích hoạt Auto-Abort:**
   - Trạng thái Rollout lập tức đổi sang: **STATUS: Degraded (RolloutAborted)**.
   - Message cảnh báo: `Rollout aborted: metric 'error-rate-check' failed '2' times`.
   - Ngay lập tức, trọng số traffic của Canary bị gạt về `0%`.
   - 100% lưu lượng của người dùng được bảo vệ an toàn bởi phiên bản cũ (`order-service-stable`).
   - Pod của bản lỗi v1.2.0 bị thu hồi và xóa bỏ (`Scale down to 0`).

---

### Bước 4: Kiểm chứng Phục hồi Sau Rollback (Post-Rollback Health Check)

Chạy lại lệnh kiểm tra sức khỏe từ máy trạm:

```bash
# Kiểm tra 20 requests liên tiếp
for i in {1..20}; do
  curl -s -o /dev/null -w "%{http_code} " https://shop.dev.sreplatform.yourdomain.com/health
done
```

**Kết quả mong đợi:** 100% các request đều trả về mã `200 200 200 ... 200`. Hệ thống hoàn toàn hồi phục, tỷ lệ lỗi trở về `0%`!

---

## 3. Mẫu Báo cáo Diễn tập Hủy bỏ Phát hành (Canary Abort Report)

Lưu lại nội dung sau vào hồ sơ nghiệm thu `sre/incidents/drill-canary-abort.md`:

```text
=== CANARY AUTO-ABORT & ROLLBACK DRILL REPORT ===
Timestamp:               2026-10-21T02:45:00Z
Target Microservice:     order-service
Fault Introduced:        High Error Rate (10% HTTP 500 in v1.2.0-buggy)
Traffic Weight at Fault: 5% (Canary phase 1)
Detector:                Argo Rollouts AnalysisTemplate (Prometheus PromQL)
Failure Threshold:       Error rate > 0.5% (Measured: 5.2%)
Reaction Time (MTTD):    60 seconds (2 analysis cycles of 30s)
Recovery Time (MTTR):    12 seconds (Instant traffic cutback)
Total Outage Duration:   72 seconds
User Impact:             5 bad requests out of 100 total requests
Error Budget Impact:     Consumed 0.02% of 30-day budget (Minimal)
Rollback Status:         SUCCESS (Auto-aborted without human intervention)
```

---

## 4. Điều kiện hoàn thành Gate (Gate Check)

- [ ] Phiên bản lỗi được phát hiện tự động bởi Prometheus Metric Analysis.
- [ ] Argo Rollouts tự động kích hoạt `Abort` và hạ traffic của Canary về 0%.
- [ ] Hệ thống tự khôi phục trạng thái phục vụ ổn định 100% trong vòng dưới 90 giây.
- [ ] Không cần sự can thiệp thủ công của kỹ sư để thực hiện rollback.

---

## 5. Dọn dẹp tài nguyên (Cleanup)

Khôi phục Rollout về trạng thái sạch:
```bash
# Retry rollout với phiên bản ổn định
kubectl argo rollouts retry rollout order-service -n reliability-shop
```
