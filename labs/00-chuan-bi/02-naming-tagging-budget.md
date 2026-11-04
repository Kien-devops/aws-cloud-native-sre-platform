# 00.02 — Quy ước Đặt tên, Chiến lược Tagging và Thiết lập Ngân sách (Budgets)

> **Trạng thái:** Hướng dẫn thực hành chi tiết trên AWS Management Console (Console-first).  
> **Áp dụng cho:** Quản trị tài nguyên, tối ưu chi phí và cảnh báo tài chính tự động (FinOps/SRE).

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Thiết lập quy ước đặt tên (Naming Convention) chuẩn mực cho toàn bộ tài nguyên hạ tầng AWS.
  - Ban hành chiến lược Tagging đồng nhất để phục vụ giám sát chi phí, quản trị vòng đời và phân quyền bảo mật.
  - Cấu hình **AWS Budgets** trên Console để nhận cảnh báo qua Email khi chi phí thực tế hoặc dự báo vượt ngưỡng 50%, 80%, và 100% ngân sách đề ra.
- **Nguyên tắc SRE:**
  - **Cost as an Architectural Constraint (Chi phí là một ràng buộc kiến trúc):** Không xây dựng hệ thống reliability cao bằng cách "đốt tiền" vô tội vạ. Mọi thành phần đều phải được theo dõi chi phí chi tiết.
  - **Clear Ownership & TTL:** Mọi tài nguyên sinh ra đều phải biết ai sở hữu (`Owner`) và khi nào được phép hủy (`ExpiresAt`).
  - **No Unbudgeted Infrastructure:** Nghiêm cấm tạo tài nguyên tính phí (EKS, NAT Gateway, RDS, ALB) mà không có ngân sách bảo vệ và cảnh báo tự động.

---

## 2. Thông số đầu vào và Quy chuẩn (Standards)

### 2.1. Quy ước Đặt tên (Naming Convention)
Cấu trúc chuẩn: `<dự_án>-<môi_trường>-<thành_phần>-<chi_tiết>`
- Ví dụ VPC: `sre-platform-dev-vpc`
- Ví dụ EKS Cluster: `sre-platform-dev-cluster`
- Ví dụ Node Group: `sre-platform-dev-system-nodes`
- Ví dụ RDS: `sre-platform-dev-rds-pg`
- Ví dụ Secret: `/sre-platform/dev/reliability-shop/credentials`

### 2.2. Bộ Tagging Tiêu chuẩn (Mandatory Tags)

| Tag Key | Giá trị mẫu | Mục đích |
| :--- | :--- | :--- |
| `Project` | `sre-platform` | Gom nhóm toàn bộ chi phí dự án trong Cost Explorer |
| `Environment` | `dev` / `staging` / `prod` | Phân tách ranh giới môi trường và áp dụng chính sách |
| `ManagedBy` | `Console-to-IaC` / `terraform` | Xác định công cụ quản lý trạng thái tài nguyên |
| `Owner` | `sre-team@example.com` | Người chịu trách nhiệm kỹ thuật và chi phí |
| `Component` | `network` / `eks` / `database` | Phân loại module hệ thống |
| `ExpiresAt` | `2026-12-31` | Thời hạn tối đa để rà soát hoặc dọn dẹp môi trường lab |

---

## 3. Các bước thực hiện chi tiết trên AWS Console (Console Steps)

### Bước 1: Kích hoạt User-Defined Cost Allocation Tags

1. Nhập `Billing and Cost Management` vào ô tìm kiếm Console -> Chọn **Billing and Cost Management**.
2. Tại menu bên trái, cuộn xuống mục **Cost organization** -> Chọn **Cost allocation tags**.
3. Chọn tab **User-defined cost allocation tags**:
   - Nếu danh sách trống, bạn cần tạo ít nhất một tài nguyên có tag trước hoặc kiểm tra các tags đã có.
   - Tìm kiếm các keys: `Project`, `Environment`, `Owner`, `Component`.
   - Tích chọn các tag này -> Nhấp nút **Activate**.
   - *Lưu ý:* Sau khi kích hoạt, AWS cần từ 24h để bắt đầu phân tích chi phí theo các tag này trong Cost Explorer.

