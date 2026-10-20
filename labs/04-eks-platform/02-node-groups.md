# 04.02 — Khởi tạo Amazon EKS Managed Node Group Đa Availability Zone

> **Trạng thái:** Hướng dẫn thực hành chi tiết trên AWS Management Console (Console-first).  
> **Áp dụng cho:** Thiết lập tầng tính toán máy chủ công nhân (Data Plane / Worker Nodes) trong mạng riêng tư (Private Subnets).

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Tạo IAM Role cho EC2 Worker Nodes với các quyền hạn tối thiểu của Kubernetes runtime.
  - Khởi tạo **Amazon EKS Managed Node Group** (`sre-platform-dev-system-nodes`) trải rộng trên 2 Private App Subnets (`ap-southeast-1a` và `ap-southeast-1b`).
  - Thiết lập cấu hình tự động mở rộng (Autoscaling Bounds): Min = 2, Desired = 2, Max = 4.
  - Sử dụng hệ điều hành **Amazon Linux 2023 (AL2023)** tối ưu hóa cho EKS, ổ cứng 50 GiB gp3 có mã hóa KMS.
  - Gắn nhãn phân loại (Kubernetes Node Labels) để phục vụ việc điều phối Pods (Node Affinity và Topology Spread Constraints).
- **Nguyên tắc SRE:**
  - **Zero Public IPs for Compute:** Toàn bộ EC2 Worker Nodes tuyệt đối không được cấp phát Public IPv4. Mọi giao tiếp với Internet để tải package hoặc Docker images phải đi qua NAT Gateway.
  - **Even Multi-AZ Distribution:** Luôn duy trì số lượng nodes chẵn (tối thiểu 2 nodes) chia đều trên 2 AZs độc lập. Khi một AZ bị mất điện, AZ còn lại vẫn đủ năng lực tiếp nhận các pods quan trọng.
  - **Graceful Draining during Node Upgrades:** Managed Node Group được AWS tự động xử lý rolling update và cordon/drain pods an toàn, kết hợp chặt chẽ với PodDisruptionBudget (PDB) của ứng dụng.

---

## 2. Thông số đầu vào (Input Parameters)

| Tham số | Giá trị mẫu / Quy ước | Ý nghĩa |
| :--- | :--- | :--- |
| **Node Group Name** | `sre-platform-dev-system-nodes` | Tên nhóm máy chủ công nhân |
| **Cluster Name** | `sre-platform-dev` | Tên cluster EKS đã tạo ở bài 04.01 |
| **IAM Node Role** | `sre-platform-dev-node-role` | Role gắn vào EC2 Instance Profile |
| **AMI Type** | `Amazon Linux 2023 (AL2023_x86_64)` | Hệ điều hành tối ưu cho EKS container runtime |
| **Capacity Type** | `On-Demand` (hoặc `Spot` cho dev) | Hình thức mua năng lực tính toán |
| **Instance Type** | `t3.medium` (2 vCPU, 4 GiB RAM) | Cấu hình máy chủ phù hợp môi trường lab |
| **Disk Size** | `50 GiB gp3` (Mã hóa KMS) | Dung lượng ổ đĩa chứa root OS và container images |
| **Subnets** | 2 Private App Subnets | `10.0.10.0/24` (AZ-a) và `10.0.11.0/24` (AZ-b) |
| **Scaling Size** | Min: `2` — Desired: `2` — Max: `4` | Ngưỡng co giãn số lượng máy chủ |
| **Kubernetes Labels** | `role=system`, `environment=dev` | Nhãn phục vụ lập lịch Pods |

---

## 3. Các bước thực hiện chi tiết trên AWS Console (Console Steps)

### Bước 1: Tạo IAM Role cho EC2 Worker Nodes

1. Mở dịch vụ **IAM** -> Menu bên trái chọn **Roles** -> Nhấp nút cam **Create role**.
2. **Select trusted entity:**
   - Chọn **AWS service**.
   - Dưới mục *Use case for other AWS services*: Chọn **EC2** -> Nhấp **Next**.
3. **Add permissions:**
   - Lần lượt tìm kiếm và tích chọn 3 chính sách (managed policies) bắt buộc sau:
     1. `AmazonEKSWorkerNodePolicy` (cho phép node kết nối tới EKS Control plane).
     2. `AmazonEC2ContainerRegistryReadOnly` (cho phép node kéo images từ ECR).
     3. `AmazonEKS_CNI_Policy` (cho phép AWS VPC CNI cấu hình ENI và IP cho pods).
   - Nhấp **Next**.
4. **Name, review, and create:**
   - **Role name:** Nhập `sre-platform-dev-node-role`.
   - **Tags:** `Environment` = `dev`, `Project` = `sre-platform`.
   - Nhấp **Create role**.

---

### Bước 2: Bắt đầu Tạo Managed Node Group trên EKS Console

1. Mở dịch vụ **Amazon EKS** -> Nhấp vào cluster `sre-platform-dev`.
2. Chuyển sang tab **Compute** (nằm cạnh Overview, Access, Networking).
3. Kéo xuống mục **Node groups** -> Nhấp nút cam **Add node group**.
4. **Step 1 - Configure node group:**
   - **Name:** Nhập `sre-platform-dev-system-nodes`.
   - **Node IAM role:** Chọn role vừa tạo ở Bước 1: `sre-platform-dev-node-role`.
   - **Tags:** Thêm `Environment` = `dev`, `Project` = `sre-platform`.
   - **Kubernetes labels:** Nhấp **Add label**:
     - Key: `role` — Value: `system`
     - Key: `environment` — Value: `dev`
   - Nhấp **Next**.

