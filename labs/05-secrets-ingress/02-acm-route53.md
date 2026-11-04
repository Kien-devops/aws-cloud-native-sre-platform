# 05.02 — AWS Certificate Manager (ACM) & Route 53 DNS

> **Trạng thái:** Hướng dẫn thực hành chi tiết trên AWS Management Console (Console-first).  
> **Áp dụng cho:** Cấp phát chứng chỉ số SSL/TLS hợp lệ cho Ingress và chuẩn bị DNS Record trên Route 53.

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** Tạo và xác thực Public SSL/TLS Certificate thông qua **AWS Certificate Manager (ACM)** bằng phương thức **DNS Validation** với **Amazon Route 53**, sẵn sàng gắn vào Application Load Balancer (ALB) do AWS Load Balancer Controller quản lý.
- **Nguyên tắc SRE:**
  - **Zero Trust & End-to-End Encryption:** Toàn bộ traffic từ người dùng bên ngoài vào nền tảng phải được mã hóa HTTPS (TLS 1.2+ hoặc TLS 1.3).
  - **Automated Certificate Renewal:** Dùng DNS Validation kết hợp Route 53 để AWS tự động gia hạn chứng chỉ trước khi hết hạn, triệt tiêu rủi ro outage do chứng chỉ quá hạn.
  - **Fail-safe Domain Routing:** Thiết lập DNS records theo cấu trúc phân cấp (ví dụ `dev.sreplatform.yourdomain.com`) giúp cô lập rủi ro giữa các môi trường `dev`, `staging` và `prod`.

---

## 2. Thông số đầu vào (Input Parameters)

| Tham số | Giá trị mẫu / Quy ước | Ý nghĩa |
| :--- | :--- | :--- |
| **AWS Region** | `ap-southeast-1` | **Bắt buộc:** ACM Certificate cho ALB phải nằm cùng Region với ALB |
| **Hosted Zone Domain** | `sreplatform.yourdomain.com` (hoặc domain bạn sở hữu) | Tên miền gốc đã được quản lý trong Route 53 |
| **Primary Domain Name** | `*.dev.sreplatform.yourdomain.com` | Wildcard certificate bao quát toàn bộ microservices của dev |
| **Additional Name (SAN)** | `dev.sreplatform.yourdomain.com` | Tên miền apex của môi trường dev |
| **Validation Method** | `DNS validation - recommended` | Phương thức xác thực quyền sở hữu tên miền tự động |
| **Key Algorithm** | `RSA 2048` | Thuật toán khóa tiêu chuẩn tương thích mọi trình duyệt và ALB |

---

## 3. Các bước thực hiện chi tiết trên AWS Console (Console Steps)

### Bước 1: Kiểm tra Hosted Zone trong Amazon Route 53
*(Đảm bảo domain đã sẵn sàng nhận bản ghi xác thực)*

1. Đăng nhập **AWS Console**, nhập `Route 53` vào ô tìm kiếm -> Chọn **Route 53**.
2. Nhấp vào **Hosted zones** ở menu bên trái.
3. Xác nhận rằng domain của bạn (ví dụ `sreplatform.yourdomain.com`) có trạng thái **Public** và danh sách Name Servers (NS) đã được trỏ đúng từ Registrar (GoDaddy, Namecheap, v.v.).
4. Sao chép lại **Hosted zone ID** để sử dụng cho đối chiếu.

---

### Bước 2: Điều hướng đến AWS Certificate Manager (ACM)

1. Nhập `ACM` hoặc `Certificate Manager` vào thanh tìm kiếm -> Chọn **AWS Certificate Manager**.
2. **Cực kỳ quan trọng:** Kiểm tra Region ở góc trên bên phải. Chứng chỉ dành cho Application Load Balancer phải được tạo tại **cùng Region** với EKS Cluster và ALB (ví dụ `ap-southeast-1`).  
   *(Khác với CloudFront vốn yêu cầu chứng chỉ tại `us-east-1`)*.
3. Nhấp vào nút cam **Request a certificate**.

---

### Bước 3: Cấu hình Yêu cầu Chứng chỉ (Request Certificate)

1. Tại trang **Choose certificate type**:
   - Chọn radio button **Request a public certificate**.
   - Nhấp **Next**.
2. Tại mục **Domain names**:
   - **Fully qualified domain name (FQDN):** Nhập tên miền wildcard cho dev:
     `*.dev.sreplatform.yourdomain.com`
   - Nhấp nút **Add another name to this certificate**:
   - Nhập tên miền apex:
     `dev.sreplatform.yourdomain.com`
3. Tại mục **Validation method**:
   - Chọn **DNS validation - recommended**.
   - *Lý do chọn:* DNS validation cho phép AWS tự động gia hạn mà không cần can thiệp định kỳ.
4. Tại mục **Key algorithm**:
   - Chọn **RSA 2048**.
5. Tại mục **Tags**:
   - Nhấp **Add new tag**:
     - `Environment`: `dev`
     - `Project`: `sre-platform`
     - `ManagedBy`: `Console-to-IaC`
     - `Component`: `ingress-tls`
6. Nhấp nút **Request** ở góc dưới bên phải.
7. Màn hình sẽ chuyển về danh sách Certificates với trạng thái của chứng chỉ là **Pending validation**.

---

### Bước 4: Tạo DNS Record Xác thực trên Route 53 với 1 cú nhấp chuột

1. Trong danh sách Certificates, nhấp vào **Certificate ID** hoặc **Domain name** vừa tạo (`*.dev.sreplatform.yourdomain.com`).
2. Kéo xuống mục **Domains**:
   - Bạn sẽ thấy bảng chứa danh sách domain kèm theo **CNAME name** và **CNAME value** dùng để xác thực.
