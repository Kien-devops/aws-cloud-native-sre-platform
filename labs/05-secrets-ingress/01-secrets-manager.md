# 05.01 — AWS Secrets Manager & KMS CMK

> **Trạng thái:** Hướng dẫn thực hành chi tiết trên AWS Management Console (Console-first).  
> **Áp dụng cho:** Môi trường `dev`, phân hệ quản lý bí mật ứng dụng ReliabilityShop.

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** Tạo runtime secret mã hóa bằng khóa riêng (Customer Managed Key - CMK) trong AWS Key Management Service (KMS), thiết lập Resource Policy phân quyền tối thiểu (Least Privilege) cho EKS Pod Identity của External Secrets Operator (ESO).
- **Nguyên tắc SRE:**
  - **Zero Secrets in Git/Logs:** Tuyệt đối không lưu giá trị secret dưới dạng plaintext trong Git commits, manifest, CI logs, terminal history hay Terraform state không bảo mật.
  - **Separation of Duties:** Quản trị viên hạ tầng chỉ tạo Secret metadata/container; ứng dụng chỉ đọc qua Pod Identity; không dùng quyền admin hoặc root để lấy secret.
  - **Auditability:** Mọi thao tác truy xuất secret (`GetSecretValue`) phải được ghi log vào AWS CloudTrail để phát hiện hành vi bất thường.

---

## 2. Thông số đầu vào (Input Parameters)

| Tham số | Giá trị mẫu / Quy ước | Ý nghĩa |
| :--- | :--- | :--- |
| **AWS Region** | `ap-southeast-1` (hoặc Region bạn chọn) | Vùng triển khai của cluster EKS và RDS |
| **KMS Key Alias** | `alias/sre-platform-dev-secrets` | Customer Managed Key (CMK) mã hóa secret |
| **Secret Name** | `/sre-platform/dev/reliability-shop/credentials` | Tên secret theo đường dẫn phân cấp (hierarchical path) |
| **Secret Type** | `Other type of secret` (Key/value) | Cặp key/value cho thông tin xác thực ứng dụng |
| **ESO Pod Identity Role** | `arn:aws:iam::<ACCOUNT_ID>:role/sre-platform-dev-eso-role` | IAM Role được cấp cho ServiceAccount của ESO |
| **Rotation Strategy** | Tắt ở pha dev (bật ở pha prod kèm Lambda rotator) | Tránh gián đoạn kết nối khi chưa có dynamic pool |

---

## 3. Các bước thực hiện chi tiết trên AWS Console (Console Steps)

### Bước 1: Kiểm tra hoặc tạo KMS Customer Managed Key (CMK)
*(Nếu chưa có KMS Key riêng cho secret, thực hiện bước này; nếu đã có, chuyển sang Bước 2)*

1. Đăng nhập vào **AWS Management Console**, chọn đúng **Region** (ví dụ `ap-southeast-1`).
2. Nhập `KMS` vào thanh tìm kiếm trên cùng (phím tắt `Alt + S`), chọn **Key Management Service**.
3. Tại menu bên trái, nhấp vào **Customer managed keys** -> Nhấp nút cam **Create key**.
4. **Step 1 - Configure key**:
   - **Key type:** Chọn `Symmetric`.
   - **Key usage:** Chọn `Encrypt and decrypt`.
   - **Advanced options:** Chọn `KMS` (mặc định), nhấp **Next**.
5. **Step 2 - Add labels**:
   - **Alias:** Nhập `sre-platform-dev-secrets`.
   - **Description:** `KMS CMK for SRE Platform Dev Secrets Manager`.
   - **Tags:** Thêm `Environment` = `dev`, `Project` = `sre-platform`.
   - Nhấp **Next**.
6. **Step 3 - Define key administrative permissions**:
   - Chọn IAM User hoặc Role của bạn làm Key Administrator.
   - Nhấp **Next**.
7. **Step 4 - Define key usage permissions**:
   - Chọn Role quản trị hoặc Role của EKS cluster / ESO nếu đã có.
   - Nhấp **Next** -> Xem lại JSON Policy -> Nhấp **Finish**.

---

### Bước 2: Điều hướng đến AWS Secrets Manager

1. Nhập `Secrets Manager` vào thanh tìm kiếm Console -> Chọn dịch vụ **AWS Secrets Manager**.
2. Đảm bảo bạn đang ở đúng Region của cluster EKS.
3. Nhấp vào nút cam **Store a new secret**.

---

### Bước 3: Cấu hình Secret Type và Key/Value Pairs

1. Tại mục **Secret type**:
   - Chọn radio button **Other type of secret** (API key, OAuth token, other).
