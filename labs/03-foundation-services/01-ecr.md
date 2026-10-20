# 03.01 — Khởi tạo Amazon Elastic Container Registry (ECR) và Chính sách Bất biến

> **Trạng thái:** Hướng dẫn thực hành chi tiết trên AWS Management Console (Console-first).  
> **Áp dụng cho:** Quản lý kho chứa Docker Container Images cho microservices ReliabilityShop (`order-service`, `inventory-service`, `payment-worker`).

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Khởi tạo các kho lưu trữ riêng tư (**Private ECR Repositories**) cho từng microservice trong hệ sinh thái ReliabilityShop.
  - Kích hoạt cơ chế **Tag Immutability** (Tính bất biến của image tag) để ngăn chặn việc ghi đè (overwrite) các image tags đã phát hành.
  - Bật tính năng **Enhanced Scanning / Basic Scanning (Scan on push)** để tự động quét lỗ hổng bảo mật (CVEs) trong image ngay khi vừa được đẩy lên kho.
  - Thiết lập **Lifecycle Policy** (Chính sách vòng đời) nhằm tự động dọn dẹp các untagged images và chỉ giữ lại 30 images gần nhất, giúp kiểm soát chi phí lưu trữ S3 của ECR.
- **Nguyên tắc SRE:**
  - **Immutable Artifacts for Reliable Rollbacks:** Tuyệt đối cấm sử dụng tag `:latest` trong môi trường production/dev. Mỗi image phải gắn với Git Commit SHA ngắn gọn (ví dụ `:git-a1b2c3d`). Tính bất biến đảm bảo phiên bản được kiểm thử ở CI là phiên bản chính xác chạy trên EKS và có thể rollback an toàn bất kỳ lúc nào.
  - **Supply Chain Security:** Phát hiện sớm các CVEs nghiêm trọng (Critical/High) trước khi image được triển khai vào Kubernetes cluster.
  - **FinOps Image Pruning:** Không lưu trữ vô thời hạn các image thử nghiệm; tự động dọn sạch các build rác.

---

## 2. Danh sách Repositories Cần Khởi tạo

| Repository Name | Phục vụ Microservice | Tag Immutability | Quét Lỗ hổng |
| :--- | :--- | :--- | :--- |
| `reliabilityshop/order-service` | Order API & Business Logic | **Enabled** | Scan on push |
| `reliabilityshop/inventory-service` | Quản lý kho hàng & hàng tồn | **Enabled** | Scan on push |
| `reliabilityshop/payment-worker` | SQS Message Consumer | **Enabled** | Scan on push |

---

## 3. Các bước thực hiện chi tiết trên AWS Console (Console Steps)

### Bước 1: Khởi tạo ECR Repository `reliabilityshop/order-service`

1. Đăng nhập **AWS Console**, chọn Region `ap-southeast-1`.
2. Nhập `ECR` vào ô tìm kiếm -> Chọn dịch vụ **Elastic Container Registry**.
3. Tại menu bên trái, nhấp vào **Repositories** (mục *Amazon ECR*).
4. Nhấp vào nút cam **Create repository**.
5. **General settings:**
   - **Visibility settings:** Chọn radio button **Private** (Mặc định).
   - **Repository name:** Nhập `reliabilityshop/order-service`.
   - **Tag immutability:**
     - Gạt công tắc sang **Enable** (Bật).
     > [!IMPORTANT]
     > Khi bật Tag Immutability, nếu bạn cố tình push một image có tag trùng với tag đã tồn tại, AWS ECR sẽ từ chối với lỗi `ImageTagAlreadyExistsException`. Điều này bảo vệ hệ thống khỏi việc vô tình ghi đè bản release ổn định.
6. **Image scan settings:**
   - **Scan on push:** Gạt công tắc sang **Enable** (Bật).
7. **KMS encryption:**
   - Chọn **KMS** nếu muốn mã hóa bằng khóa riêng `alias/sre-platform-dev-main` hoặc chọn **AES-256** (mặc định) để tiết kiệm chi phí.
8. **Tags:**
   - `Environment`: `dev`
   - `Project`: `sre-platform`
   - `Component`: `order-service`
   - `ManagedBy`: `Console-to-IaC`
9. Nhấp nút **Create repository**.

---

### Bước 2: Thiết lập Lifecycle Policy Tự động Dọn dẹp

