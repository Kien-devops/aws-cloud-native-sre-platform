# 04.05 — Kiểm chứng Sức khỏe Toàn diện Nền tảng Amazon EKS (Platform Health Gate)

> **Trạng thái:** Hướng dẫn thực hành chi tiết trên AWS Management Console và Kubernetes CLI.  
> **Áp dụng cho:** Đánh giá sức khỏe hạ tầng, kiểm tra phân bổ mạng đa AZ, đo lường độ trễ DNS và nghiệm thu Gate Phase 04 trước khi bàn giao cho GitOps.

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Thực hiện bài kiểm tra toàn diện (**Pre-flight Health Check**) trên cả 3 tầng: Tầng điều khiển (EKS Control Plane), Tầng máy chủ công nhân (Worker Nodes), và Tầng dịch vụ lõi (Core Add-ons: CoreDNS, VPC CNI, Pod Identity).
  - Xác minh rằng địa chỉ IP cấp phát cho Pods hoàn toàn thuộc dải Private App Subnets (`10.0.10.0/24` và `10.0.11.0/24`), không rò rỉ ra ngoài.
  - Kiểm tra khả năng chịu lỗi phân tán: Chứng minh các Pods CoreDNS và các ứng dụng mẫu phân bổ đều trên **2 Availability Zones khác nhau** (`Topology Spread`).
  - Đo lường các chỉ số vàng của hạ tầng: Node Resource Saturation (CPU/RAM headroom), Kubernetes API Server Latency, và DNS lookup latency (< 5ms).
- **Nguyên tắc SRE:**
  - **Do Not Deploy Workloads to an Unhealthy Cluster:** Tuyệt đối không bàn giao cluster cho đội ngũ ứng dụng hoặc GitOps nếu các chỉ số lõi của Kubernetes chưa được xác nhận `Healthy` bằng số liệu đo đạc thực tế.
  - **Noise-Free Control Plane:** Kiểm tra CloudWatch Logs của EKS Control Plane để đảm bảo không có vòng lặp lỗi (Error Loops) hoặc cảnh báo nghẽn bộ nhớ từ `kube-apiserver` hay `kube-scheduler`.
  - **Evidence-Based Gate Sign-Off:** Lưu lại bằng chứng đo đạc đầy đủ có dấu thời gian (Timestamp) vào hồ sơ nghiệm thu.

---

## 2. Tiêu chí Đánh giá Sức khỏe Nền tảng (Platform Health Matrix)

| Thành phần | Chỉ số kiểm tra | Trạng thái Mong đợi (Expected) |
| :--- | :--- | :--- |
| **Control Plane** | Trạng thái EKS Cluster | `Active` trên AWS Console |
| **Worker Nodes** | Trạng thái Nodes | `Ready` (100% nodes), không có Pressure |
| **Multi-AZ Spread** | Phân bổ Nodes trên AZs | Tối thiểu 1 node tại `ap-southeast-1a`, 1 node tại `ap-southeast-1b` |
| **VPC CNI Network** | Cấp phát IP cho Pods | Thuộc dải `10.0.10.x` hoặc `10.0.11.x` |
| **CoreDNS** | Replicas & Phân tán | 2/2 Pods `Running`, nằm trên 2 nodes khác nhau |
| **DNS Resolution** | Thời gian phân giải domain | Lookup thời gian `< 5ms` |
| **Pod Identity** | Agent DaemonSet | 2/2 Pods `Running` trên 100% worker nodes |

---

## 3. Các bước thực hiện chi tiết trên AWS Console (Console Steps)

### Bước 1: Kiểm tra Trạng thái Tổng quan trên EKS Console

1. Đăng nhập vào **AWS Console**, chọn Region `ap-southeast-1`.
2. Mở dịch vụ **Amazon EKS** -> Chọn cluster `sre-platform-dev`.
3. Tại tab **Overview**:
   - **Status:** Xác nhận là **Active** (Màu xanh).
   - **Kubernetes version:** `1.30`.
   - **API server endpoint:** URL hiển thị hợp lệ.
4. Chuyển sang tab **Compute**:
   - **Node groups:** `sre-platform-dev-system-nodes` hiển thị **Active**, `2 nodes`.
5. Chuyển sang tab **Add-ons**:
   - Xác nhận 4 add-ons (`vpc-cni`, `coredns`, `kube-proxy`, `eks-pod-identity-agent`) đều có trạng thái **Active**.

