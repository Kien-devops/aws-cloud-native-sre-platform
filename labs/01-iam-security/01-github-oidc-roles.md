# 01.01 — Thiết lập GitHub Actions OIDC Identity Provider và IAM Roles

> **Trạng thái:** Hướng dẫn thực hành chi tiết trên AWS Management Console (Console-first).  
> **Áp dụng cho:** Xác thực không dùng khóa tĩnh (Keyless Authentication) giữa GitHub Actions CI/CD và AWS IAM.

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Khởi tạo **OpenID Connect (OIDC) Identity Provider** cho GitHub Actions trên AWS IAM Console.
  - Tạo IAM Role với Trust Policy giới hạn chính xác Repository (`repo:org/aws-cloud-native-sre-platform:*`) và Branch (`main` / `dev`).
  - Phân quyền tối thiểu (Least Privilege) cho phép GitHub Actions kiểm thử Terraform (Plan) và đẩy Docker Images lên Amazon ECR mà không cần tạo hay lưu trữ AWS Access Key / Secret Access Key dài hạn.
- **Nguyên tắc SRE:**
  - **Eliminate Long-Lived Credentials:** Access Key dài hạn là một trong những nguyên nhân hàng đầu gây lộ lọt thông tin tài khoản AWS. OIDC cấp token ngắn hạn (mặc định 1 giờ), tự động hết hạn.
  - **Strict Scoping (Blast Radius):** Không dùng wildcard `repo:*` cho toàn bộ tài khoản GitHub. Chỉ định rõ ràng repository và nhánh/môi trường được phép đóng vai (AssumeRole).
  - **Automated Auditability:** Mọi yêu cầu cấp phát token từ GitHub Actions đều được ghi nhận trong CloudTrail qua sự kiện `AssumeRoleWithWebIdentity`.

---

## 2. Thông số đầu vào (Input Parameters)

| Tham số | Giá trị mẫu / Quy ước | Ý nghĩa |
| :--- | :--- | :--- |
| **Provider Type** | `OpenID Connect` | Giao thức xác thực liên kết danh tính |
| **Provider URL** | `https://token.actions.githubusercontent.com` | URL phát hành OIDC token của GitHub |
| **Audience** | `sts.amazonaws.com` | Định danh dịch vụ AWS Security Token Service |
| **GitHub Repository** | `org/aws-cloud-native-sre-platform` (hoặc repo của bạn) | Kho chứa mã nguồn GitHub CI/CD |
| **Allowed Branch** | `main` hoặc `dev` | Nhánh được phép thực hiện deploy |
| **IAM Role Name** | `github-actions-sre-platform-deployer` | Tên role cấp cho CI/CD |

---

## 3. Các bước thực hiện chi tiết trên AWS Console (Console Steps)

### Bước 1: Tạo GitHub OpenID Connect Identity Provider trên IAM

1. Đăng nhập vào **AWS Management Console**.
2. Nhập `IAM` vào ô tìm kiếm -> Chọn dịch vụ **IAM**.
3. Tại thanh điều hướng bên trái, nhấp vào **Identity providers** (trong mục *Access management*).
4. Nhấp vào nút cam **Add provider**.
5. **Configure provider:**
   - **Provider type:** Chọn radio button **OpenID Connect**.
   - **Provider URL:** Dán chính xác: `https://token.actions.githubusercontent.com`
   - Nhấp nút **Get thumbprint** (AWS sẽ tự động lấy chứng chỉ SSL thumbprint của GitHub).
   - **Audience:** Nhập chính xác: `sts.amazonaws.com`
   - **Tags:** Thêm `Project` = `sre-platform`, `ManagedBy` = `Console-to-IaC`.
6. Nhấp **Add provider**.
7. Xác nhận trong danh sách Identity providers đã có `token.actions.githubusercontent.com`.

---

### Bước 2: Tạo IAM Role với Trust Policy Giới hạn Repository

1. Vẫn tại giao diện IAM Console, nhấp vào **Roles** ở menu bên trái.
2. Nhấp vào nút cam **Create role**.
3. **Step 1 - Select trusted entity:**
   - Chọn **Web identity**.
   - **Identity provider:** Chọn `token.actions.githubusercontent.com`.
   - **Audience:** Chọn `sts.amazonaws.com`.
   - **GitHub organization / Repository:**
     - Organization: Nhập GitHub username hoặc Organization của bạn (ví dụ `my-org`).
     - Repository: Nhập tên repo (ví dụ `aws-cloud-native-sre-platform`).
   - Nhấp **Next**.
