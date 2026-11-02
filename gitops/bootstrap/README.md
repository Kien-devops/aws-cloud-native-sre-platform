# GitOps Platform Architecture & Directory Structure Guide

Tài liệu này giải thích chi tiết kiến trúc điều phối GitOps trên cụm Amazon EKS, chức năng của từng thư mục trong cấu trúc GitOps Repository, và cách thức vận hành theo mô hình thiết kế **Argo CD App-of-Apps Pattern**.

---

## 1. Tổng quan Cấu trúc Thư mục GitOps (`gitops/`)

```text
gitops/
├── bootstrap/               # [1] Tầng Khởi động Gốc (App-of-Apps Root Engine)
│   ├── root-application.yaml       # Master Application điều khiển toàn bộ nền tảng
│   ├── platform-root-app.yaml      # Controller điều khiển tầng hạ tầng (Platform Add-ons)
│   ├── apps-root-app.yaml          # Controller điều khiển tầng ứng dụng (Business Workloads)
│   └── README.md                   # Tài liệu kiến trúc và hướng dẫn vận hành
│
├── projects/                # [2] Tầng Phân quyền & Cô lập Ranh giới (AppProjects & Multi-Tenancy)
│   ├── platform-project.yaml       # Quyền năng Cluster-Wide cho hạ tầng & controllers
│   └── reliability-shop-project.yaml# Giới hạn Namespace-Scoped cho ứng dụng nghiệp vụ
│
├── platform/                # [3] Tầng Add-ons Hạ tầng Dùng chung (Platform Controllers)
│   ├── ingress/                    # Ingress chia sẻ ALB (argocd-ingress.yaml)
│   ├── external-secrets/           # Cấu hình SecretStore (cluster-secret-store.yaml)
│   ├── ingress-app.yaml            # Argo CD Application quản lý Ingress
│   ├── external-secrets-app.yaml   # Argo CD Application quản lý External Secrets
│   ├── cert-manager/               # Quản lý chứng chỉ tự động (tuỳ chọn)
│   ├── monitoring/                 # Stack giám sát Prometheus, Loki, Tempo
│   └── karpenter/                  # Tự động co giãn Node cấp tốc độ giây
│
└── applications/            # [4] Tầng Ứng dụng Nghiệp vụ (Workloads & Microservices)
    └── reliability-shop/           # Bộ microservices bán hàng ReliabilityShop
        ├── application.yaml        # Argo CD Application triển khai ReliabilityShop
        └── base/                   # Kustomize Base manifests
            ├── reliability-shop-app.yaml # Deployments & Services cho 5 microservices
            ├── external-secret.yaml      # Đồng bộ credentials từ Secrets Manager qua ESO
            └── ingress.yaml              # Ingress gia nhập sre-platform ALB group
```

---

## 2. Chi tiết Chức năng của Từng Thư mục

### [1] Thư mục `gitops/bootstrap/` — Trái Tim Điều Phối (App-of-Apps Root Engine)
* **Vai trò:** Là điểm chạm duy nhất (**Single Entrypoint**) để khởi tạo toàn bộ cụm EKS từ con số không.
* **Nguyên lý hoạt động:**
  - Thay vì phải chạy hàng chục lệnh `kubectl apply` cho từng microservice hoặc helm chart, SRE chỉ cần áp dụng `root-application.yaml`.
  - `root-application.yaml` sẽ tự động quét thư mục `gitops/bootstrap/` và sinh ra:
    - `platform-root`: Lắng nghe mọi thay đổi trong `gitops/platform/`.
    - `apps-root`: Lắng nghe mọi thay đổi trong `gitops/applications/`.
* **Ý nghĩa thực tế:** Cho phép tái thiết lập toàn bộ nền tảng sau thảm họa (Disaster Recovery) chỉ trong vòng **dưới 3 phút**.

---

### [2] Thư mục `gitops/projects/` — Ranh Giới Bảo Mật (AppProjects & RBAC Isolation)
* **Vai trò:** Định nghĩa chính sách phân quyền cho các nhóm đối tượng (**Multi-Tenancy Security Boundaries**) thông qua CRD `AppProject` của Argo CD.
* **Chi tiết phân quyền:**
  1. **`platform-project.yaml` (`project: platform`):**
     - Dành cho đội ngũ Platform / SRE.
     - **Cho phép** tạo tài nguyên cấp cụm (**Cluster-Scoped Resources**): CRDs, ClusterRoles, Ingress Classes, Webhooks, Namespaces.
     - Destination namespaces: `kube-system`, `external-secrets`, `argocd`, `monitoring`, `observability`.
  2. **`reliability-shop-project.yaml` (`project: reliability-shop`):**
     - Dành cho các nhóm phát triển ứng dụng (Product Developers).
     - **CẤM TRIỆT ĐỂ** việc tạo cluster-scoped resources (`clusterResourceWhitelist: []`).
     - **Chỉ cho phép** tạo các tài nguyên an toàn cấp namespace (`Deployment`, `Service`, `Ingress`, `ConfigMap`, `ExternalSecret`) nằm đúng bên trong namespace `reliability-shop`.
     - Ngăn ngừa hiện tượng một cấu hình sai của lập trình viên làm tê liệt toàn bộ EKS cluster (**Blast Radius Containment**).

