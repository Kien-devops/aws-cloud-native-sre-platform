# 06.02 — Thiết lập Phân quyền Dự án Argo CD Projects (AppProject) và Môi trường

> **Trạng thái:** Hướng dẫn thực hành chi tiết trên Argo CD Web UI kết hợp khai báo Declarative CRDs.  
> **Áp dụng cho:** Phân chia ranh giới bảo mật (Multi-Tenancy Boundaries) giữa nền tảng hạ tầng (Platform Add-ons) và ứng dụng nghiệp vụ (ReliabilityShop).

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Khởi tạo 2 thực thể **Argo CD AppProject** để phân tách quyền lực:
    1. **`platform` Project:** Dành cho các thành phần hạ tầng (AWS Load Balancer Controller, External Secrets Operator, Karpenter, Monitoring Stack). Cho phép quản lý tài nguyên cấp cluster (Cluster-Scoped Resources: CRDs, ClusterRoles, Webhooks).
    2. **`reliability-shop` Project:** Dành riêng cho microservices ứng dụng. **Cấm triệt để** việc tạo tài nguyên cấp cluster; chỉ được phép triển khai tài nguyên cấp namespace (`Deployment`, `Service`, `Ingress`, `Rollout`, `ConfigMap`) bên trong namespace `reliability-shop`.
  - Cấu hình danh sách Git Repositories và Cluster Destinations được phép đồng bộ (Whitelisting).
- **Nguyên tắc SRE:**
  - **Blast Radius Containment (Cô lập vùng ảnh hưởng):** Một lỗ hổng hoặc cấu hình sai trong manifest của lập trình viên ứng dụng không bao giờ được phép làm ảnh hưởng hoặc chiếm quyền điều khiển của toàn bộ Kubernetes Cluster.
  - **Least Privilege Tenancy:** Áp dụng nguyên tắc đặc quyền tối thiểu trong GitOps: Ứng dụng chỉ được phép deploy vào đúng namespace được cấp phép.
  - **Auditability & Traceability:** Xác định rõ ràng ai sở hữu ứng dụng nào và nguồn Git nào có quyền đưa mã nguồn vào hệ thống.

---

## 2. Ma trận Phân quyền AppProject (Security Matrix)

| Tiêu chí | `platform` AppProject | `reliability-shop` AppProject |
| :--- | :--- | :--- |
| **Mục đích** | Quản lý Cluster Add-ons & Observability | Quản lý Microservices ứng dụng |
| **Allowed Namespaces** | `kube-system`, `monitoring`, `external-secrets` | `reliability-shop` (Duy nhất) |
| **Cluster-Scoped Resources**| **Cho phép** (`CRD`, `ClusterRole`, `StorageClass`) | **BỊ CẤM HOÀN TOÀN** |
| **Allowed Git Repositories**| Repo hạ tầng GitOps | Repo ứng dụng + Repo hạ tầng |
| **Destination Cluster** | `https://kubernetes.default.svc` (in-cluster) | `https://kubernetes.default.svc` (in-cluster) |

---

## 3. Các bước thực hiện chi tiết (Console & Declarative Steps)

### Cách 1: Thao tác trực quan trên Argo CD Web UI

1. Mở trình duyệt truy cập `https://localhost:8080` (sau khi port-forward) -> Đăng nhập tài khoản `admin`.
2. Tại menu bên trái, nhấp vào biểu tượng bánh răng **Settings** -> Chọn **Projects**.
3. Bạn sẽ thấy project mặc định là `default`.
4. Nhấp nút **+ NEW PROJECT** ở góc trên bên trái:
   - **Project Name:** Nhập `reliability-shop`.
   - **Description:** `Restricted project for ReliabilityShop microservices`.
   - Nhấp **CREATE**.
