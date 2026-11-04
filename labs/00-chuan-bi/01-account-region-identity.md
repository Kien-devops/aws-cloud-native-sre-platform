# 00.01 — Thiết lập Tài khoản, Region và Danh tính Quản trị

> **Trạng thái:** Hướng dẫn thực hành chi tiết trên AWS Management Console (Console-first).  
> **Áp dụng cho:** Thiết lập môi trường thực hành SRE an toàn, xác thực Region và kiểm tra hạn ngạch dịch vụ (Service Quotas).

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Xác nhận danh tính người dùng quản trị, loại bỏ hoàn toàn việc sử dụng AWS Root Account cho các tác vụ lab.
  - Chọn và khóa chặt AWS Region thống nhất (`ap-southeast-1` - Singapore hoặc Region bạn chọn) có tối thiểu 2 Availability Zones hỗ trợ đầy đủ EKS, RDS, ElastiCache.
  - Kiểm tra hạn ngạch tài nguyên (Service Quotas) trước khi triển khai để tránh gián đoạn giữa chừng do chạm trần giới hạn tài nguyên của AWS.
- **Nguyên tắc SRE:**
  - **Preflight Validation (Kiểm tra tiền trạm):** Không bắt đầu dựng hạ tầng nếu các điều kiện tiên quyết về hạn ngạch (EIP, VPC, vCPU) chưa được chứng minh là đủ.
  - **Principle of Least Privilege & Root Isolation:** Tài khoản Root chỉ dùng để thiết lập ban đầu và khẩn cấp; toàn bộ hoạt động lab phải dùng IAM User hoặc IAM Identity Center Role có MFA.
  - **Blast Radius Containment:** Thực hiện trên AWS Account độc lập dành riêng cho Sandbox/Lab, không dùng chung với môi trường Production hay tài khoản cá nhân có dữ liệu nhạy cảm.

---

## 2. Thông số đầu vào (Input Parameters)

| Tham số | Giá trị chuẩn | Ý nghĩa |
| :--- | :--- | :--- |
| **AWS Region** | `ap-southeast-1` | Singapore (độ trễ thấp về VN, hỗ trợ đầy đủ tính năng) |
| **Mục tiêu AZ** | Tối thiểu 2 AZs (`ap-southeast-1a`, `ap-southeast-1b`) | Bắt buộc cho thiết kế High Availability (HA) |
| **Admin Principal** | IAM User `sre-admin` hoặc SSO Role | Danh tính quản trị có phân quyền `AdministratorAccess` |
| **MFA Status** | Enforced (Bắt buộc) | Xác thực 2 yếu tố phần cứng hoặc TOTP app |

---

## 3. Các bước thực hiện chi tiết trên AWS Console (Console Steps)

### Bước 1: Kiểm tra Danh tính và Đăng xuất Root Account

1. Đăng nhập vào **AWS Management Console**.
2. Nhìn lên góc trên cùng bên phải màn hình (khu vực hiển thị tên người dùng/Account ID):
   - Nếu hiển thị địa chỉ Email quản trị (chính là Root User): **Nguy hiểm!**
   - Lập tức vào **IAM > Users** -> Tạo người dùng mới `sre-admin` -> Bật quyền Console Access -> Gắn chính sách `AdministratorAccess` -> Cấu hình thiết bị MFA (Google Authenticator / Authy).
   - **Đăng xuất khỏi Root User** và đăng nhập lại bằng `sre-admin`.
3. Kiểm tra thông tin hiển thị tại góc trên phải:
   - Phải có dạng `sre-admin @ <account-alias-or-id>`.

---

### Bước 2: Thiết lập và Khóa Region Thực hành

1. Tại thanh điều hướng trên cùng, nhấp vào tên Region hiện tại (cạnh tên tài khoản).
2. Chọn **Asia Pacific (Singapore) ap-southeast-1** (hoặc Region bạn chọn triển khai dự án).
3. Ghi nhớ mã Region (`ap-southeast-1`) để áp dụng xuyên suốt cho tất cả các bài lab tiếp theo.

---

### Bước 3: Kiểm tra Tính khả dụng của các Availability Zones

