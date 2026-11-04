# Module 06: GitOps Delivery & Ứng dụng mẫu ReliabilityShop

## 1. Tổng quan Module

Module 06 thiết lập động cơ phân phối phần mềm liên tục (**Continuous Delivery Engine**) dựa trên mô hình **GitOps với Argo CD v2.11+**, đồng thời triển khai toàn bộ ứng dụng thương mại điện tử microservices mẫu **ReliabilityShop**:
- **Argo CD Bootstrap:** Khởi tạo Argo CD trên cụm EKS, thu hồi secret ban đầu và tích hợp xác thực với AWS Secrets Manager.
- **Ranh giới AppProjects & RBAC:** Phân tách ranh giới kiểm soát giữa các thành phần nền tảng (`platform` project cho phép tạo cluster-scoped resources) và ứng dụng người dùng (`reliability-shop` project giới hạn trong namespace riêng).
- **Mô hình App-of-Apps:** Sử dụng một ứng dụng gốc (Root Application) duy nhất để tự động quản lý và đồng bộ toàn bộ hệ thống.
- **Kustomize Overlays:** Quản lý cấu hình nhiều môi trường (`base`, `dev`, `staging`, `prod`) với việc tiêm các tham số thực tế (RDS Endpoint, Redis Host, SQS Queue URL) vào ConfigMap.
- **First Sync & Smoke Test:** Kiểm chứng việc đồng bộ tự động lần đầu và chạy kịch bản thử khói tạo đơn hàng thực tế qua REST API.

---

## 2. Danh mục bài Lab chi tiết

| Bài Lab | Tiêu đề | Trọng tâm kỹ thuật | Console / CLI Path |
| :--- | :--- | :--- | :--- |
| [**06.01**](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/06-gitops-application/01-argocd-bootstrap.md) | **Argo CD Bootstrap & Secrets** | Cài đặt Argo CD, xóa admin secret mặc định, đồng bộ mật khẩu qua Secrets Manager | Argo CD UI + kubectl |
| [**06.02**](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/06-gitops-application/02-projects-environments.md) | **AppProjects & RBAC Isolation** | Tạo project `platform` và `reliability-shop`, áp dụng chính sách whitelist tài nguyên | Argo CD Settings > Projects |
| [**06.03**](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/06-gitops-application/03-platform-applications.md) | **Platform Applications (App-of-Apps)**| Định nghĩa root app quản lý LBC, ESO, OTel, Prometheus, Loki, Tempo | `gitops/bootstrap/` |
| [**06.04**](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/06-gitops-application/04-reliabilityshop-base.md) | **Kustomize Base Manifests** | Xây dựng base cho `order-service` và `payment-worker` với Pod Anti-Affinity và Probes | `gitops/apps/workloads/base` |
| [**06.05**](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/06-gitops-application/05-environment-overlays.md) | **Environment Overlays (Dev)** | Cấu hình dev overlay với Ingress annotations cho ALB, tiêm endpoint RDS/Redis thật | `gitops/apps/workloads/overlays/dev` |
| [**06.06**](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/06-gitops-application/06-first-sync-smoke.md) | **First Sync & E2E Smoke Test** | Đồng bộ ứng dụng lần đầu, kiểm tra sức khỏe pods và tạo thử 1 đơn hàng qua REST API | Argo CD UI + cURL |

---

## 3. Tiêu chí hoàn thành Module (Exit Gate)

- [ ] Argo CD Web UI truy cập an toàn; tài khoản quản trị sử dụng mật khẩu mạnh được quản lý bởi Secrets Manager.
- [ ] 100% Application trên Argo CD đều hiển thị trạng thái `Synced` và `Healthy`.
- [ ] Tính năng Self-Healing hoạt động: Khi xóa pod hoặc deployment thủ công bằng `kubectl`, Argo CD tự động phục hồi trong vòng 10 giây.
- [ ] Microservices `order-service` và `payment-worker` kết nối thành công tới RDS PostgreSQL, ElastiCache Redis và SQS Queue.
- [ ] Lệnh kiểm thử API tạo đơn hàng thành công, trả về HTTP 201 Created và ghi nhận đơn hàng trong database.
