# 04.01 — Khởi tạo Amazon EKS Control Plane và Cấu hình Bảo mật etcd

> **Trạng thái:** Hướng dẫn thực hành chi tiết trên AWS Management Console (Console-first).  
> **Áp dụng cho:** Thiết lập tầng điều khiển Kubernetes (Control Plane), kích hoạt Audit Logging và mã hóa etcd bằng KMS CMK.

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Khởi tạo **Amazon EKS Cluster** phiên bản Kubernetes ổn định mới nhất (1.30+) trải rộng trên tối thiểu 2 Availability Zones.
  - Cấu hình mạng **Private-First**: Control plane ENIs chỉ gắn vào **Private App Subnets** (`10.0.10.0/24` và `10.0.11.0/24`).
  - Thiết lập **Cluster Endpoint Access**: Bật cả Public & Private (hoặc Private-only), cấu hình **EKS Access Entries** (Authentication Mode: `API and ConfigMap`) thay thế hoàn toàn cho ConfigMap `aws-auth` truyền thống.
  - Kích hoạt **Control Plane Logging** đầy đủ vào Amazon CloudWatch Logs: `API Server`, `Audit`, `Authenticator`, `Controller Manager` và `Scheduler`.
  - Bật mã hóa cấp độ etcd (**Secrets Encryption**) sử dụng **KMS Customer Managed Key** (`alias/sre-platform-dev-main`).
- **Nguyên tắc SRE:**
  - **Shared Responsibility Model in EKS:** AWS chịu trách nhiệm quản lý HA và tự động nâng cấp cho 3 Master Nodes của Control Plane; SRE chịu trách nhiệm về mạng, quyền truy cập IAM, etcd encryption và Worker Nodes.
  - **Auditability & Forensics:** Bật `Audit logs` và `Authenticator logs` là yêu cầu bắt buộc để phục vụ điều tra sự cố bảo mật (ai đã gọi lệnh gì tới Kubernetes API Server).
  - **etcd Defense in Depth:** Mã hóa Secrets ở mức etcd đảm bảo kể cả khi etcd volume bị truy cập trái phép, toàn bộ Kubernetes Secrets vẫn được bảo vệ bởi khóa KMS.

---

## 2. Thông số đầu vào (Input Parameters)

| Tham số | Giá trị mẫu / Quy ước | Ý nghĩa |
| :--- | :--- | :--- |
| **Cluster Name** | `sre-platform-dev` | Tên cluster EKS thống nhất |
| **Kubernetes Version** | `1.30` (hoặc phiên bản ổn định mới nhất) | Phiên bản Kubernetes |
| **Cluster Service Role**| `sre-platform-dev-eks-cluster-role` | IAM Role cấp cho EKS Control Plane |
| **VPC ID** | `sre-platform-dev-vpc` | VPC chứa nền tảng |
| **Subnets** | 2 Private App Subnets (`10.0.10.0/24`, `10.0.11.0/24`) | Subnets đặt ENI của Control plane |
| **Cluster Security Group**| `sre-platform-dev-cluster-sg` | Security Group bảo vệ API Server |
| **Endpoint Access** | `Public and private` | Cho phép truy cập từ máy trạm và nội bộ VPC |
| **KMS Key ARN** | `alias/sre-platform-dev-main` | Khóa mã hóa etcd secrets |
| **Authentication Mode** | `API and ConfigMap` | Chuẩn EKS Access Entries hiện đại |

---

## 3. Các bước thực hiện chi tiết trên AWS Console (Console Steps)

### Bước 1: Tạo IAM Service Role cho EKS Control Plane

*(Nếu chưa có role cho EKS Cluster, thực hiện bước này)*

1. Đăng nhập **AWS Console**, mở dịch vụ **IAM** -> Nhấp vào **Roles** -> **Create role**.
2. **Select trusted entity:**
   - Chọn **AWS service**.
   - Dưới mục *Use case for other AWS services*: Chọn **EKS** -> Chọn **EKS - Cluster**.
   - Nhấp **Next**.
3. **Add permissions:**
   - AWS tự động gắn policy chuẩn: `AmazonEKSClusterPolicy`.
   - Nhấp **Next**.
4. **Name, review, and create:**
   - **Role name:** Nhập `sre-platform-dev-eks-cluster-role`.
   - **Tags:** `Environment` = `dev`, `Project` = `sre-platform`.
   - Nhấp **Create role**.

---

### Bước 2: Bắt đầu Tạo EKS Cluster trên Console

1. Nhập `EKS` vào ô tìm kiếm Console -> Chọn **Amazon Elastic Kubernetes Service**.
2. Tại menu bên trái, nhấp vào **Clusters** -> Nhấp nút cam **Add cluster** -> Chọn **Create**.
3. **Step 1 - Configure cluster:**
   - **Name:** Nhập `sre-platform-dev`.
   - **Kubernetes version:** Chọn `1.30` (hoặc bản mới nhất có sẵn).
   - **Cluster service role:** Chọn role vừa tạo ở Bước 1: `sre-platform-dev-eks-cluster-role`.
   - **Authentication mode:** Bắt buộc chọn **API and ConfigMap** (chuẩn mới khuyến nghị của AWS).
   - **Tags:** Thêm `Environment` = `dev`, `Project` = `sre-platform`, `ManagedBy` = `Console-to-IaC`.
   - Nhấp nút **Next**.

---

### Bước 3: Cấu hình Mạng (Specify Networking)