2. Tại mục **Key/value pairs**:
   - Chọn tab **Key/value** (mặc định).
   - Nhập các cặp khóa/giá trị cho ứng dụng ReliabilityShop:
     - Dòng 1: **Key:** `DB_USER` — **Value:** `sre_admin`
     - Nhấp **Add row**:
     - Dòng 2: **Key:** `DB_PASSWORD` — **Value:** `<Nhập mật khẩu ngẫu nhiên độ phức tạp cao, tối thiểu 16 ký tự>`
     - Nhấp **Add row**:
     - Dòng 3: **Key:** `DB_NAME` — **Value:** `reliability_shop`
     - Nhấp **Add row**:
     - Dòng 4: **Key:** `REDIS_AUTH` — **Value:** `<Nhập chuỗi token ngẫu nhiên>`
     - Nhấp **Add row**:
     - Dòng 5: **Key:** `JWT_SECRET` — **Value:** `<Nhập chuỗi base64 ngẫu nhiên 64 bytes>`
   > [!WARNING]
   > Tuyệt đối không chụp màn hình có giá trị plaintext của ô **Value** hoặc sao chép giá trị này vào bất kỳ tài liệu nào.
3. Tại mục **Encryption key**:
   - Không chọn `aws/secretsmanager` (khóa mặc định chia sẻ).
   - Nhấp vào dropdown **Encryption key** -> Chọn Customer Managed Key vừa tạo: `alias/sre-platform-dev-secrets`.
4. Nhấp nút **Next** ở cuối trang.

---

### Bước 4: Thiết lập Tên Secret, Resource Policy và Tags

1. **Secret name**:
   - Nhập: `/sre-platform/dev/reliability-shop/credentials`
   - *Ghi chú:* Việc dùng tiền tố dạng thư mục (`/sre-platform/dev/...`) giúp dễ dàng phân quyền IAM theo path và gom nhóm tài nguyên.
2. **Description**:
   - Nhập: `Runtime database and token credentials for ReliabilityShop microservices (dev environment)`.
3. **Resource permissions (Tùy chọn - Phân quyền tối thiểu)**:
   - Nhấp nút **Edit permissions** (nếu muốn khóa chặt chỉ cho phép Pod Identity Role truy cập).
   - Bạn có thể gắn policy giới hạn quyền đọc chỉ cho IAM Role của ESO:
     ```json
     {
       "Version": "2012-10-17",
       "Statement": [
         {
           "Effect": "Allow",
           "Principal": {
             "AWS": "arn:aws:iam::<ACCOUNT_ID>:role/sre-platform-dev-eso-role"
           },
           "Action": [
             "secretsmanager:GetSecretValue",
             "secretsmanager:DescribeSecret"
           ],
           "Resource": "*"
         }
       ]
     }
     ```
   - Nhấp **Save**.
4. **Tags**:
   - Thêm các tag bắt buộc theo chuẩn governance:
     - `Environment`: `dev`
     - `Project`: `sre-platform`
     - `Component`: `reliability-shop`
     - `ManagedBy`: `Console-to-IaC`
     - `DataClassification`: `Confidential`
5. Nhấp nút **Next**.

---

### Bước 5: Cấu hình Rotation (Xoay vòng bảo mật)

1. Tại mục **Automatic rotation**:
   - Giữ nguyên tùy chọn mặc định: **Disable automatic rotation**.
   - *Giải thích SRE:* Trong môi trường lab `dev`, việc bật automatic rotation yêu cầu một Lambda function chuyên dụng chạy trong VPC kết nối tới RDS/ElastiCache và có cơ chế rolling reload pod. Để đảm bảo tính độc lập của lab, bước này sẽ cấu hình sau khi RDS và microservices đã sẵn sàng.
2. Nhấp nút **Next**.

---

### Bước 6: Review và Lưu Secret

1. Kiểm tra lại toàn bộ thông tin:
   - **Secret type:** Other type of secret.
   - **Encryption key:** `alias/sre-platform-dev-secrets`.
   - **Secret name:** `/sre-platform/dev/reliability-shop/credentials`.
   - **Tags:** Đã đủ 5 tags tiêu chuẩn.
2. Nhấp nút **Store** ở góc dưới cùng bên phải.
3. Chờ Console hiển thị thông báo màu xanh: `Secret stored successfully`.

---

## 4. Xác minh (Verification)

### 4.1. Kiểm tra trực quan trên Console
- Trong danh sách **Secrets**, nhấp vào secret `/sre-platform/dev/reliability-shop/credentials`.
- Xác nhận:
  - **Secret ARN:** Có định dạng `arn:aws:secretsmanager:<region>:<account-id>:secret:/sre-platform/dev/reliability-shop/credentials-xxxxxx`.
  - **KMS Key ARN:** Trỏ đúng về khóa `alias/sre-platform-dev-secrets`.
  - **Rotation status:** Disabled.
  - **Tags:** Đầy đủ.