---

### [3] Thư mục `gitops/platform/` — Hạ Tầng Dùng Chung (Platform Add-ons)
* **Vai trò:** Chứa manifests của các thành phần bổ trợ (Add-ons) vận hành ở tầng nền tảng mà các ứng dụng bên trên phụ thuộc vào:
  - **`ingress/`:** Cấu hình Ingress cho các công cụ quản trị (như Argo CD Dashboard) gia nhập nhóm ALB dùng chung (`alb.ingress.kubernetes.io/group.name: sre-platform`).
  - **`external-secrets/`:** Khai báo `ClusterSecretStore` kết nối an toàn với AWS Secrets Manager qua EKS Pod Identity.
  - **`monitoring/` & `observability/`:** Chứa OpenTelemetry Collector, Prometheus Alertmanager, Grafana Loki và Tempo.
  - **`karpenter/` & `keda/`:** Động cơ tự động co giãn tài nguyên điện toán và hàng đợi.

---

### [4] Thư mục `gitops/applications/` — Workloads Nghiệp Vụ (Business Applications)
* **Vai trò:** Nơi chứa mã khai báo triển khai cho các dịch vụ phục vụ người dùng cuối (ví dụ: `reliability-shop`).
* **Đặc điểm kiến trúc:**
  - **BFF (Backend-For-Frontend) Pattern:** Pod `frontend` tiếp nhận lưu lượng từ ALB và phân luồng nội bộ tới các dịch vụ phía sau (`order-service`, `payment-worker`, `inventory-service`, `auth-service`).
  - **Real Cloud Integration:**
    - Kết nối RDS PostgreSQL 16.9.
    - Kết nối Amazon ElastiCache Redis 7.1 qua giao thức bảo mật TLSv1.3 với cơ chế Cache-Aside.
    - Kết nối AWS SQS Queue thông qua EKS Pod Identity ServiceAccount (`reliability-shop-sa`).
  - **Zero Secrets in Git:** Toàn bộ mật khẩu, chuỗi kết nối và auth token đều được lấy tự động qua ESO từ AWS Secrets Manager, cam kết không lộ bất kỳ credential nào trên Git.

---

## 3. Quy Trình Khởi Động Toàn Cụm (One-Command Bootstrap Walkthrough)

Khi cần thiết lập cụm mới hoặc diễn tập khôi phục hệ thống (DR Drill):

```bash
# Bước 1: Khởi tạo các ranh giới bảo mật AppProjects
kubectl apply -f gitops/projects/

# Bước 2: Kích hoạt động cơ Master App-of-Apps
kubectl apply -f gitops/bootstrap/root-application.yaml
```

### Tiến trình tự động diễn ra sau 60 giây:
```text
[sre-platform-root]
   ├── [platform-root]
   │      ├── platform-ingress         --> argocd.dev.devopsss.site (Healthy)
   │      └── platform-external-secrets --> sre-platform-cluster-secret-store (Active)
   │
   └── [apps-root]
          └── reliability-shop         --> shop.dev.devopsss.site (Healthy)
                 ├── RDS PostgreSQL 16.9 Connected (3ms)
                 ├── ElastiCache Redis TLS Connected (PONG)
                 └── AWS SQS Queue & Payment Worker Polling
```

---

## 4. Hướng Dẫn Mở Rộng: Thêm Một Microservice Mới

Khi muốn bổ sung một microservice mới vào hệ thống (ví dụ: `notification-service`):
1. **Thêm Deployment & Service** vào file `gitops/applications/reliability-shop/base/reliability-shop-app.yaml`.
2. **Khai báo Reverse Proxy** trong `frontend/server.js` nếu muốn route qua frontend, hoặc khai báo Ingress riêng nếu muốn mở public.
3. **Commit & Push lên Git:**
   ```bash
   git add -A && git commit -m "feat: add notification-service" && git push
   ```
4. **Argo CD tự động phát hiện và reconcile:** Không cần thao tác thủ công trên cluster. Cơ chế `selfHeal` và `prune` sẽ tự động giữ cụm đồng nhất 100% với Git.