1. **Virtual Private Cloud (VPC):** Chọn `sre-platform-dev-vpc`.
2. **Subnets:**
   - Mặc định AWS có thể chọn toàn bộ subnets trong VPC.
   - **Hãy xóa bỏ các Public Subnets và Database Subnets khỏi danh sách**.
   - **Chỉ giữ lại 2 Private App Subnets:**
     - `sre-platform-dev-private-app-1a` (`10.0.10.0/24`)
     - `sre-platform-dev-private-app-1b` (`10.0.11.0/24`)
3. **Security groups:**
   - Chọn `sre-platform-dev-cluster-sg` (hoặc chọn default cluster SG nếu muốn AWS tự động tạo managed security group).
4. **Cluster endpoint access:**
   - Chọn radio button **Public and private**.
   - *(Tùy chọn bảo mật cao):* Nhấp **Advanced settings** -> Nhập địa chỉ Public IP của máy trạm quản trị vào ô CIDR block để hạn chế chỉ cho phép IP của bạn truy cập API Server từ Internet.
5. Nhấp nút **Next**.

---

### Bước 4: Cấu hình Giám sát Nhật ký (Configure Observability / Logging)

1. Tại mục **Control plane logging**:
   - Gạt công tắc sang **On** cho toàn bộ 5 loại logs:
     - **API server:** Theo dõi các yêu cầu gửi đến API server.
     - **Audit:** Ghi vết kiểm toán ai đã tương tác với cluster.
     - **Authenticator:** Xác thực người dùng và vai trò IAM.
     - **Controller manager:** Trạng thái của các core controllers.
     - **Scheduler:** Quyết định lập lịch điều phối Pods lên nodes.
2. Nhấp nút **Next**.

---

### Bước 5: Bật Mã hóa Khóa etcd (Select Add-ons & Encryption)

1. Tại mục **Secrets encryption:**
   - Gạt công tắc sang **Enable** (Bật).
   - **KMS key:** Chọn **Choose from your KMS keys** -> Chọn `alias/sre-platform-dev-main`.
   > [!CAUTION]
   > Tính năng Secrets Encryption chỉ có thể bật khi tạo cluster ban đầu; bạn không thể bật sau khi cluster đã được tạo mà không thực hiện migration phức tạp.
2. Nhấp **Next** -> Xem lại trang **Review and create**.
3. Nhấp nút cam **Create** ở cuối trang.
4. Quá trình tạo EKS Control Plane mất từ 8 đến 12 phút. Chờ **Status** chuyển từ `Creating` sang **Active** (Màu xanh lá cây).

---

## 4. Xác minh và Cấu hình Kubeconfig (Verification)

### 4.1. Cập nhật Kubeconfig trên Máy trạm Quản trị
Từ terminal máy trạm có cài đặt AWS CLI và `kubectl`, chạy lệnh:

```bash
# Cập nhật context kubeconfig để trỏ tới cluster mới tạo
aws eks update-kubeconfig \
  --region ap-southeast-1 \
  --name sre-platform-dev

# Kiểm tra kết nối tới Kubernetes API Server
kubectl cluster-info

# Kiểm tra các components cơ bản của Control Plane
kubectl get componentstatuses
```

### 4.2. Kiểm tra Nhật ký trên CloudWatch Logs Console
1. Mở dịch vụ **CloudWatch** -> Menu bên trái chọn **Log groups**.
2. Tìm kiếm nhóm log: `/aws/eks/sre-platform-dev/cluster`.
3. Nhấp vào log stream `kube-apiserver-audit-...` để xác nhận audit logs đang được ghi nhận liên tục theo thời gian thực.

---

## 5. Chuyển giao sang IaC (Terraform Snippet)

```hcl
resource "aws_eks_cluster" "main" {
  name     = "sre-platform-dev"
  role_arn = aws_iam_role.cluster.arn
  version  = "1.30"

  vpc_config {
    subnet_ids              = [aws_subnet.private_app_1a.id, aws_subnet.private_app_1b.id]
    endpoint_private_access = true
    endpoint_public_access  = true
    security_group_ids      = [aws_security_group.cluster.id]
  }

  enabled_cluster_log_types = ["api", "audit", "authenticator", "controllerManager", "scheduler"]

  encryption_config {
    provider {
      key_arn = data.aws_kms_key.main.arn
    }
    resources = ["secrets"]
  }

  access_config {
    authentication_mode = "API_AND_CONFIG_MAP"
  }

  tags = {
    Environment = "dev"
    Project     = "sre-platform"
  }
}
```

---

## 6. Điều kiện hoàn thành Gate (Gate Check)

- [ ] EKS Cluster `sre-platform-dev` ở trạng thái **Active**.
- [ ] Control Plane ENIs chỉ nằm trong 2 Private App Subnets.
- [ ] Đủ 5 loại Control Plane Logs được bật và xuất hiện trong CloudWatch Log Groups.
- [ ] Secrets Encryption bằng KMS CMK đã kích hoạt thành công.
- [ ] Lệnh `kubectl cluster-info` từ terminal trả về thông tin Kubernetes Control Plane hoạt động bình thường.

---

## 7. Dọn dẹp tài nguyên (Cleanup)

> [!CAUTION]
> Tuyệt đối không xóa Cluster nếu bên trong vẫn còn Node Groups, Fargate profiles, hoặc Ingress ALB đang chạy. Phải xóa theo thứ tự: Workloads -> Ingress -> Node Groups -> Cluster.

Khi cần hủy cluster:
1. Đảm bảo toàn bộ Node Groups ở bài 04.02 đã bị xóa.
2. Vào **EKS Console** -> **Clusters** -> Chọn `sre-platform-dev` -> Nhấp **Delete cluster** -> Gõ tên cluster để xác nhận.