1. Trong danh sách Repositories, nhấp vào tên repository `reliabilityshop/order-service`.
2. Tại menu bên trái (trong ngữ cảnh repo), nhấp vào **Lifecycle Policy**.
3. Nhấp nút cam **Create rule**.
4. **Rule details:**
   - **Rule priority:** Nhập `1`.
   - **Description:** `Xóa untagged images sau 7 ngày`.
   - **Image status:** Chọn `Untagged`.
   - **Match criteria:** Chọn `Since image pushed`, nhập `7` ngày.
   - **Action:** Chọn `Expire`.
5. Nhấp **Save**.
6. Nhấp tiếp **Create rule** để tạo Rule số 2:
   - **Rule priority:** Nhập `2`.
   - **Description:** `Chỉ giữ lại 30 images có tag gần nhất`.
   - **Image status:** Chọn `Any`.
   - **Match criteria:** Chọn `Image count more than`, nhập `30`.
   - **Action:** Chọn `Expire`.
7. Nhấp **Save**.

---

### Bước 3: Lặp lại cho `inventory-service` và `payment-worker`

1. Quay lại trang **Repositories** -> Nhấp **Create repository**.
2. Tạo lần lượt hai repositories còn lại:
   - `reliabilityshop/inventory-service` (Bật Tag Immutability + Scan on push + Gắn Lifecycle policy).
   - `reliabilityshop/payment-worker` (Bật Tag Immutability + Scan on push + Gắn Lifecycle policy).

---

## 4. Xác minh và Kiểm thử Đẩy Image (Verification)

### 4.1. Xem Hướng dẫn Push Lệnh từ Console (View Push Commands)
1. Trong danh sách ECR Repositories, tích chọn `reliabilityshop/order-service`.
2. Nhấp nút **View push commands** ở góc trên bên phải.
3. AWS Console sẽ hiển thị 4 bước lệnh chính xác cho hệ điều hành của bạn (macOS/Linux/Windows).

### 4.2. Kiểm thử Thực tế từ Terminal Máy trạm
```bash
# 1. Đăng nhập Docker client vào AWS ECR Registry
aws ecr get-login-password --region ap-southeast-1 | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.ap-southeast-1.amazonaws.com

# 2. Tạo một test image siêu nhẹ
docker pull alpine:latest
docker tag alpine:latest <ACCOUNT_ID>.dkr.ecr.ap-southeast-1.amazonaws.com/reliabilityshop/order-service:git-v1.0.0

# 3. Đẩy image lên ECR
docker push <ACCOUNT_ID>.dkr.ecr.ap-southeast-1.amazonaws.com/reliabilityshop/order-service:git-v1.0.0

# 4. Kiểm thử Tag Immutability: Thử push đè lên cùng tag git-v1.0.0 (Mong đợi: BỊ TỪ CHỐI)
docker tag alpine:latest <ACCOUNT_ID>.dkr.ecr.ap-southeast-1.amazonaws.com/reliabilityshop/order-service:git-v1.0.0
docker push <ACCOUNT_ID>.dkr.ecr.ap-southeast-1.amazonaws.com/reliabilityshop/order-service:git-v1.0.0
```

**Kết quả mong đợi:** Lệnh push lần 2 phải trả về lỗi:  
`tag invalid: The image tag 'git-v1.0.0' already exists in the repository.`

---

## 5. Chuyển giao sang IaC (Terraform Snippet)

```hcl
resource "aws_ecr_repository" "services" {
  for_each = toset(["order-service", "inventory-service", "payment-worker"])

  name                 = "reliabilityshop/${each.key}"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Environment = "dev"
    Project     = "sre-platform"
  }
}

resource "aws_ecr_lifecycle_policy" "cleanup" {
  for_each   = aws_ecr_repository.services
  repository = each.value.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged images older than 7 days"
        selection    = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 7
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Keep last 30 tagged images"
        selection    = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 30
        }
        action = { type = "expire" }
      }
    ]
  })
}
```

---

## 6. Điều kiện hoàn thành Gate (Gate Check)

- [ ] 3 repositories (`order-service`, `inventory-service`, `payment-worker`) đã được tạo.
- [ ] Tính năng `Tag Immutability` và `Scan on push` được bật trên cả 3 repos.
- [ ] Thử nghiệm push đè cùng tag bị từ chối bởi cơ chế Immutability.
- [ ] Lifecycle policy giới hạn tối đa 30 images được cấu hình đầy đủ.

---

## 7. Dọn dẹp tài nguyên (Cleanup)

1. Vào **ECR Console** -> Chọn từng repository.
2. Nếu bên trong có images: Chọn tab **Images** -> Chọn tất cả -> Nhấp **Delete**.
3. Quay lại trang danh sách Repositories -> Chọn các repo -> Nhấp **Delete repository** -> Gõ `delete` để xác nhận.