5. Nhấp vào project `reliability-shop` vừa tạo để cấu hình chi tiết:
   - **Source Repositories:** Nhấp **EDIT** -> Nhấp **ADD SOURCE** -> Nhập URL GitHub repository của bạn -> Nhấp **SAVE**.
   - **Destinations:** Nhấp **EDIT** -> Nhấp **ADD DESTINATION**:
     - Server: `https://kubernetes.default.svc`
     - Namespace: Nhập `reliability-shop`
     - Nhấp **SAVE**.
   - **Cluster Resource Allow List:** Để trống (nghĩa là không cho phép tạo bất kỳ cluster-scoped resource nào).
   - **Namespace Resource Allow List:** Nhấp **EDIT** -> Nhấp **ADD GROUP**:
     - Cho phép các nhóm API: `apps`, `core`, `networking.k8s.io`, `argoproj.io`.
     - Nhấp **SAVE**.

---

### Cách 2: Khai báo bằng GitOps Manifests (Khuyến nghị SRE)

Tạo file `gitops/projects/platform-project.yaml`:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata:
  name: platform
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  description: Platform infrastructure add-ons and monitoring
  sourceRepos:
    - '*'
  destinations:
    - namespace: kube-system
      server: https://kubernetes.default.svc
    - namespace: external-secrets
      server: https://kubernetes.default.svc
    - namespace: monitoring
      server: https://kubernetes.default.svc
    - namespace: argocd
      server: https://kubernetes.default.svc
  clusterResourceWhitelist:
    - group: '*'
      kind: '*'
```

Tạo file `gitops/projects/reliability-shop-project.yaml`:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata:
  name: reliability-shop
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  description: Restricted tenancy project for ReliabilityShop application workloads
  sourceRepos:
    - 'https://github.com/*/aws-cloud-native-sre-platform'
    - 'https://github.com/*/reliability-shop'
  destinations:
    - namespace: reliability-shop
      server: https://kubernetes.default.svc
  # CHẶN TOÀN BỘ CLUSTER-SCOPED RESOURCES (Bảo vệ an toàn cụm)
  clusterResourceWhitelist: []
  # Chỉ cho phép tài nguyên cấp namespace
  namespaceResourceWhitelist:
    - group: 'apps'
      kind: 'Deployment'
    - group: ''
      kind: 'Service'
    - group: ''
      kind: 'ConfigMap'
    - group: ''
      kind: 'Secret'
    - group: 'networking.k8s.io'
      kind: 'Ingress'
    - group: 'argoproj.io'
      kind: 'Rollout'
    - group: 'argoproj.io'
      kind: 'AnalysisTemplate'
    - group: 'external-secrets.io'
      kind: 'ExternalSecret'
```

Áp dụng vào cluster:
```bash
kubectl apply -f gitops/projects/platform-project.yaml
kubectl apply -f gitops/projects/reliability-shop-project.yaml
```

---

## 4. Xác minh (Verification)

Kiểm tra danh sách AppProjects từ terminal:

```bash
kubectl get appprojects -n argocd
```

**Thử nghiệm phá vỡ rào chắn (Negative Security Testing):**
Thử nghiệm tạo một Application thuộc project `reliability-shop` nhưng cố tình khai báo deploy vào namespace `kube-system` hoặc tạo một `ClusterRole`.  
**Kết quả mong đợi:** Argo CD lập tức từ chối đồng bộ và báo lỗi:  
`Application destination is not permitted in project 'reliability-shop'` hoặc `Resource 'ClusterRole' is not permitted in project 'reliability-shop'`.

---

## 5. Điều kiện hoàn thành Gate (Gate Check)

- [ ] Cả 2 AppProjects (`platform` và `reliability-shop`) xuất hiện trên Argo CD Web UI.
- [ ] Project `reliability-shop` bị giới hạn chỉ deploy vào namespace `reliability-shop`.
- [ ] Toàn bộ tài nguyên cấp Cluster-scoped bị cấm trong project `reliability-shop`.

---

## 6. Dọn dẹp tài nguyên (Cleanup)

- Xóa AppProjects nếu cần thiết lập lại: `kubectl delete appproject platform reliability-shop -n argocd`.