4. **Step 2 - Add permissions (Phân quyền tối thiểu cho CI/CD):**
   - Trong giai đoạn đầu, chỉ cấp quyền truy cập ECR để push image:
     - Tìm kiếm chính sách: `AmazonEC2ContainerRegistryPowerUser` -> Tích chọn.
   - Nhấp **Next**.
5. **Step 3 - Name, review, and create:**
   - **Role name:** Nhập `github-actions-sre-platform-deployer`.
   - **Description:** `Role for GitHub Actions to authenticate via OIDC and push images to ECR`.
   - Kiểm tra khung **Trust policy**:
     Bấm **Edit** để kiểm tra và tinh chỉnh Trust Policy theo đúng chuẩn bảo mật:
     ```json
     {
       "Version": "2012-10-17",
       "Statement": [
         {
           "Effect": "Allow",
           "Principal": {
             "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
           },
           "Action": "sts:AssumeRoleWithWebIdentity",
           "Condition": {
             "StringEquals": {
               "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
             },
             "StringLike": {
               "token.actions.githubusercontent.com:sub": "repo:<YOUR_GITHUB_ORG>/<YOUR_REPO>:*"
             }
           }
         }
       ]
     }
     ```
   - Nhấp **Create role**.
6. Sao chép lại **Role ARN** (dạng `arn:aws:iam::<ACCOUNT_ID>:role/github-actions-sre-platform-deployer`).

---

## 4. Xác minh và Tích hợp GitHub Actions (Verification)

### 4.1. Cấu hình Workflow Mẫu (`.github/workflows/aws-oidc-test.yml`)
Trong repository GitHub của bạn, tạo workflow kiểm tra kết nối:

```yaml
name: AWS OIDC Preflight Check

on:
  workflow_dispatch:

permissions:
  id-token: write # Bắt buộc để request token JWT từ GitHub
  contents: read

jobs:
  test-aws-connection:
    runs-on: ubuntu-latest
    steps:
      - name: Configure AWS Credentials via OIDC
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::<ACCOUNT_ID>:role/github-actions-sre-platform-deployer
          aws-region: ap-southeast-1
          audience: sts.amazonaws.com

      - name: Verify Caller Identity
        run: |
          aws sts get-caller-identity
```

### 4.2. Kiểm tra Kết quả trên CloudTrail Console
1. Sau khi chạy GitHub Actions thành công, mở **CloudTrail Console** -> **Event history**.
2. Tìm kiếm `Event name: AssumeRoleWithWebIdentity`.
3. Kiểm tra bản ghi:
   - `userIdentity.arn` hiển thị phiên làm việc GitHub Actions (có chứa Run ID và repo name).
   - `responseElements.credentials` cấp phát token phiên tạm thời thành công.

---

## 5. Chuyển giao sang IaC (Terraform Snippet)

```hcl
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1", "1c58a3a8518e8759bf075b76b750d4f8d264fcd9"]

  tags = {
    Project   = "sre-platform"
    ManagedBy = "terraform"
  }
}

resource "aws_iam_role" "github_actions" {
  name = "github-actions-sre-platform-deployer"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:my-org/aws-cloud-native-sre-platform:*"
          }
        }
      }
    ]
  })
}
```

---

## 6. Điều kiện hoàn thành Gate (Gate Check)

- [ ] OIDC Provider `token.actions.githubusercontent.com` tồn tại trên IAM Console.
- [ ] IAM Role được tạo với Trust Policy ràng buộc đúng GitHub repo, không dùng `repo:*`.
- [ ] Workflow GitHub Actions có thể assume role thành công mà không cần AWS Access Key.
- [ ] Không có Access Key tĩnh nào được tạo trong IAM Users cho mục đích CI/CD.

---

## 7. Dọn dẹp tài nguyên (Cleanup)

1. Vào **IAM Console** -> **Roles** -> Tìm `github-actions-sre-platform-deployer` -> Nhấp **Delete**.
2. Vào **IAM Console** -> **Identity providers** -> Chọn `token.actions.githubusercontent.com` -> Nhấp **Delete**.
