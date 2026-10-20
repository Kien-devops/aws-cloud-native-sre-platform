# 06.03 — Triển khai Platform Add-ons qua Mô hình GitOps App-of-Apps

> **Trạng thái:** Hướng dẫn thực hành chi tiết trên Argo CD Web UI kết hợp khai báo Helm/GitOps.  
> **Áp dụng cho:** Tự động hóa cài đặt AWS Load Balancer Controller và External Secrets Operator thông qua mẫu thiết kế App-of-Apps.

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Ứng dụng mẫu thiết kế chuẩn mực **App-of-Apps Pattern**: Tạo một "Ứng dụng mẹ" (Root Application) trong Argo CD để tự động quản lý và đồng bộ toàn bộ các "Ứng dụng con" (Platform Add-ons).
  - Triển khai tự động hai thành phần hạ tầng tối quan trọng đã chuẩn bị ở Module 05:
    1. **AWS Load Balancer Controller (LBC):** Tự động cấp phát ALB khi có Ingress.
    2. **External Secrets Operator (ESO):** Tự động đồng bộ credentials từ Secrets Manager.
  - Bật cơ chế tự phục hồi (**Self-Healing**) và tự dọn dẹp (**Pruning**) để ngăn chặn sự sai lệch cấu hình (Configuration Drift).
- **Nguyên tắc SRE:**
  - **No Imperative Helm CLI:** Không chạy lệnh `helm install` thủ công từ máy trạm cá nhân. Mọi Helm charts và Values parameters phải được phiên bản hóa và theo dõi qua Git.
  - **Automated Anti-Drift (Chống lệch trạng thái):** Nếu ai đó vô tình xóa hoặc sửa một deployment trong cluster, Argo CD sẽ phát hiện trạng thái `OutOfSync` và tự động áp dụng lại cấu hình chuẩn từ Git trong vòng vài giây.
  - **Dependency Orchestration:** Đảm bảo CRDs và Pod Identity roles đã sẵn sàng trước khi controller pods khởi chạy.

---

## 2. Cấu trúc Mô hình App-of-Apps

```text
       [ Argo CD Root Application: "platform-root" ]
                            |
                 Quan sát: gitops/platform/
                            |
         +------------------+------------------+
         |                                     |
         v                                     v
  [ Application: aws-lbc ]             [ Application: external-secrets ]
  - Helm: eks-charts/aws-lbc           - Helm: external-secrets/eso
  - Namespace: kube-system             - Namespace: external-secrets
  - Pod Identity: sre-platform-lbc     - Pod Identity: sre-platform-eso
```

---

## 3. Các bước thực hiện chi tiết (Console & GitOps Steps)

### Bước 1: Khai báo Manifests cho các Add-ons trong Git

Tạo file `gitops/platform/aws-load-balancer-controller.yaml`:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: aws-load-balancer-controller
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: platform
  source:
    repoURL: 'https://aws.github.io/eks-charts'
    chart: aws-load-balancer-controller
    targetRevision: 1.8.1
    helm:
      valuesObject:
        clusterName: sre-platform-dev
        serviceAccount:
          create: true
          name: aws-load-balancer-controller
        region: ap-southeast-1
        vpcId: vpc-xxxxxxxxxxxxxxxxx # Thay bằng VPC ID thực tế
  destination:
    server: 'https://kubernetes.default.svc'
    namespace: kube-system
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

Tạo file `gitops/platform/external-secrets-operator.yaml`:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: external-secrets-operator
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: platform
  source:
    repoURL: 'https://charts.external-secrets.io'
    chart: external-secrets
    targetRevision: 0.9.18
    helm:
      valuesObject:
        installCRDs: true
        serviceAccount:
          create: true
          name: external-secrets-sa
  destination:
    server: 'https://kubernetes.default.svc'
    namespace: external-secrets
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

Tạo file Root Application `gitops/bootstrap/platform-root-app.yaml`:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: platform-root
  namespace: argocd
spec:
  project: platform
  source:
    repoURL: 'https://github.com/my-org/aws-cloud-native-sre-platform.git'
    targetRevision: main
    path: gitops/platform
  destination:
    server: 'https://kubernetes.default.svc'
    namespace: argocd
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