- *Lưu ý:* Không bấm nút **Retrieve secret value** để tránh tạo audit log không cần thiết trong CloudTrail.

### 4.2. Kiểm tra bằng AWS CLI (Từ terminal quản trị)

Chạy lệnh kiểm tra metadata (chỉ lấy thông tin cấu hình, không in giá trị secret):

```bash
aws secretsmanager describe-secret \
  --secret-id /sre-platform/dev/reliability-shop/credentials \
  --query '{Name:Name,ARN:ARN,KmsKeyId:KmsKeyId,Tags:Tags,LastChangedDate:LastChangedDate}' \
  --output table
```

Kiểm tra quyền giải mã của KMS key:

```bash
aws kms describe-key \
  --key-id alias/sre-platform-dev-secrets \
  --query 'KeyMetadata.{KeyId:KeyId,Arn:Arn,KeyState:KeyState,Origin:Origin}' \
  --output table
```

---

## 5. Chuyển giao sang IaC (Terraform Import Guide)

Theo quy trình tại **Mục 13 của README**, sau khi tạo thử nghiệm thành công trên Console, chuyển đổi cấu hình sang Terraform:

### 5.1. Định nghĩa file Terraform (`iac/terraform/modules/secrets/main.tf`)

```hcl
data "aws_kms_key" "secrets" {
  key_id = "alias/sre-platform-dev-secrets"
}

resource "aws_secretsmanager_secret" "reliability_shop" {
  name                    = "/sre-platform/dev/reliability-shop/credentials"
  description             = "Runtime credentials for ReliabilityShop microservices (dev environment)"
  kms_key_id             = data.aws_kms_key.secrets.arn
  recovery_window_in_days = 7

  tags = {
    Environment        = "dev"
    Project            = "sre-platform"
    Component          = "reliability-shop"
    ManagedBy          = "terraform"
    DataClassification = "Confidential"
  }
}
```

### 5.2. Thực hiện Import vào State

```bash
terraform import aws_secretsmanager_secret.reliability_shop arn:aws:secretsmanager:ap-southeast-1:<ACCOUNT_ID>:secret:/sre-platform/dev/reliability-shop/credentials-xxxxxx
```

Chạy `terraform plan` để đảm bảo **No changes. Your infrastructure matches the configuration.** (Không có drift).

---

## 6. Output & Bằng chứng thực nghiệm (Evidence Template)

Sau khi hoàn tất, lưu lại thông tin vào hồ sơ lab (đã che Account ID):

```text
=== LAB 05.01 EVIDENCE ===
Timestamp:        2026-10-21T01:15:00Z
Region:           ap-southeast-1
Secret Name:      /sre-platform/dev/reliability-shop/credentials
Secret ARN:       arn:aws:secretsmanager:ap-southeast-1:***REDACTED***:secret:/sre-platform/dev/reliability-shop/credentials-AbCdEf
KMS Key ID:       arn:aws:kms:ap-southeast-1:***REDACTED***:alias/sre-platform-dev-secrets
Rotation Status:  Disabled
Access Policy:    Least-Privilege for ESO Pod Identity Role
Plaintext Check:  CONFIRMED NO SECRETS IN GIT OR CLI LOGS
```

---

## 7. Điều kiện hoàn thành Gate (Gate Check)

- [ ] Secret `/sre-platform/dev/reliability-shop/credentials` tồn tại và ở trạng thái Active.
- [ ] Khóa mã hóa là Customer Managed Key (`alias/sre-platform-dev-secrets`), không dùng khóa mặc định.
- [ ] Toàn bộ 5 cặp key/value đã được lưu đầy đủ trên Console.
- [ ] Không có bất kỳ giá trị mật khẩu/token nào xuất hiện trong git, output logs, hay terminal history.
- [ ] Đã sẵn sàng ARN của Secret để cấu hình cho External Secrets Operator ở bài tiếp theo.

---

## 8. Dọn dẹp tài nguyên (Cleanup)

Nếu cần hủy môi trường thử nghiệm:
1. Vào **AWS Secrets Manager Console** -> Chọn secret `/sre-platform/dev/reliability-shop/credentials`.
2. Chọn menu **Actions** -> Nhấp **Delete secret**.
3. Tại ô **Waiting period**, chọn `7` ngày (mặc định) hoặc chọn số ngày ngắn nhất.
4. *Lệnh CLI xóa ngay lập tức nếu cần dọn sạch triệt để (chỉ dùng cho môi trường lab):*
   ```bash
   aws secretsmanager delete-secret \
     --secret-id /sre-platform/dev/reliability-shop/credentials \
     --force-delete-without-recovery
   ```