3. Nhấp vào nút **Create records in Route 53** (nằm ngay phía trên bảng bên phải).
4. Một pop-up mở ra hiển thị các bản ghi CNAME sẽ được thêm vào Route 53:
   - Tích chọn cả hai domain (`*.dev...` và `dev...`).
   - Nhấp nút cam **Create records**.
5. Console hiển thị thông báo màu xanh: `Successfully created DNS records in Route 53`.

---

### Bước 5: Theo dõi và Chờ Trạng thái Chuyển sang "Issued"

1. Quay lại trang chi tiết Certificate trong ACM.
2. Nhấn nút Refresh (biểu tượng mũi tên xoay tròn) sau mỗi 1-2 phút.
3. Quá trình kiểm tra DNS thường mất từ 2 đến 10 phút.
4. Khi quá trình hoàn tất:
   - **Status** của Certificate chuyển từ `Pending validation` sang **Issued** (Màu xanh lá cây).
   - Trạng thái xác thực của từng domain chuyển sang **Success**.
5. Sao chép lại **Certificate ARN** (có định dạng: `arn:aws:acm:ap-southeast-1:<ACCOUNT_ID>:certificate/<UUID>`). ARN này sẽ được cấu hình vào Ingress annotation hoặc Terraform sau này.

---

## 4. Xác minh (Verification)

### 4.1. Kiểm tra trên Console
- **Route 53:** Mở lại **Hosted zones** -> Domain của bạn -> Kiểm tra xem bản ghi CNAME xác thực ACM (`_xxxx.dev... CNAME _yyyy.acm-validations.aws.`) đã xuất hiện trong danh sách chưa.
- **ACM:** Đảm bảo **In-use?** hiện tại là `No` (sẽ chuyển sang `Yes` sau khi Ingress ALB được gắn ở bài 05.04).

### 4.2. Kiểm tra bằng AWS CLI

Kiểm tra trạng thái chứng chỉ:

```bash
aws acm list-certificates \
  --certificate-statuses ISSUED \
  --region ap-southeast-1 \
  --output table
```

Lấy chi tiết trạng thái validation và ngày hết hạn:

```bash
aws acm describe-certificate \
  --certificate-arn <YOUR_CERTIFICATE_ARN> \
  --region ap-southeast-1 \
  --query 'Certificate.{DomainName:DomainName,Status:Status,NotAfter:NotAfter,Type:Type,RenewalEligibility:RenewalEligibility}' \
  --output table
```

---

## 5. Chuyển giao sang IaC (Terraform Import Guide)

Theo quy trình tại **Mục 13 của README**:

### 5.1. Định nghĩa file Terraform (`iac/terraform/modules/acm/main.tf`)

```hcl
resource "aws_acm_certificate" "dev_ingress" {
  domain_name               = "*.dev.sreplatform.yourdomain.com"
  subject_alternative_names = ["dev.sreplatform.yourdomain.com"]
  validation_method         = "DNS"
  key_algorithm             = "RSA_2048"

  tags = {
    Environment = "dev"
    Project     = "sre-platform"
    Component   = "ingress-tls"
    ManagedBy   = "terraform"
  }

  lifecycle {
    create_before_destroy = true
  }
}
```

### 5.2. Thực hiện Import vào State

```bash
terraform import aws_acm_certificate.dev_ingress arn:aws:acm:ap-southeast-1:<ACCOUNT_ID>:certificate/<CERTIFICATE_UUID>
```

---

## 6. Output & Bằng chứng thực nghiệm (Evidence Template)

Lưu lại thông tin vào hồ sơ lab:

```text
=== LAB 05.02 EVIDENCE ===
Timestamp:           2026-10-21T01:25:00Z
Region:              ap-southeast-1
Domain:              *.dev.sreplatform.yourdomain.com, dev.sreplatform.yourdomain.com
Certificate ARN:     arn:aws:acm:ap-southeast-1:***REDACTED***:certificate/12345678-1234-1234-1234-123456789abc
Status:              ISSUED
Validation Method:   DNS (Route 53 CNAME automatic)
Key Algorithm:       RSA 2048
Renewal Eligibility: ELIGIBLE
```

---

## 7. Điều kiện hoàn thành Gate (Gate Check)

- [ ] Certificate đã được cấp và hiển thị trạng thái **Issued** trong ACM Console.
- [ ] Bản ghi CNAME xác thực tồn tại và định tuyến đúng trong Route 53 Hosted Zone.
- [ ] Certificate nằm ở **cùng Region** với Cluster EKS (`ap-southeast-1`).
- [ ] Đã lưu trữ Certificate ARN (đã redact Account ID) để chuẩn bị cho annotation `alb.ingress.kubernetes.io/certificate-arn`.

---

## 8. Dọn dẹp tài nguyên (Cleanup)

> [!CAUTION]
> Tuyệt đối KHÔNG xóa Certificate nếu đang được Load Balancer hoặc Ingress tham chiếu. Việc xóa certificate đang sử dụng sẽ khiến toàn bộ traffic HTTPS bị từ chối kết nối ngay lập tức.

Khi cần dọn dẹp môi trường lab:
1. Đảm bảo Ingress/ALB đã bị xóa hoàn toàn ở các bước sau.
2. Vào **AWS Certificate Manager Console** -> Chọn chứng chỉ `*.dev.sreplatform.yourdomain.com`.
3. Nhấp nút **Delete** và xác nhận.
4. Vào **Route 53 Hosted zones** -> Xóa các bản ghi CNAME xác thực không còn sử dụng.