---

### Bước 2: Kích hoạt Root Application từ Argo CD Web UI

1. Mở trình duyệt truy cập `https://localhost:8080` -> Đăng nhập tài khoản `admin`.
2. Tại màn hình **Applications**, nhấp vào nút **+ NEW APP** ở góc trên bên trái:
   - **Application Name:** `platform-root`.
   - **Project Name:** `platform`.
   - **Sync Policy:** Chọn **Automatic** -> Tích chọn cả **Prune Resources** và **Self-Heal**.
   - **Source:**
     - **Repository URL:** Nhập URL Git repo của bạn.
     - **Revision:** `main` (hoặc `HEAD`).
     - **Path:** Nhập `gitops/platform`.
   - **Destination:**
     - **Cluster URL:** `https://kubernetes.default.svc`.
     - **Namespace:** `argocd`.
3. Nhấp nút cam **CREATE** ở trên cùng.

---

### Bước 3: Quan sát Tiến trình Đồng bộ Tự động (Sync & Health)

1. Ngay khi Root App được tạo, Argo CD sẽ quét thư mục `gitops/platform` và tự động sinh ra 2 ứng dụng con:
   - `aws-load-balancer-controller`
   - `external-secrets-operator`
2. Nhấp vào từng ứng dụng để xem sơ đồ cây tài nguyên (Resource Tree):
   - Quan sát các CustomResourceDefinitions (CRDs), ServiceAccounts, Deployments, và Pods đang được khởi tạo.
3. Chờ từ 1 đến 2 phút cho đến khi tất cả các ứng dụng chuyển sang biểu tượng hình trái tim màu xanh lá cây: **Healthy** và biểu tượng mũi tên xoay tròn màu xanh: **Synced**.

---

## 4. Xác minh Thực tế từ Terminal (Verification)

```bash
# 1. Kiểm tra trạng thái ứng dụng qua Argo CD CRDs
kubectl get applications -n argocd

# 2. Kiểm tra controller của AWS Load Balancer Controller trong kube-system
kubectl get deployment aws-load-balancer-controller -n kube-system

# 3. Kiểm tra controller của External Secrets Operator trong external-secrets
kubectl get deployment -n external-secrets
```

**Kết quả mong đợi:**
- Lệnh 1: Cả 3 applications (`platform-root`, `aws-load-balancer-controller`, `external-secrets-operator`) hiển thị `SYNC STATUS: Synced`, `HEALTH STATUS: Healthy`.
- Lệnh 2 & 3: Các Deployments đều có số Pod Ready đạt 100% (ví dụ: `2/2` hoặc `1/1`).

---

## 5. Thử nghiệm Cơ chế Tự phục hồi (Self-Healing Chaos Test)

Thử nghiệm xóa thủ công một deployment hạ tầng để kiểm tra phản ứng của GitOps:

```bash
# Cố tình xóa deployment của External Secrets Operator bằng kubectl
kubectl delete deployment external-secrets -n external-secrets
```

1. Mở lại Argo CD Web UI:
   - Ngay lập tức trạng thái của ứng dụng chuyển sang `OutOfSync`.
   - Trong vòng 5-15 giây, Argo CD Application Controller tự động phát hiện sai lệch và **tự động recreate lại Deployment** từ Git!
2. Chạy lại `kubectl get deployment -n external-secrets`: Deployment đã được khôi phục nguyên vẹn.

---

## 6. Điều kiện hoàn thành Gate (Gate Check)

- [ ] Cả 3 Applications đều đạt trạng thái `Synced` và `Healthy`.
- [ ] AWS Load Balancer Controller đang chạy và kết nối được với AWS API.
- [ ] External Secrets Operator đang chạy và nhận diện được CRDs.
- [ ] Thử nghiệm Self-Healing thành công, chứng minh khả năng chống lệch trạng thái.

---

## 7. Dọn dẹp tài nguyên (Cleanup)

- Không xóa các platform add-ons nếu chuẩn bị triển khai ứng dụng microservices ở các bài sau.
- Khi cần dọn dẹp, xóa Root Application: `kubectl delete application platform-root -n argocd` (Argo CD sẽ tự động prune toàn bộ ứng dụng con nhờ finalizer).
