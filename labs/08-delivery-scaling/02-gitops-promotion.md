# 08.02 — Quy trình Thăng cấp Môi trường GitOps (Environment Promotion Workflow)

> **Trạng thái:** Hướng dẫn thực hành chi tiết luồng chuyển giao GitOps qua Pull Requests và Kustomize Overlays.  
> **Áp dụng cho:** Thăng cấp phiên bản ứng dụng có kiểm soát từ `dev` -> `staging` -> `prod` mà không làm phân mảnh mã nguồn.

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Xây dựng quy trình thăng cấp phiên bản (**Environment Promotion**) minh bạch và có thể kiểm toán 100% thông qua Git Pull Requests (PR).
  - Tách bạch chiến lược đồng bộ của Argo CD theo từng môi trường:
    - **`dev` Environment:** Tự động đồng bộ (`Automatic Sync`) và tự phục hồi (`Self-Heal`) tức thời.
    - **`staging` Environment:** Tự động đồng bộ khi merge PR vào nhánh `main`.
    - **`prod` Environment:** Yêu cầu phê duyệt thủ công (**Manual Sync Gate**) hoặc cửa sổ phát hành (Change Window) có chữ ký số.
  - Tự động cập nhật thẻ Image Tag (`newTag: git-<sha>`) trong file `kustomization.yaml` của từng môi trường thông qua GitHub Actions CI.
- **Nguyên tắc SRE:**
  - **No Manual Git Edits in Production:** Tuyệt đối không chỉnh sửa trực tiếp trên nhánh `main` hoặc commit chay vào thư mục `prod/`. Mọi thay đổi bắt buộc phải đi qua quy trình Review PR và Automated Checks.
  - **Identical Artifact Across Environments:** Image chạy ở `prod` phải là chính xác image có SHA digest đã được kiểm thử và nghiệm thu thành công ở `dev` và `staging` (Build Once, Deploy Many).
  - **Change Failure Rate (CFR) Tracking:** Mọi lần thăng cấp môi trường đều được ghi nhận dấu thời gian để tính toán chỉ số DORA: Change Failure Rate và Lead Time for Changes.

---

## 2. Mô hình Luồng Thăng cấp GitOps (Promotion Flow)

```text
       [ CI Pipeline Build Success ]
                     |
         Sinh Image: git-a1b2c3d
                     |
                     v
   +------------------------------------+
   | 1. Auto-commit to dev overlay      |
   |    (Argo CD tự động đồng bộ dev)   |
   +-----------------+------------------+
                     |
            Kiểm thử dev Đạt
                     |
                     v
   +------------------------------------+
   | 2. Tạo Pull Request sang staging   |
   |    - Chạy Kustomize Validation     |
   |    - Review và Merge PR            |
   +-----------------+------------------+
                     |
           Kiểm thử staging Đạt
                     |
                     v
   +------------------------------------+
   | 3. Tạo Pull Request sang prod      |
   |    - Phê duyệt của Release Manager |
   |    - Manual Sync Gate trên Argo CD |
   +------------------------------------+
```

---

## 3. Các bước Khai báo Chi tiết (Step-by-Step Walkthrough)

### Bước 1: Khai báo Kustomize Overlay cho Staging và Prod

Tạo file `gitops/applications/reliability-shop/envs/staging/kustomization.yaml`:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - ../../base
  - ingress.yaml
  - configmap-env.yaml

namespace: reliability-shop-staging

commonLabels:
  environment: staging

# GHI ĐÈ PHIÊN BẢN IMAGE ĐÃ ĐƯỢC PHÊ DUYỆT TỪ DEV
images:
  - name: <ACCOUNT_ID>.dkr.ecr.ap-southeast-1.amazonaws.com/reliabilityshop/order-service
    newTag: git-v1.0.0
```

Tạo file `gitops/applications/reliability-shop/envs/prod/kustomization.yaml`:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - ../../base
  - ingress.yaml
  - configmap-env.yaml

namespace: reliability-shop-prod

commonLabels:
  environment: prod

images:
  - name: <ACCOUNT_ID>.dkr.ecr.ap-southeast-1.amazonaws.com/reliabilityshop/order-service
    newTag: git-v1.0.0 # Chỉ cập nhật khi đã qua staging
```

---

### Bước 2: Khởi tạo Application Prod với Manual Sync Policy

Tạo file `gitops/applications/reliability-shop/application-prod.yaml`:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: reliability-shop-prod
  namespace: argocd
spec:
  project: reliability-shop
  source:
    repoURL: 'https://github.com/my-org/aws-cloud-native-sre-platform.git'
    targetRevision: main
    path: gitops/applications/reliability-shop/envs/prod
  destination:
    server: 'https://kubernetes.default.svc'
    namespace: reliability-shop-prod
  # CHÍNH SÁCH BẢO VỆ PRODUCTION: KHÔNG BẬT AUTOMATED SYNC
  syncPolicy:
    syncOptions:
      - CreateNamespace=true
```

---

### Bước 3: Script Tự động Cập nhật Tag qua CLI (GitOps Promotion Bot)

Sử dụng lệnh `kustomize edit set image` để tự động hóa việc thăng cấp trong CI/CD:

```bash
# Di chuyển vào thư mục staging
cd gitops/applications/reliability-shop/envs/staging

# Cập nhật image tag mới đã test đạt tại dev
kustomize edit set image <ACCOUNT_ID>.dkr.ecr.ap-southeast-1.amazonaws.com/reliabilityshop/order-service:git-v1.1.0

# Tạo commit và gửi Pull Request
git checkout -b promote-order-service-to-staging
git commit -am "chore(gitops): promote order-service to git-v1.1.0 in staging"
git push origin promote-order-service-to-staging
```

---

## 4. Xác minh (Verification)

1. Mở **Argo CD Web UI**:
   - Ứng dụng `reliability-shop-prod` hiển thị trạng thái `OutOfSync` (Màu vàng) khi có commit mới trên Git.
   - Nhấp nút **DIFF** để so sánh trực quan từng dòng code thay đổi giữa cluster thực tế và Git.
2. **Kích hoạt Manual Sync có kiểm soát:**
   - Người phụ trách phiên phát hành (Release Manager) nhấp nút **SYNC**.
   - Chọn đồng bộ tuần tự, quan sát trạng thái pods chuyển đổi an toàn sang phiên bản mới.
   - Ứng dụng chuyển sang trạng thái `Synced` và `Healthy`.

---

## 5. Điều kiện hoàn thành Gate (Gate Check)

- [ ] Quy trình Kustomize Overlays tách biệt rõ ràng 3 môi trường `dev`, `staging`, `prod`.
- [ ] Ứng dụng `prod` được cấu hình bắt buộc Manual Sync Gate, ngăn chặn việc tự động deploy ngoài giờ kiểm soát.
- [ ] Mọi thay đổi phiên bản image đều để lại commit log minh bạch trong Git.

---

## 6. Dọn dẹp tài nguyên (Cleanup)

- Duy trì cấu hình phân tầng môi trường để phục vụ bài kiểm thử Canary Release ở bài 08.05.
