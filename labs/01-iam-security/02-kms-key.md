# 01.02 — Quản trị Khóa Mã hóa KMS Customer Managed Key (CMK)

> **Trạng thái:** Hướng dẫn thực hành chi tiết trên AWS Management Console (Console-first).  
> **Áp dụng cho:** Quản trị vòng đời khóa mã hóa dữ liệu tĩnh (Encryption at Rest) cho EKS Secrets, EBS Volumes, RDS PostgreSQL và Secrets Manager.

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Tạo Customer Managed Key (CMK) đối xứng (Symmetric Encryption Key) trong AWS Key Management Service (KMS).
  - Bật tính năng **Automatic Key Rotation** (Xoay vòng khóa tự động hàng năm do AWS quản lý).
  - Phân tách rõ ràng giữa quyền quản trị khóa (Key Administrator) và quyền sử dụng khóa để mã hóa/giải mã (Key User).
  - Cấu hình Key Policy tuân thủ Least Privilege, cấm triệt để việc mở `Principal: *` với `kms:*`.
- **Nguyên tắc SRE:**
  - **Envelope Encryption & Defense in Depth:** Tất cả dữ liệu tĩnh (từ etcd secrets, cơ sở dữ liệu RDS đến volume đĩa cứng EC2) đều phải được mã hóa bằng khóa riêng biệt, không dùng khóa mặc định chung `aws/*`.
  - **Separation of Duties (Tách biệt quyền hạn):** Quản trị viên hệ thống có thể tạo và audit khóa nhưng không nhất thiết phải có quyền giải mã dữ liệu nghiệp vụ của ứng dụng.
  - **Disaster Recovery & Deletion Guardrails:** Khóa KMS không thể bị xóa ngay lập tức; bắt buộc phải trải qua thời gian chờ (Waiting period từ 7 đến 30 ngày) để ngăn ngừa thảm họa xóa nhầm dẫn đến mất vĩnh viễn quyền truy cập dữ liệu.

---

## 2. Thông số đầu vào (Input Parameters)

| Tham số | Giá trị mẫu / Quy ước | Ý nghĩa |
| :--- | :--- | :--- |
| **AWS Region** | `ap-southeast-1` | Khóa KMS gắn liền với một Region cụ thể |
| **Key Type** | `Symmetric` | Khóa đối xứng dùng cho Encrypt và Decrypt |
| **Key Alias** | `alias/sre-platform-dev-main` | Tên định danh dễ nhớ của khóa |
| **Key Rotation** | `Enabled` (Bật) | Tự động sinh phiên bản khóa mới sau mỗi 365 ngày |
| **Deletion Window** | `7 days` (cho môi trường dev) | Thời gian ân hạn trước khi khóa bị hủy vĩnh viễn |

---

## 3. Các bước thực hiện chi tiết trên AWS Console (Console Steps)

### Bước 1: Điều hướng đến AWS KMS Console

1. Đăng nhập vào **AWS Management Console**, chọn Region `ap-southeast-1`.
2. Nhập `KMS` vào ô tìm kiếm -> Chọn dịch vụ **Key Management Service**.
3. Tại menu bên trái, nhấp vào **Customer managed keys**.
4. Nhấp vào nút cam **Create key**.

---

### Bước 2: Cấu hình Loại Khóa (Configure Key)

1. **Key type:** Chọn radio button **Symmetric** (Mặc định).
2. **Key usage:** Chọn **Encrypt and decrypt** (Mặc định).
3. **Advanced options:**
   - **Key material origin:** Chọn `KMS` (Mặc định).
   - **Regionality:** Chọn `Single-Region key` (Trong giai đoạn đầu lab đơn Region; nếu sau này làm Multi-Region DR sẽ đổi sang Multi-Region key).
4. Nhấp nút **Next**.

---

### Bước 3: Thêm Nhãn và Định danh Khóa (Add Labels)

1. **Alias:** Nhập `sre-platform-dev-main`.
   *(Tiền tố `alias/` sẽ được AWS tự động thêm vào)*.
2. **Description:** Nhập `Main CMK for SRE Platform Dev: EKS, Secrets Manager, and RDS`.
3. **Tags:**
   - `Environment`: `dev`
   - `Project`: `sre-platform`
   - `ManagedBy`: `Console-to-IaC`
   - `SecurityClassification`: `Confidential`
4. Nhấp nút **Next**.

---

### Bước 4: Phân quyền Quản trị Khóa (Define Key Administrative Permissions)

1. Tại danh sách IAM Users và Roles:
   - Tích chọn tài khoản admin của bạn (ví dụ `sre-admin`).
   - Tích chọn vai trò quản trị `AdministratorAccess` (nếu dùng SSO).
