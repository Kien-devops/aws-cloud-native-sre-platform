# 04.03 — Quản lý Tiện ích Bổ sung Amazon EKS Managed Add-ons

> **Trạng thái:** Hướng dẫn thực hành chi tiết trên AWS Management Console (Console-first).  
> **Áp dụng cho:** Cài đặt, bảo trì và cấu hình các thành phần mạng, DNS và định danh cơ bản của Kubernetes (`vpc-cni`, `coredns`, `kube-proxy`, `eks-pod-identity-agent`).

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Triển khai bộ 4 EKS Managed Add-ons cốt lõi thông qua AWS Console:
    1. **Amazon VPC CNI (`vpc-cni`):** Cung cấp địa chỉ IP từ VPC trực tiếp cho từng Kubernetes Pod.
    2. **CoreDNS (`coredns`):** Máy chủ phân giải tên miền nội bộ cho toàn bộ Services trong cluster.
    3. **kube-proxy (`kube-proxy`):** Quản lý iptables/IPVS rules trên từng worker node để điều phối traffic tới Service ClusterIP.
    4. **EKS Pod Identity Agent (`eks-pod-identity-agent`):** DaemonSet trung gian cung cấp thông tin xác thực AWS IAM cho Pods thông qua giao thức Pod Identity.
  - Cấu hình phương thức xử lý xung đột (**Conflict Resolution**): `OVERWRITE` để AWS quản lý phiên bản ổn định nhất.
- **Nguyên tắc SRE:**
  - **Platform Add-on Lifecycle Management:** Tận dụng Managed Add-ons của AWS thay vì tự cài thủ công bằng manifests rời rạc giúp tự động tương thích với phiên bản Kubernetes Control Plane và nhận các bản vá bảo mật nhanh nhất.
  - **DNS Saturation & Latency:** CoreDNS là trái tim của mọi microservices; sự cố CoreDNS sẽ dẫn đến cascading failure (lỗi dây chuyền) toàn hệ thống. Bắt buộc CoreDNS phải chạy tối thiểu 2 replicas phân bổ trên 2 AZs.
  - **IP Exhaustion Guardrails:** Bật tính năng **Prefix Delegation** trên VPC CNI nếu cần tăng mật độ Pods trên mỗi Node mà không làm cạn kiệt dải subnet IP.

---

## 2. Danh mục EKS Managed Add-ons

| Tên Add-on | Loại Workload | Namespace | Mục đích SRE |
| :--- | :--- | :--- | :--- |
| **`vpc-cni`** | DaemonSet (`aws-node`) | `kube-system` | Cấp phát ENI và VPC IP cho Pods |
| **`coredns`** | Deployment (2 replicas) | `kube-system` | Phân giải DNS nội bộ cluster (`*.cluster.local`) |
| **`kube-proxy`** | DaemonSet | `kube-system` | Điều hướng TCP/UDP cho Kubernetes Services |
| **`eks-pod-identity-agent`**| DaemonSet | `kube-system` | Cầu nối xác thực IAM Pod Identity cho workloads |

---

## 3. Các bước thực hiện chi tiết trên AWS Console (Console Steps)

### Bước 1: Mở Giao diện Quản lý Add-ons trên EKS Console

1. Đăng nhập vào **AWS Console**, chọn Region `ap-southeast-1`.
2. Mở dịch vụ **Amazon EKS** -> Nhấp vào tên cluster: `sre-platform-dev`.
3. Chuyển sang tab **Add-ons** (nằm cạnh Overview, Workloads, Compute).
4. Bạn sẽ thấy danh sách các Add-ons mặc định đã có sẵn (`vpc-cni`, `kube-proxy`, `coredns`).
5. Nhấp nút cam **Get more add-ons**.

---

### Bước 2: Cài đặt EKS Pod Identity Agent Add-on

1. Tại danh sách Add-ons có sẵn:
   - Trong ô tìm kiếm, gõ `pod identity`.
   - Tìm thẻ **EKS Pod Identity Agent** -> Tích chọn checkbox.
2. Nhấp nút **Next** ở cuối trang.
3. **Configure selected add-ons:**
   - **Version:** Chọn phiên bản mặc định khuyến nghị (Default/Latest).
   - **Conflict resolution method:** Chọn **Overwrite** (Cho phép AWS ghi đè cấu hình nếu có xung đột).
4. Nhấp nút **Next** -> Nhấp nút cam **Create**.
5. Quan sát thanh trạng thái: Add-on chuyển từ `Creating` sang **Active** (Màu xanh).

---

