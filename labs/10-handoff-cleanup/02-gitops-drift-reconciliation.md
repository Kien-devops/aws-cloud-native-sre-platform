# Lab 10.02: Giám sát Trôi lệch Cấu hình (GitOps Drift Detection & Reconciliation)

> **Trạng thái:** Hướng dẫn thực hành quản trị cấu hình thực tế qua Argo CD và AWS Console.<br>
> **Áp dụng cho:** Đảm bảo toàn bộ tài nguyên trong Kubernetes đồng bộ 100% với Git repository, phát hiện và tự động hòa giải trôi lệch cấu hình (Configuration Drift) mà không sử dụng Terraform.

---

## 1. Mục tiêu & Nguyên lý SRE

- **Mục tiêu:**
  - Thiết lập Git repository là **Nguồn Chân lý Duy nhất (Single Source of Truth - SSOT)** cho toàn bộ ứng dụng và hạ tầng trong cụm EKS.
  - Cấu hình cơ chế **Self-Healing & Automated Prune** trên Argo CD để ngăn chặn việc sửa đổi thủ công bằng `kubectl`.
  - Phân tách và loại trừ các tài nguyên động (Dynamically Generated Resources) do Controller sinh ra (như TargetGroupBinding của AWS LBC, Secrets của ESO) khỏi sự kiểm soát trực tiếp của Git.
  - Kiểm toán và khắc phục triệt để mọi cảnh báo `OutOfSync` trên giao diện Argo CD.
- **Nguyên lý SRE:**
  - **Zero Manual Mutation:** Mọi thao tác chỉnh sửa trực tiếp trên cluster thông qua `kubectl edit` hoặc `kubectl apply` đều bị coi là cấu hình bất hợp pháp (Illegal Drift) và sẽ bị Argo CD tự động hoàn nguyên về trạng thái khai báo trong Git trong vòng 5-10 giây.
  - **Console Read-Only Invariant:** AWS Management Console chỉ dùng để quan sát trạng thái hạ tầng đám mây; mọi cấu hình ứng dụng được kiểm soát hoàn toàn qua GitOps.

---

## 2. Các bước Thực hiện Kiểm toán & Cấu hình Drift Detection

### Bước 1: Kích hoạt Tự động Hòa giải (Self-Healing & Prune)

Đảm bảo file `gitops/bootstrap/root-application.yaml` có đầy đủ cấu hình `syncPolicy`:

```yaml
syncPolicy:
  automated:
    prune: true     # Tự động xóa tài nguyên trên k8s nếu đã bị xóa khỏi Git
    selfHeal: true  # Tự động ghi đè hoàn nguyên nếu có ai đó sửa pod/deployment bằng kubectl
  syncOptions:
    - CreateNamespace=true
    - ApplyOutOfSyncOnly=true
    - RespectIgnoreDifferences=true
```

---

### Bước 2: Thiết lập IgnoreDifferences cho Tài nguyên Động

Để tránh cảnh báo `OutOfSync` giả đối với các tài nguyên được điều phối tự động bởi AWS Controllers hoặc Autoscalers:

```yaml
spec:
  ignoreDifferences:
    - group: "apps"
      kind: "Deployment"
      jsonPointers:
        - /spec/replicas # Nếu sử dụng KEDA hoặc HPA tự động co giãn
    - group: "argoproj.io"
      kind: "Rollout"
      jsonPointers:
        - /spec/replicas # Bỏ qua biến động replica do KEDA/Rollout autoscaler
    - group: "elbv2.k8s.aws"
      kind: "TargetGroupBinding"
      jsonPointers:
        - /status
```

---

### Bước 3: Diễn tập Phát hiện và Tự phục hồi Trôi lệch Cấu hình (Drift Drill)

1. **Cố tình gây trôi lệch cấu hình bằng `kubectl`:**
   > [!NOTE]
   > Do `order-service` được triển khai dưới dạng Argo Rollout (`Rollout/order-service`), lệnh scale chuẩn phải gọi đối tượng `rollout` hoặc `deployment` tương ứng.
   ```bash
   # Giả lập một kỹ sư sửa bậy số replicas của order-service
   kubectl scale rollout order-service -n reliability-shop --replicas=10
   ```
2. **Quan sát trên Argo CD UI:**
   - Ứng dụng lập tức chuyển trạng thái sang `OutOfSync` (màu vàng).
   - Trong vòng **5 đến 10 giây**, tính năng `selfHeal` kích hoạt -> Argo CD tự động hạ số replicas về lại số lượng khai báo trong Git (`replicas: 2`).
   - Ứng dụng tự động quay về trạng thái `Synced` và `Healthy` (màu xanh).
3. **Kiểm tra trạng thái pods trên cluster:**
   ```bash
   kubectl get pods -n reliability-shop -l app.kubernetes.io/name=order-service
   # Kết quả: Đúng 2 pods đang chạy, các pods dư thừa bị terminate tự động.
   ```

---

## 3. Điều kiện hoàn thành Gate (Gate Check)

- [x] 100% Applications trên Argo CD (`platform`, `reliability-shop`) ở trạng thái `Synced` và `Healthy`.
- [x] Tính năng `selfHeal: true` và `prune: true` được kích hoạt trên Root Application.
- [x] Bài diễn tập Drift Drill chứng minh cụm tự động loại bỏ các thay đổi thủ công ngoài Git trong vòng 10 giây.
- [x] Không có xung đột giữa KEDA/HPA autoscaler và Argo CD Sync Controller.

---

## 4. Bước kế tiếp

Chuyển sang [Lab 10.03: GitOps Ownership & Boundaries](03-gitops-ownership.md) để phân định ranh giới sở hữu giữa hạ tầng và tầng ứng dụng.
