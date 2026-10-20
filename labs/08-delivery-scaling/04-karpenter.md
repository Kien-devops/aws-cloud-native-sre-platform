# 08.04 — Tự động Co giãn Nút Hạ tầng Thần tốc với Karpenter v1.0+ (Just-in-Time Node Autoscaling)

> **Trạng thái:** Hướng dẫn thực hành chi tiết cấu hình Karpenter NodePool và EC2NodeClass.  
> **Áp dụng cho:** Cấp phát máy chủ EC2 theo thời gian thực (Provisioning < 45s), tối ưu hóa chi phí với Spot Instances và tự động hợp nhất nút (Node Consolidation).

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Hiểu rõ sự vượt trội của **Karpenter v1.0+** so với Kubernetes Cluster Autoscaler truyền thống (Cluster Autoscaler mất 3-5 phút và phụ thuộc Auto Scaling Group; Karpenter gọi trực tiếp AWS EC2 Fleet API và hoàn tất chỉ trong 30-45 giây).
  - Khai báo tài nguyên **`EC2NodeClass`**: Định cấu hình AMI (Amazon Linux 2023), tự động khám phá Subnets (`karpenter.sh/discovery: sre-platform-dev`) và Security Groups (`sre-platform-dev-node-sg`), mã hóa ổ cứng EBS bằng KMS CMK.
  - Khai báo tài nguyên **`NodePool`**: Định nghĩa chiến lược chọn loại máy chủ linh hoạt (Instance Types: c6i, m6i, t3; Kiến trúc: amd64), kết hợp tỷ lệ **Spot Instances** cho môi trường dev để tiết kiệm tới 70% chi phí.
  - Kích hoạt tính năng **Automated Consolidation (Hợp nhất nút tự động)**: Tự động phát hiện các nodes có mật độ tải thấp (Underutilized), di chuyển pods và terminate các nodes thừa để cắt giảm chi phí tức thời.
- **Nguyên tắc SRE:**
  - **No Over-Provisioned Standby Nodes:** Không duy trì các cụm nodes rỗng lãng phí; Karpenter chỉ khởi tạo máy chủ EC2 khi có Pod rơi vào trạng thái `Pending` do thiếu dung lượng.
  - **Right-Sizing by Pod Demands:** Karpenter tự động tính toán tổng CPU/RAM của các Pending Pods để chọn loại instance có kích cỡ vừa khít nhất (Exact-Fit Instance), tránh lãng phí RAM thừa.
  - **Graceful Node Disruption Budget:** Cấu hình `disruption.budgets` để đảm bảo trong quá trình hợp nhất nút (Consolidation) hoặc cập nhật bảo mật, số lượng nodes bị tái khởi động không vượt quá ngưỡng chịu đựng của ứng dụng.

---

## 2. So sánh Cluster Autoscaler vs. Karpenter

| Tiêu chí | Cluster Autoscaler (Truyền thống) | Karpenter v1.0+ (Hiện đại) |
| :--- | :--- | :--- |
| **Cơ chế hoạt động** | Tăng/giảm số lượng trong EC2 ASG | Gọi trực tiếp EC2 Fleet API (Bỏ qua ASG) |
| **Thời gian khởi tạo node** | 3 — 6 phút | **30 — 45 giây** |
| **Lựa chọn loại máy chủ** | Cố định theo từng Node Group của ASG | Linh hoạt từ hơn 400 loại EC2 instances |
| **Tối ưu hóa chi phí** | Thụ động, khó gom pod | Chủ động dồn pod và hủy node thừa (Consolidation) |
| **Quản trị hạ tầng** | Phải cấu hình nhiều Node Groups | 1 NodePool duy nhất bao quát toàn bộ cụm |

---

## 3. Các bước Khai báo Chi tiết (Manifest Walkthrough)

### Bước 1: Khai báo `EC2NodeClass` (Tầng Hạ tầng AWS)

Tạo file `gitops/platform/karpenter/ec2nodeclass.yaml`:

```yaml
apiVersion: karpenter.k8s.aws/v1beta1
kind: EC2NodeClass
metadata:
  name: default
spec:
  # AMI TỐI ƯU HÓA EKS
  amiFamily: AL2023
  # ROLE GẮN VÀO EC2 INSTANCE PROFILE
  role: sre-platform-dev-node-role
  # TỰ ĐỘNG KHÁM PHÁ SUBNETS BẰNG TAG ĐÃ GẮN Ở LAB 02.01
  subnetSelectorTerms:
    - tags:
        karpenter.sh/discovery: sre-platform-dev
  # TỰ ĐỘNG KHÁM PHÁ SECURITY GROUP
  securityGroupSelectorTerms:
    - tags:
        Name: sre-platform-dev-node-sg
  # CẤU HÌNH Ổ ĐĨA MÃ HÓA KMS CMK
  blockDeviceMappings:
    - deviceName: /dev/xvda
      ebs:
        volumeSize: 50Gi
        volumeType: gp3
        encrypted: true
        kmsKeyID: alias/sre-platform-dev-main
        deleteOnTermination: true
  tags:
    Environment: dev
    ManagedBy: karpenter
    Project: sre-platform
```

---

### Bước 2: Khai báo `NodePool` (Tầng Điều phối Kubernetes)