### Bước 3: Nâng cấp và Tối ưu hóa VPC CNI Add-on

1. Tại danh sách tab **Add-ons**, nhấp vào **v1.x.x-eksbuild.x** của add-on **vpc-cni**.
2. Nhấp nút **Edit**.
3. **Configuration values (Tùy chọn SRE - Bật Prefix Delegation):**
   - Nếu bạn muốn tăng số lượng Pods tối đa trên mỗi worker node (`t3.medium` từ 17 pods lên 110 pods), chuyển sang chế độ **Custom configuration** (dạng JSON hoặc YAML):
     ```json
     {
       "env": {
         "ENABLE_PREFIX_DELEGATION": "true",
         "WARM_PREFIX_TARGET": "1"
       }
     }
     ```
4. **Conflict resolution method:** Chọn **Overwrite**.
5. Nhấp **Save changes**. Chờ trạng thái cập nhật chuyển sang **Active**.

---

### Bước 4: Kiểm tra Cấu hình CoreDNS

1. Nhấp vào add-on **coredns** -> Nhấp **Edit**.
2. Xác nhận phiên bản add-on tương thích với Kubernetes 1.30.
3. Kiểm tra mục **Conflict resolution method:** Chọn **Overwrite**.
4. Nhấp **Save changes** nếu có thay đổi.

---

## 4. Xác minh từ Terminal Quản trị (Verification)

Chạy các câu lệnh sau để kiểm tra trạng thái thực tế của các pods hệ thống trong cluster:

```bash
# 1. Liệt kê toàn bộ EKS Add-ons được quản lý qua AWS CLI
aws eks list-addons \
  --cluster-name sre-platform-dev \
  --output table

# 2. Kiểm tra chi tiết trạng thái từng Add-on
aws eks describe-addon \
  --cluster-name sre-platform-dev \
  --addon-name eks-pod-identity-agent \
  --query 'addon.{Name:addonName,Version:addonVersion,Status:status}' \
  --output table

# 3. Kiểm tra các Pods hệ thống chạy trong namespace kube-system
kubectl get pods -n kube-system -o wide
```

**Kết quả mong đợi:**
- Lệnh `aws eks list-addons` trả về đủ 4 add-ons: `vpc-cni`, `kube-proxy`, `coredns`, `eks-pod-identity-agent`.
- Toàn bộ các Pods sau đang ở trạng thái `Running`:
  - `aws-node-...` (1 pod trên mỗi worker node).
  - `kube-proxy-...` (1 pod trên mỗi worker node).
  - `coredns-...` (2 pods chạy trên 2 nodes khác nhau).
  - `eks-pod-identity-agent-...` (1 pod trên mỗi worker node).

---

## 5. Chuyển giao sang IaC (Terraform Snippet)

```hcl
resource "aws_eks_addon" "vpc_cni" {
  cluster_name = aws_eks_cluster.main.name
  addon_name   = "vpc-cni"
  resolve_conflicts_on_update = "OVERWRITE"
}

resource "aws_eks_addon" "coredns" {
  cluster_name = aws_eks_cluster.main.name
  addon_name   = "coredns"
  resolve_conflicts_on_update = "OVERWRITE"
  depends_on   = [aws_eks_node_group.system]
}

resource "aws_eks_addon" "kube_proxy" {
  cluster_name = aws_eks_cluster.main.name
  addon_name   = "kube-proxy"
  resolve_conflicts_on_update = "OVERWRITE"
}

resource "aws_eks_addon" "pod_identity" {
  cluster_name = aws_eks_cluster.main.name
  addon_name   = "eks-pod-identity-agent"
  resolve_conflicts_on_update = "OVERWRITE"
}
```

---

## 6. Điều kiện hoàn thành Gate (Gate Check)

- [ ] Cả 4 add-ons (`vpc-cni`, `coredns`, `kube-proxy`, `eks-pod-identity-agent`) hiển thị trạng thái **Active** trên EKS Console.
- [ ] CoreDNS có 2 pods `Running` trên 2 AZs khác nhau.
- [ ] DaemonSet `eks-pod-identity-agent` đã sẵn sàng trên 100% worker nodes để phục vụ phân quyền IAM ở bài tiếp theo.

---

## 7. Dọn dẹp tài nguyên (Cleanup)

- Không tự ý xóa các add-ons cốt lõi (`vpc-cni`, `coredns`, `kube-proxy`) khi cluster đang hoạt động vì sẽ làm mất kết nối mạng toàn bộ pods.
- Add-ons sẽ tự động bị hủy sạch khi cluster EKS bị xóa ở quy trình teardown cuối cùng.
