# GitOps Bootstrap — Argo CD App-of-Apps Pattern

Thư mục `gitops/bootstrap/` chứa các manifests khởi động toàn bộ nền tảng **AWS Cloud-Native SRE Platform** theo mô hình thiết kế **App-of-Apps Pattern**.

---

## 1. Kiến trúc Cây Phân cấp (Resource Hierarchy)

```text
               [ sre-platform-root ]
             (gitops/bootstrap/root-application.yaml)
                        │
         ┌──────────────┴──────────────┐
         ▼                             ▼
   [ platform-root ]              [ apps-root ]
 (gitops/platform)            (gitops/applications)
         │                             │
   ┌─────┴─────┐                       ▼
   ▼           ▼             [ reliability-shop ]
[ingress]  [secrets]      (ReliabilityShop Microservices)
```

---

## 2. Các thành phần trong thư mục

| File | Loại tài nguyên | Chức năng |
| :--- | :--- | :--- |
| `root-application.yaml` | `Application` (Argo CD) | **Master Root Application** — Quét thư mục `gitops/bootstrap/` và tự động sinh ra các root controller con. |
| `platform-root-app.yaml`| `Application` (Argo CD) | Quản lý các Add-ons hạ tầng (`gitops/platform/`): Ingress, External Secrets, Observability (Prometheus, Loki, Tempo). |
| `apps-root-app.yaml`    | `Application` (Argo CD) | Quản lý các Workloads nghiệp vụ (`gitops/applications/`): `reliability-shop` microservices. |

---

## 3. Cách khởi tạo (One-Command Bootstrap)

Khi thiết lập một cluster mới hoặc khôi phục sau thảm họa (Disaster Recovery):

```bash
# 1. Cài đặt AppProjects phân quyền
kubectl apply -f gitops/projects/

# 2. Áp dụng Master Root Application
kubectl apply -f gitops/bootstrap/root-application.yaml
```

Ngay sau lệnh trên, Argo CD sẽ tự động:
1. Đồng bộ `platform-root` và `apps-root`.
2. Tạo Ingress chia sẻ ALB (`sre-platform` group).
3. Tạo ClusterSecretStore cho External Secrets Operator.
4. Triển khai toàn bộ cụm microservices ReliabilityShop (`frontend`, `order-service`, `payment-worker`, `inventory`, `auth`).