Tạo file `gitops/platform/karpenter/nodepool.yaml`:

```yaml
apiVersion: karpenter.sh/v1beta1
kind: NodePool
metadata:
  name: default
spec:
  template:
    metadata:
      labels:
        role: general-worker
    spec:
      nodeClassRef:
        name: default
      # TIÊU CHÍ CHỌN LOẠI MÁY CHỦ LINH HOẠT
      requirements:
        - key: karpenter.sh/capacity-type
          operator: In
          values: ["spot", "on-demand"] # Ưu tiên Spot rẻ hơn cho dev
        - key: kubernetes.io/arch
          operator: In
          values: ["amd64"]
        - key: karpenter.k8s.aws/instance-category
          operator: In
          values: ["c", "m", "t"]
        - key: karpenter.k8s.aws/instance-generation
          operator: Gt
          values: ["2"]
  # CHÍNH SÁCH TỰ ĐỘNG HỢP NHẤT VÀ TIẾT KIỆM CHI PHÍ
  disruption:
    consolidationPolicy: WhenUnderutilized
    expireAfter: 720h # 30 ngày tự động thay thế node mới
    budgets:
      - nodes: "20%" # Không tái khởi động quá 20% nodes cùng lúc
  # GIỚI HẠN TRẦN TÀI NGUYÊN (FINOPS SAFETY CEILING)
  limits:
    cpu: "20"
    memory: 40Gi
```

Áp dụng vào cluster:
```bash
kubectl apply -f gitops/platform/karpenter/ec2nodeclass.yaml
kubectl apply -f gitops/platform/karpenter/nodepool.yaml
```

---

## 4. Xác minh và Diễn tập Co giãn Thần tốc (Verification Drill)

### 4.1. Kiểm tra trạng thái Karpenter
```bash
# 1. Kiểm tra NodePool
kubectl get nodepool

# 2. Kiểm tra EC2NodeClass
kubectl get ec2nodeclass

# 3. Xem số lượng worker nodes hiện tại (Mặc định: 2 nodes từ bài 04.02)
kubectl get nodes
```

### 4.2. Diễn tập Tải Khủng: Tạo 10 Pods Yêu cầu Lớn (Pending Pods)
Tạo một deployment thử nghiệm yêu cầu tài nguyên vượt quá dung lượng hiện có của 2 nodes:

```bash
cat << 'EOF' | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: karpenter-capacity-test
  namespace: default
spec:
  replicas: 6
  selector:
    matchLabels:
      app: capacity-test
  template:
    metadata:
      labels:
        app: capacity-test
    spec:
      containers:
        - name: stress
          image: public.ecr.aws/docker/library/busybox:latest
          command: ["sleep", "600"]
          resources:
            requests:
              cpu: "1000m" # Mỗi pod cần 1 full vCPU
              memory: "1Gi"
EOF
```

### 4.3. Quan sát Karpenter Phản ứng trong Thời gian thực
Mở đồng hồ bấm giờ và quan sát log của Karpenter Controller:

```bash
kubectl logs -n kube-system -l app.kubernetes.io/name=karpenter -c controller -f
```

**Tiến trình diễn ra trong thực tế:**
1. Giây 0: 6 Pods rơi vào trạng thái `Pending` do cluster thiếu 6 vCPUs.
2. Giây 2: Karpenter phát hiện 6 pending pods, tính toán tổng nhu cầu: 6 vCPU + 6 GiB RAM.
3. Giây 5: Karpenter gọi EC2 Fleet API yêu cầu một instance loại `c6i.2xlarge` (hoặc `c5.2xlarge` Spot) để chứa trọn vẹn 6 pods.
4. Giây 35: Máy chủ EC2 mới hoàn tất khởi động và gia nhập cluster!
5. Giây 42: Lệnh `kubectl get nodes` hiển thị node mới có trạng thái `Ready`.
6. Giây 45: Toàn bộ 6 Pods chuyển từ `Pending` sang **Running**!

---

### 4.4. Diễn tập Hợp nhất Nút Tự động (Node Consolidation)

Xóa deployment thử nghiệm:
```bash
kubectl delete deployment karpenter-capacity-test -n default
```

Quan sát log của Karpenter:
- Karpenter phát hiện node mới vừa tạo không còn pod nào chạy (`Node is empty`).
- Sau khoảng 30 giây, Karpenter tự động gọi AWS EC2 API và **hủy bỏ máy chủ thừa** (Terminate Instance).
- Số lượng nodes trong cluster trở về đúng 2 nodes ban đầu, tiết kiệm chi phí tuyệt đối!

---

## 5. Điều kiện hoàn thành Gate (Gate Check)

- [ ] `NodePool` và `EC2NodeClass` ở trạng thái `Ready`.
- [ ] Thời gian từ lúc Pod bị `Pending` đến khi Node mới `Ready` đạt mốc **dưới 60 giây**.
- [ ] Tính năng tự động dọn dẹp node rỗng (Consolidation) hoạt động hoàn hảo.
- [ ] Giới hạn trần tài nguyên (Limits: 20 CPUs) được kích hoạt an toàn.

---

## 6. Dọn dẹp tài nguyên (Cleanup)

- Duy trì cấu hình Karpenter để hỗ trợ tự động mở rộng cụm máy chủ trong bài kiểm thử GameDay ở Module 09.