---

### Bước 2: Thiết lập AWS Budget và Ngưỡng Cảnh báo Chi phí

1. Tại menu bên trái của Billing Console, chọn **Budgets** (hoặc tìm kiếm `AWS Budgets`).
2. Nhấp vào nút cam **Create budget**.
3. **Step 1 - Choose budget type:**
   - Chọn template: **Cost budget (Recommended)**.
   - Hoặc chọn **Customize (Advanced)** -> Chọn **Cost budget** -> Nhấp **Next**.
4. **Step 2 - Set budget details:**
   - **Budget name:** Nhập `sre-platform-dev-monthly-budget`.
   - **Period:** Chọn `Monthly`.
   - **Budget renewal type:** `Recurring budget`.
   - **Budgeting method:** `Fixed`.
   - **Enter your budgeted amount ($):** Nhập mức ngân sách tối đa cho lab (ví dụ: `50.00` USD/tháng).
   - **Budget scope:**
     - Có thể chọn *All AWS services* hoặc lọc theo Tag `Project: sre-platform`.
   - Nhấp **Next**.
5. **Step 3 - Configure alert thresholds:**
   - **Alert 1 (Cảnh báo sớm 50% Thực tế):**
     - Threshold: `50%` of budgeted amount.
     - Trigger: `Actual`.
     - Email recipients: Nhập địa chỉ Email cá nhân/nhóm của bạn.
   - Nhấp **Add alert threshold**:
   - **Alert 2 (Cảnh báo nguy cơ 80% Dự báo - Forecasted):**
     - Threshold: `80%` of budgeted amount.
     - Trigger: `Forecasted` (Cảnh báo khi tốc độ tiêu dùng dự báo sẽ vượt 80% vào cuối tháng).
     - Email recipients: Nhập địa chỉ Email.
   - Nhấp **Add alert threshold**:
   - **Alert 3 (Báo động Đỏ 100% Thực tế):**
     - Threshold: `100%` of budgeted amount.
     - Trigger: `Actual`.
     - Email recipients: Nhập địa chỉ Email.
   - Nhấp **Next**.
6. **Step 4 - Attach actions (Tùy chọn):**
   - Bỏ qua hoặc giữ mặc định -> Nhấp **Next**.
7. **Step 5 - Review and create:**
   - Rà soát lại ngân sách $50/tháng và 3 ngưỡng cảnh báo.
   - Nhấp **Create budget**.

---

## 4. Xác minh (Verification)

### 4.1. Kiểm tra trên Console
- Vào lại trang **AWS Budgets**:
  - Ngân sách `sre-platform-dev-monthly-budget` hiển thị trong bảng.
  - Thanh đo tiến độ (Progress bar) màu xanh hiển thị mức chi tiêu hiện tại so với $50.00.

### 4.2. Kiểm tra bằng AWS CLI

```bash
aws budgets describe-budgets \
  --account-id $(aws sts get-caller-identity --query Account --output text) \
  --output table
```

---

## 5. Chuyển giao sang IaC (Terraform Snippet cho AWS Budget)

```hcl
resource "aws_budgets_budget" "monthly_lab" {
  name              = "sre-platform-dev-monthly-budget"
  budget_type       = "COST"
  limit_amount      = "50"
  limit_unit        = "USD"
  time_unit         = "MONTHLY"
  time_period_start = "2026-10-01_00:00"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 50
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = ["sre-team@example.com"]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = ["sre-team@example.com"]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = ["sre-team@example.com"]
  }
}
```

---

## 6. Điều kiện hoàn thành Gate (Gate Check)

- [ ] Quy ước đặt tên `sre-platform-dev-*` được thống nhất.
- [ ] Bộ 6 tags bắt buộc (`Project`, `Environment`, `ManagedBy`, `Owner`, `Component`, `ExpiresAt`) đã sẵn sàng để gắn vào mọi tài nguyên.
- [ ] AWS Budget $50/tháng đã được khởi tạo thành công với 3 ngưỡng thông báo gửi về Email hợp lệ.