---

### Bước 3: Cấu hình Phần cứng và Lưu trữ (Set Compute and Scaling)

1. **AMI configuration:**
   - **AMI type:** Chọn `Amazon Linux 2023 (AL2023_x86_64)`.
   - **Capacity type:** Chọn `On-Demand`.
2. **Instance types:**
   - Mặc định là `t3.medium`. Nếu cần đổi, nhấp chọn instance type phù hợp (ví dụ `t3.medium` - 2 vCPU, 4 GiB Memory).
3. **Disk size:**
   - Nhập `50` GiB.
4. **Node group scaling configuration:**
   - **Minimum size:** `2`
   - **Maximum size:** `4`
   - **Desired size:** `2`
5. **Node group update configuration:**
   - Chọn **Maximum unavailable:** `1` (Đảm bảo trong quá trình nâng cấp hoặc bảo trì, chỉ có tối đa 1 node bị offline cùng lúc).
6. Nhấp nút **Next**.

---

### Bước 4: Cấu hình Mạng Private cho Nodes (Specify Networking)

1. **Subnets:**
   - **Cực kỳ quan trọng:** Đảm bảo **CHỈ CHỌN 2 Private App Subnets**:
     - `sre-platform-dev-private-app-1a` (`10.0.10.0/24`)
     - `sre-platform-dev-private-app-1b` (`10.0.11.0/24`)
   - Tuyệt đối **KHÔNG CHỌN** Public Subnets hay Database Subnets.
2. **Configure SSH access to nodes:**
   - Chọn **Disable** (Tắt SSH truyền thống; việc quản trị hoặc debug máy chủ EC2 sẽ dùng AWS Systems Manager Session Manager an toàn hơn và không cần mở cổng 22).
3. Nhấp nút **Next**.
4. Xem lại toàn bộ thông tin tại trang **Review and create**.
5. Nhấp nút cam **Create**.
6. Quá trình tạo EC2 Worker Nodes và join vào cluster mất từ 3 đến 5 phút. Chờ trạng thái của Node Group chuyển sang **Active** (Màu xanh).

---

## 4. Xác minh (Verification)

### 4.1. Kiểm tra trên Console
- **EKS Console:** Tab **Compute** hiển thị Node Group `sre-platform-dev-system-nodes` với trạng thái **Active**, 2 nodes Ready.
- **EC2 Console:** Menu **Instances** hiển thị 2 EC2 instances mới có tên tiền tố dạng `sre-platform-dev-system-nodes-...`, trạng thái **Running**, không có Public IPv4, và nằm ở 2 AZs khác nhau (`ap-southeast-1a` và `ap-southeast-1b`).

### 4.2. Kiểm tra bằng `kubectl` từ Terminal
```bash
# 1. Liệt kê danh sách các nodes cùng thông tin Zone và OS Image
kubectl get nodes -o custom-columns=NAME:.metadata.name,STATUS:.status.conditions[-1].type,ZONE:.metadata.labels.'topology\.kubernetes\.io/zone',INSTANCE_TYPE:.metadata.labels.'beta\.kubernetes\.io/instance-type',OS_IMAGE:.status.nodeInfo.osImage

# 2. Kiểm tra nhãn Kubernetes đã gắn trên nodes
kubectl get nodes --show-labels | grep role=system

# 3. Kiểm tra các Pods hệ thống đang chạy trên nodes
kubectl get pods -n kube-system -o wide
```

**Kết quả mong đợi:**
- Cả 2 nodes đều hiển thị trạng thái `Ready`.
- Một node nằm tại `ap-southeast-1a`, một node nằm tại `ap-southeast-1b`.
- Các daemon pods của `aws-node` (VPC CNI) và `kube-proxy` đang chạy ở trạng thái `Running` trên từng node.

---

## 5. Chuyển giao sang IaC (Terraform Snippet)

```hcl
resource "aws_eks_node_group" "system" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "sre-platform-dev-system-nodes"
  node_role_arn   = aws_iam_role.node.arn
  subnet_ids      = [aws_subnet.private_app_1a.id, aws_subnet.private_app_1b.id]

  ami_type       = "AL2023_x86_64_STANDARD"
  instance_types = ["t3.medium"]
  capacity_type  = "ON_DEMAND"
  disk_size      = 50

  scaling_config {
    desired_size = 2
    max_size     = 4
    min_size     = 2
  }

  update_config {
    max_unavailable = 1
  }

  labels = {
    role        = "system"
    environment = "dev"
  }

  tags = {
    Environment = "dev"
    Project     = "sre-platform"
  }
}
```

---

## 6. Điều kiện hoàn thành Gate (Gate Check)

- [ ] Node Group `sre-platform-dev-system-nodes` ở trạng thái **Active**.
- [ ] 2 Worker Nodes hoạt động ở 2 AZs khác nhau (`Ready` status).
- [ ] Nodes không có Public IP và giao tiếp với Internet thông qua NAT Gateway.
- [ ] Lệnh `kubectl get nodes` hiển thị đầy đủ nhãn `role=system` và hệ điều hành Amazon Linux 2023.

---

## 7. Dọn dẹp tài nguyên (Cleanup)

1. Vào **EKS Console** -> Cluster `sre-platform-dev` -> Tab **Compute**.
2. Chọn Node Group `sre-platform-dev-system-nodes` -> Nhấp **Delete** -> Xác nhận xóa.
3. Chờ toàn bộ các EC2 instances tự động terminate trước khi chuyển sang xóa cluster.