1. Nhập `EC2` vào thanh tìm kiếm Console -> Chọn **EC2**.
2. Tại màn hình **EC2 Dashboard**, kéo xuống khung **Service health / Zones**:
   - Xác nhận có ít nhất 2 Zones ở trạng thái **Normal**:
     - `ap-southeast-1a`
     - `ap-southeast-1b`
     - `ap-southeast-1c`
3. Nhấp vào **Zones** để xác nhận zone ID không bị suy giảm dịch vụ (impaired).

---

### Bước 4: Kiểm tra Service Quotas Tiền trạm (Preflight Quota Checks)

1. Nhập `Service Quotas` vào thanh tìm kiếm Console -> Chọn dịch vụ **Service Quotas**.
2. Tại menu bên trái, nhấp vào **AWS services**.
3. **Kiểm tra Amazon VPC Quotas:**
   - Tìm kiếm `Amazon Virtual Private Cloud (Amazon VPC)`:
     - **VPCs per Region:** Mặc định `5` (đảm bảo còn trống ít nhất 1).
     - **Internet gateways per Region:** Mặc định `5`.
     - **NAT gateways per Availability Zone:** Mặc định `5` (đảm bảo quota > 0).
     - **EC2-VPC Elastic IPs:** Mặc định `5` (đảm bảo chưa dùng hết 5 EIP, vì NAT Gateway cần EIP).
4. **Kiểm tra Amazon EC2 Quotas (Dành cho Worker Nodes):**
   - Tìm kiếm `Amazon Elastic Compute Cloud (Amazon EC2)`:
     - Tìm `Running On-Demand Standard (A, C, D, I, M, R, T, Z) instances`: Mặc định `32 vCPUs` (đảm bảo tài khoản mới không bị hạn chế mức 0).
5. **Kiểm tra Amazon EKS Quotas:**
   - Tìm kiếm `Amazon Elastic Kubernetes Service (Amazon EKS)`:
     - **Clusters:** Mặc định `100` (đảm bảo tài khoản được phép tạo cluster).
6. **Kiểm tra Amazon RDS Quotas:**
   - Tìm kiếm `Amazon Relational Database Service (Amazon RDS)`:
     - **DB instances:** Mặc định `40`.

> [!WARNING]
> Với các tài khoản AWS mới lập (Free Tier / New Account), AWS thường áp dụng hạn mức nghiêm ngặt (ví dụ vCPU On-Demand = 0 hoặc EIP = 0). Nếu phát hiện quota bị 0, phải nhấp **Request quota increase** và chờ AWS hỗ trợ duyệt trước khi thực hành.

---

## 4. Xác minh (Verification)

Chạy các lệnh AWS CLI từ CloudShell hoặc terminal máy trạm để kiểm tra danh tính và quota:

```bash
# 1. Xác thực danh tính caller hiện tại
aws sts get-caller-identity --output table

# 2. Liệt kê các Availability Zones khả dụng
aws ec2 describe-availability-zones \
  --region ap-southeast-1 \
  --query 'AvailabilityZones[?State==`available`].{ZoneName:ZoneName,ZoneId:ZoneId}' \
  --output table

# 3. Kiểm tra số lượng Elastic IP hiện có
aws ec2 describe-addresses \
  --region ap-southeast-1 \
  --query 'length(Addresses)'
```

---

## 5. Output & Bằng chứng thực nghiệm (Evidence Template)

```text
=== LAB 00.01 EVIDENCE ===
Timestamp:        2026-10-21T01:45:00Z
Account Alias:    sre-platform-sandbox
Account ID:       ***REDACTED***
Caller ARN:       arn:aws:iam::***REDACTED***:user/sre-admin
MFA Active:       YES
Target Region:    ap-southeast-1
Available AZs:    ap-southeast-1a, ap-southeast-1b, ap-southeast-1c
Elastic IP Used:  0 / 5 Quota
vCPU Quota:       32 Standard On-Demand vCPUs Available
Preflight Status: PASSED
```

---

## 6. Điều kiện hoàn thành Gate (Gate Check)

- [ ] Không sử dụng Root User để thao tác; MFA đã kích hoạt trên IAM User/SSO Role.
- [ ] Khóa Region duy nhất `ap-southeast-1` cho toàn bộ các bài lab.
- [ ] Tối thiểu 2 Availability Zones hoạt động bình thường.
- [ ] Đã xác nhận còn đủ hạn ngạch: VPC, Elastic IP (tối thiểu 2), NAT Gateway và EC2 vCPU.