2. Tại mục **Key deletion:**
   - Giữ tích chọn **Allow key administrators to delete this key** (cho phép người quản trị lên lịch xóa khóa khi cần dọn dẹp).
3. Nhấp nút **Next**.

---

### Bước 5: Phân quyền Sử dụng Khóa (Define Key Usage Permissions)

1. Chọn các IAM Roles và AWS Services sẽ được phép mã hóa/giải mã bằng khóa này:
   - Tích chọn vai trò của bạn (`sre-admin`).
   - Tích chọn Role EKS Cluster hoặc Role Pod Identity (nếu đã tạo từ các bước trước).
2. Tại mục **Other AWS accounts:**
   - Để trống (không chia sẻ khóa sang tài khoản AWS khác).
3. Nhấp nút **Next**.

---

### Bước 6: Xem lại Policy và Bật Tự động Xoay vòng Khóa (Key Rotation)

1. Tại màn hình **Review**:
   - Kiểm tra mã JSON Key Policy. Đảm bảo có Statement cho phép Root account ủy quyền và Statement giới hạn quyền của Key Administrators.
2. Nhấp **Finish** để hoàn tất tạo khóa.
3. Trong danh sách Customer managed keys, nhấp vào Alias `sre-platform-dev-main`:
   - Chuyển sang tab **Key rotation**.
   - Kiểm tra mục **Automatically rotate this KMS key every year**:
   - Nếu chưa bật, nhấp vào ô checkbox **Rotate this KMS key every year** -> Nhấp nút **Save**.
4. Sao chép lại **Key ARN** (dạng `arn:aws:kms:ap-southeast-1:<ACCOUNT_ID>:key/<UUID>`).

---

## 4. Xác minh (Verification)

### 4.1. Kiểm tra trên Console
- Trạng thái khóa: **Enabled**.
- Key rotation: **Enabled**.
- Key Policy: Không có `Principal: *` với `kms:*`.

### 4.2. Kiểm tra bằng AWS CLI

```bash
# 1. Kiểm tra chi tiết cấu hình và trạng thái của khóa
aws kms describe-key \
  --key-id alias/sre-platform-dev-main \
  --query 'KeyMetadata.{KeyId:KeyId,Arn:Arn,Enabled:Enabled,KeyState:KeyState,KeyManager:KeyManager}' \
  --output table

# 2. Xác nhận tính năng tự động xoay vòng khóa đã bật
aws kms get-key-rotation-status \
  --key-id alias/sre-platform-dev-main \
  --output table

# 3. Thử nghiệm mã hóa một chuỗi thử nghiệm
aws kms encrypt \
  --key-id alias/sre-platform-dev-main \
  --plaintext $(echo -n "SRE_KMS_TEST_STRING" | base64) \
  --query CiphertextBlob \
  --output text
```

---

## 5. Chuyển giao sang IaC (Terraform Snippet)

```hcl
resource "aws_kms_key" "main" {
  description             = "Main CMK for SRE Platform Dev: EKS, Secrets Manager, and RDS"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = {
    Environment = "dev"
    Project     = "sre-platform"
    ManagedBy   = "terraform"
  }
}

resource "aws_kms_alias" "main" {
  name          = "alias/sre-platform-dev-main"
  target_key_id = aws_kms_key.main.key_id
}
```

---

## 6. Điều kiện hoàn thành Gate (Gate Check)

- [ ] Khóa KMS CMK `alias/sre-platform-dev-main` ở trạng thái `Enabled`.
- [ ] Tính năng `Automatic Key Rotation` đã được bật và xác nhận qua CLI.
- [ ] Key Policy tách biệt rõ Key Admin và Key User.
- [ ] Thử nghiệm lệnh mã hóa `aws kms encrypt` trả về chuỗi Ciphertext thành công.

---

## 7. Dọn dẹp tài nguyên (Cleanup)

> [!CAUTION]
> Tuyệt đối không lên lịch xóa khóa (Schedule key deletion) nếu khóa đang được dùng để mã hóa EBS volume của EKS Node hoặc RDS Database. Nếu xóa khóa, dữ liệu sẽ không thể giải mã và bị mất vĩnh viễn.

Khi chắc chắn toàn bộ tài nguyên phụ thuộc đã được dọn sạch:
1. Vào **KMS Console** -> **Customer managed keys** -> Chọn `sre-platform-dev-main`.
2. Chọn menu **Key actions** -> Nhấp **Schedule key deletion**.
3. Chọn số ngày chờ ân hạn: `7` ngày (mức tối thiểu cho phép).
4. Tích chọn xác nhận và nhấp **Schedule deletion**.