---

### Bước 2: Kiểm tra Chỉ số Hiệu năng trên AWS CloudWatch Metrics

1. Nhập `CloudWatch` vào thanh tìm kiếm Console -> Chọn **CloudWatch**.
2. Tại menu bên trái, nhấp vào **Metrics** -> **All metrics**.
3. Chọn namespace **AWS/EKS** (hoặc kiểm tra Container Insights nếu đã bật):
   - Kiểm tra **cluster_failed_node_count**: Bắt buộc bằng `0`.
   - Kiểm tra số lượng node active: Bằng `2`.
4. Chuyển sang mục **Logs** -> **Log groups** -> Chọn `/aws/eks/sre-platform-dev/cluster`:
   - Mở log stream `kube-apiserver-...`.
   - Xác nhận các request trả về HTTP code `200` và `201`, không có lỗi sập kết nối liên tục.

---

## 4. Kịch bản Kiểm chứng Kỹ thuật từ Terminal (CLI Validation)

Thực thi bộ script kiểm tra sức khỏe toàn diện sau từ máy trạm quản trị:

```bash
# 1. Kiểm tra tình trạng sức khỏe của toàn bộ Worker Nodes
kubectl get nodes -o custom-columns=NAME:.metadata.name,STATUS:.status.conditions[-1].type,REASON:.status.conditions[-1].reason,MEM_PRESSURE:.status.conditions[0].status,DISK_PRESSURE:.status.conditions[1].status

# 2. Kiểm tra sự phân bổ Multi-AZ của CoreDNS (Anti-Affinity Test)
kubectl get pods -n kube-system -l k8s-app=kube-dns -o wide

# 3. Chạy một bài test phân giải DNS và kết nối mạng nội bộ
kubectl run dns-health-test --rm -i --tty --image=busybox:1.36 --restart=Never -- nslookup kubernetes.default.svc.cluster.local
```

**Kết quả mong đợi:**
- Lệnh 1: Toàn bộ nodes có `STATUS = Ready`, `MEM_PRESSURE = False`, `DISK_PRESSURE = False`.
- Lệnh 2: 2 Pods của `coredns` được điều phối lên **2 IP node khác nhau** (chứng minh tính sẵn sàng cao khi một node gặp sự cố).
- Lệnh 3: `nslookup` trả về địa chỉ IP của Kubernetes API Service (ví dụ: `172.20.0.1` hoặc `10.100.0.1`) trong vòng vài mili-giây mà không bị timeout.

---

## 5. Mẫu Báo cáo Nghiệm thu Sức khỏe Nền tảng (Platform Health Sign-off)

Lưu lại nội dung sau vào hồ sơ `labs/04-eks-platform/evidence/health-report.txt`:

```text
=== EKS PLATFORM HEALTH AUDIT REPORT ===
Cluster Name:          sre-platform-dev
Region:                ap-southeast-1
Kubernetes Version:    1.30.2
Control Plane Status:  ACTIVE (Multi-AZ ENI in Private Subnets)
Worker Nodes Count:    2/2 READY
Availability Zones:    ap-southeast-1a (1 node), ap-southeast-1b (1 node)
Core Add-ons:          vpc-cni (Active), coredns (Active), kube-proxy (Active), eks-pod-identity-agent (Active)
Pod IP Subnet Check:   PASSED (All pods receive 10.0.10.x / 10.0.11.x IPs)
CoreDNS High-Avail:    PASSED (2 pods spread across 2 independent nodes)
Internal DNS Lookup:   PASSED (< 3ms response time)
Audit Logging:         ACTIVE (Streaming to CloudWatch Logs)
etcd KMS Encryption:   ACTIVE (Key: alias/sre-platform-dev-main)
Gate Decision:         APPROVED FOR GITOPS HANDOFF (Phase 06)
```

---

## 6. Điều kiện hoàn thành Gate (Gate Check)

- [ ] Control Plane và Node Groups hoạt động ổn định không có lỗi cảnh báo.
- [ ] Các Pods hệ thống chạy trên 2 Availability Zones khác nhau.
- [ ] Bài test phân giải tên miền DNS nội bộ cluster thành công.
- [ ] Báo cáo nghiệm thu Platform Health Sign-off được ký duyệt.
- [ ] Sẵn sàng bàn giao hạ tầng cho Phase 05 (Secrets & Ingress) và Phase 06 (GitOps Argo CD).
