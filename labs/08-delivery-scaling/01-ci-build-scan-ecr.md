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

Tạo file workflow trong repository ứng dụng `app3` (`.github/workflows/build-push.yml`):

```yaml
name: Build, Security Scan and Push to ECR

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  id-token: write # Bắt buộc để xác thực AWS OIDC
  contents: read

env:
  AWS_REGION: ap-southeast-1
  AWS_ROLE_ARN: arn:aws:iam::123456789012:role/github-actions-sre-platform-deployer

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Install and Run Tests
        run: |
          npm ci
          npm test

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Scan Repository with Trivy
        uses: aquasecurity/trivy-action@ed142fd0673e97e23eac54620cfb913e5ce36c25 # v0.36.0 (Trivy v0.70.0)
        with:
          scan-type: 'fs'
          scan-ref: '.'
          severity: 'CRITICAL,HIGH'
          exit-code: '0'

  build-scan-push:
    needs: [test, security]
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        service:
          - name: auth-service
            dockerfile: docker/Dockerfile.auth
            repo: reliabilityshop/auth-service
          - name: order-service
            dockerfile: docker/Dockerfile.order
            repo: reliabilityshop/order-service
          - name: payment-worker
            dockerfile: docker/Dockerfile.payment
            repo: reliabilityshop/payment-worker
          - name: inventory-service
            dockerfile: docker/Dockerfile.inventory
            repo: reliabilityshop/inventory-service
          - name: frontend
            dockerfile: docker/Dockerfile.frontend
            repo: reliabilityshop/frontend
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS Credentials via OIDC
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ env.AWS_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}
          audience: sts.amazonaws.com

      - name: Log in to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build Local Container Image
        env:
          REGISTRY: ${{ steps.login-ecr.outputs.registry }}
        run: |
          IMAGE_TAG="git-${GITHUB_SHA::7}"
          docker build \
            -t ${{ env.REGISTRY }}/${{ matrix.service.repo }}:$IMAGE_TAG \
            -t ${{ env.REGISTRY }}/${{ matrix.service.repo }}:latest \
            -f ${{ matrix.service.dockerfile }} .

      - name: Scan Built Image with Trivy
        uses: aquasecurity/trivy-action@ed142fd0673e97e23eac54620cfb913e5ce36c25 # v0.36.0
        with:
          image-ref: ${{ steps.login-ecr.outputs.registry }}/${{ matrix.service.repo }}:latest
          format: 'table'
          severity: 'CRITICAL,HIGH'
          ignore-unfixed: true
          exit-code: '1' # CHẶN PIPELINE NẾU CÓ LỖ HỔNG CRITICAL/HIGH TRÊN ỨNG DỤNG

      - name: Push Image and Capture Immutable Digest
        if: github.ref == 'refs/heads/main'
        env:
          REGISTRY: ${{ steps.login-ecr.outputs.registry }}
        run: |
          IMAGE_TAG="git-${GITHUB_SHA::7}"
          docker push ${{ env.REGISTRY }}/${{ matrix.service.repo }}:$IMAGE_TAG
          docker push ${{ env.REGISTRY }}/${{ matrix.service.repo }}:latest

          DIGEST=$(docker inspect --format='{{index .RepoDigests 0}}' ${{ env.REGISTRY }}/${{ matrix.service.repo }}:$IMAGE_TAG | cut -d'@' -f2)
          echo "Pushed Image Digest: $DIGEST"
```

> **Bảo mật Container Base Image (Production SRE Pattern):**<br>
> Trong các Dockerfile gốc `node:22-alpine`, CLI của `npm` thường chứa các thư viện con có CVEs cũ (`picomatch`, `sigstore`). Giải pháp chuẩn SRE là chạy `npm ci --omit=dev` sau đó dọn dẹp sạch sẽ build tools trong cùng layer:
> ```dockerfile
> RUN npm ci --omit=dev --silent && \
>     rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /root/.npm
> ```
> Thao tác này giúp container image nhẹ hơn ~40MB và đạt **0 CRITICAL, 0 HIGH CVEs** khi Trivy quét.

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
