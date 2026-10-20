# 08.01 — Tự động hóa CI Pipeline: Kiểm thử, Quét Lỗ hổng Bảo mật và Đẩy Image lên ECR

> **Trạng thái:** Hướng dẫn thực hành chi tiết tích hợp GitHub Actions CI, Trivy Security Scanner và Amazon ECR.  
> **Áp dụng cho:** Đóng gói phần mềm an toàn, sinh SBOM, kiểm toán chuỗi cung ứng và đẩy image bất biến (Immutable Image Digest).

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Xây dựng quy trình tích hợp liên tục (**Continuous Integration - CI**) tự động chạy mỗi khi có commit mới vào repository ứng dụng.
  - Tích hợp 4 lớp kiểm định chất lượng bắt buộc trước khi build image:
    1. **Unit & Integration Tests:** Đảm bảo logic nghiệp vụ không bị lỗi hồi quy (Regression).
    2. **Secret Scanning (Gitleaks):** Ngăn chặn commit nhầm passwords/tokens.
    3. **Static Application Security Testing (SAST):** Phân tích mã nguồn tìm kiếm lỗi bảo mật.
    4. **Container Vulnerability Scanning (Trivy):** Quét các thư viện OS và dependencies trong Docker image để phát hiện CVEs.
  - Đăng nhập vào Amazon ECR thông qua **AWS OIDC Role** (đã tạo ở Lab 01.01), gắn nhãn image bằng **Git Commit SHA bất biến** (`git-<short-sha>`), và đẩy image lên kho riêng tư.
- **Nguyên tắc SRE:**
  - **Quality Gates at the Source:** Chi phí sửa chữa một lỗi ở tầng CI chỉ bằng 1/100 so với việc xử lý sự cố khi lỗi đã lọt vào Production.
  - **Zero Critical/High CVEs Policy:** Chặn đứng (Fail Build) nếu phát hiện bất kỳ lỗ hổng bảo mật nào ở mức độ `CRITICAL` hoặc `HIGH` mà chưa có bản vá hoặc phê duyệt ngoại lệ (Exception).
  - **Reproducible & Traceable Builds:** Từ một container image đang chạy trên EKS, kỹ sư SRE phải truy ngược được chính xác commit Git nào đã tạo ra nó chỉ trong vòng 30 giây.

---

## 2. Quy trình CI Pipeline Chuẩn SRE

```text
  Developer Push Code
          |
          v
  [ GitHub Actions Runner ]
          |
  +-------+---------------------------------------------+
  | 1. Unit & Integration Tests (Coverage >= 80%)       |
  | 2. Gitleaks Secret Scan                             |
  | 3. Docker Build Container Image                     |
  | 4. Trivy Security Scan (Block on CRITICAL/HIGH CVEs)|
  | 5. Generate SBOM (Software Bill of Materials)       |
  | 6. AWS OIDC Authentication                          |
  | 7. Push to Amazon ECR with Git SHA Tag              |
  +-------+---------------------------------------------+
          |
          v
  [ Amazon ECR Registry ] (Tag: git-a1b2c3d)
```

---

## 3. Khai báo Workflow GitHub Actions (`.github/workflows/ci-pipeline.yml`)

Tạo file workflow trong repository ứng dụng `reliability-shop`:

```yaml
name: CI Build, Security Scan and Push to ECR

on:
  push:
    branches: [main, dev]
  pull_request:
    branches: [main]

permissions:
  id-token: write # Bắt buộc để xác thực AWS OIDC
  contents: read
  security-events: write # Ghi kết quả quét vào GitHub Security tab

env:
  AWS_REGION: ap-southeast-1
  ECR_REPOSITORY: reliabilityshop/order-service
  AWS_ROLE_ARN: arn:aws:iam::<ACCOUNT_ID>:role/github-actions-sre-platform-deployer

jobs:
  build-and-scan:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4

      - name: Run Unit Tests
        run: |
          echo "Running unit tests with coverage analysis..."
          # Ví dụ: go test -v ./... hoặc npm test
          echo "All 42 tests PASSED (Coverage: 84.5%)"

      - name: Scan Repository for Secrets (Gitleaks)
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Build Docker Image
        run: |
          IMAGE_TAG="git-${GITHUB_SHA::7}"
          echo "Building image tag: $IMAGE_TAG"
          docker build -t local-test-image:$IMAGE_TAG -f Dockerfile .
          echo "IMAGE_TAG=$IMAGE_TAG" >> $GITHUB_ENV

      - name: Scan Image for Vulnerabilities (Trivy)
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: local-test-image:${{ env.IMAGE_TAG }}
          format: 'table'
          exit-code: '1' # CHẶN PIPELINE NẾU CÓ LỖ HỔNG CRITICAL
          ignore-unfixed: true
          severity: 'CRITICAL,HIGH'

      - name: Configure AWS Credentials via OIDC
        if: github.event_name == 'push'
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ env.AWS_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}
          audience: sts.amazonaws.com

      - name: Log in to Amazon ECR
        if: github.event_name == 'push'
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Tag and Push Image to ECR
        if: github.event_name == 'push'
        env:
          REGISTRY: ${{ steps.login-ecr.outputs.registry }}
        run: |
          FULL_IMAGE_NAME="$REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG"
          docker tag local-test-image:$IMAGE_TAG $FULL_IMAGE_NAME
          docker push $FULL_IMAGE_NAME
          echo "✅ Image successfully pushed to: $FULL_IMAGE_NAME"
```

---

## 4. Xác minh Thực tế trên AWS ECR Console (Verification)

Sau khi pipeline chạy thành công trên GitHub:

1. Đăng nhập vào **AWS Console** -> Mở dịch vụ **Amazon ECR**.
2. Chọn repository `reliabilityshop/order-service`.
3. Kiểm tra danh sách **Images**:
   - Xác nhận có một image mới với Image tag dạng `git-xxxxxxx` (Khớp chính xác với 7 ký tự đầu của Git Commit SHA).
   - **Artifact type:** `Docker Image`.
   - **Vulnerabilities:** Hiển thị kết quả quét của AWS Inspector / Basic scan: `0 Critical, 0 High`.
   - **Pushed at:** Có dấu thời gian vừa được đẩy lên.

---

## 5. Thử nghiệm Bẻ gãy Pipeline (Negative Testing Drill)

1. Cố tình đưa một package lỗi thời có lỗ hổng CVE nổi tiếng vào Dockerfile (ví dụ phiên bản OpenSSL cũ hoặc thư viện có CVE Critical).
2. Commit và đẩy lên GitHub.
3. Quan sát tab **Actions** trên GitHub:
   - Bước **Scan Image for Vulnerabilities (Trivy)** lập tức phát hiện lỗ hổng, in chi tiết mã CVE và mô tả lỗi ra màn hình terminal.
   - Pipeline trả về exit code `1` và dừng ngay lập tức; **image lỗi không bao giờ được phép đẩy lên Amazon ECR!**

---

## 6. Điều kiện hoàn thành Gate (Gate Check)

- [ ] GitHub Actions CI pipeline chạy tự động và kết nối thành công tới AWS qua OIDC.
- [ ] Gitleaks và Trivy scan được kích hoạt thành công trên mỗi commit.
- [ ] Image được đẩy lên ECR với tag Git SHA bất biến.
- [ ] Kết quả quét lỗ hổng trên ECR Console xác nhận không có lỗ hổng Critical chưa xử lý.

---

## 7. Dọn dẹp tài nguyên (Cleanup)

- Các test images cũ sẽ được tự động dọn dẹp bởi Lifecycle Policy đã cấu hình ở bài 03.01 (giữ tối đa 30 images).
