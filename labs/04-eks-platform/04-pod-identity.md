# 04.04 — Cấu hình EKS Pod Identity và Kiểm chứng Cơ chế Phân quyền Hiện đại

> **Trạng thái:** Hướng dẫn thực hành chi tiết trên AWS Management Console (Console-first).  
> **Áp dụng cho:** Quản trị danh tính IAM cấp độ Pod (Workload Identity), thay thế cơ chế IRSA truyền thống.

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Hiểu rõ sự khác biệt giữa **EKS Pod Identity** (chuẩn mới từ re:Invent 2023) và **IAM Roles for Service Accounts (IRSA)** truyền thống.
  - Thiết lập mối liên kết danh tính (**Pod Identity Association**) trên EKS Console giữa một Kubernetes ServiceAccount và một AWS IAM Role.
  - Khởi tạo một Pod kiểm thử độc lập (`aws-cli-pod-identity-test`) để chứng minh Pod tự động nhận AWS Credentials tạm thời từ daemonset `eks-pod-identity-agent` mà không cần cấu hình mutating webhook hay OIDC thumbprint.
- **Nguyên tắc SRE:**
  - **Zero Long-Lived Credentials in Pods:** Pods tuyệt đối không bao giờ được chứa Access Key hay Secret Key trong environment variables hoặc ConfigMap. Mọi xác thực AWS đều phải thông qua temporary security tokens (STS).
  - **Eliminate Mutating Webhook Single Point of Failure (SPOF):** Với IRSA truyền thống, nếu kube-apiserver hoặc mutating webhook gặp lỗi, pods mới tạo sẽ không được inject token và bị crash. EKS Pod Identity sử dụng daemonset cục bộ trên từng node, loại bỏ nút thắt cổ chai webhook.
  - **Automated Session Tagging:** Pod Identity tự động gắn tags của Kubernetes (ví dụ: `eks-cluster-name`, `kubernetes-namespace`, `kubernetes-service-account`) vào phiên STS của IAM, phục vụ việc kiểm toán chi tiết trong CloudTrail.

---

## 2. So sánh IRSA vs. EKS Pod Identity

| Tiêu chí | IRSA (IAM Roles for Service Accounts) | EKS Pod Identity (Khuyến nghị) |
| :--- | :--- | :--- |
| **Cơ chế xác thực** | OIDC Provider + Web Identity Token | EKS Pod Identity Agent DaemonSet |
| **Cấu hình trên K8s** | Bắt buộc ghi annotation `eks.amazonaws.com/role-arn` | Không cần annotation, tự động map theo name |
| **Trust Policy Principal**| `Federated: arn:aws:iam::...:oidc-provider/...` | `Service: pods.eks.amazonaws.com` |
| **Khả năng dùng lại Role**| Phức tạp, phải sửa trust policy cho từng cluster | Dễ dàng, 1 Role dùng cho nhiều clusters |
| **Độ tin cậy** | Phụ thuộc Mutating Webhook | Trực tiếp qua Agent cục bộ trên Node |

---

## 3. Các bước thực hiện chi tiết trên AWS Console (Console Steps)

### Bước 1: Tạo IAM Policy Kiểm thử Đọc S3

1. Mở dịch vụ **IAM** -> Menu bên trái chọn **Policies** -> Nhấp nút cam **Create policy**.
2. Chọn tab **JSON** -> Dán policy cho phép liệt kê S3 buckets:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "AllowListS3Buckets",
         "Effect": "Allow",
         "Action": [
           "s3:ListAllMyBuckets",
           "s3:GetBucketLocation"
         ],
         "Resource": "*"
       }
     ]
   }
   ```
3. Nhấp **Next** -> Đặt tên policy: `SREPlatformPodIdentityTestPolicy`.
4. Nhấp **Create policy**.

---

### Bước 2: Tạo IAM Role với Trust Policy cho EKS Pod Identity

1. Tại menu bên trái của IAM, nhấp vào **Roles** -> Nhấp **Create role**.
2. **Select trusted entity:**
   - Chọn **Custom trust policy**.
   - Dán Trust Policy chuẩn của EKS Pod Identity:
     ```json
     {
       "Version": "2012-10-17",
       "Statement": [
         {
           "Sid": "AllowEKSPodIdentityAssumeRole",
           "Effect": "Allow",
           "Principal": {
             "Service": "pods.eks.amazonaws.com"
           },
           "Action": [
             "sts:AssumeRole",
             "sts:TagSession"
           ]
         }
       ]
     }
     ```
   - Nhấp **Next**.
3. **Add permissions:**
   - Tìm và tích chọn `SREPlatformPodIdentityTestPolicy` vừa tạo ở Bước 1.
   - Nhấp **Next**.
4. **Name, review, and create:**
   - **Role name:** Nhập `sre-platform-dev-pod-identity-test-role`.
   - **Tags:** `Environment` = `dev`, `Project` = `sre-platform`.
   - Nhấp **Create role**.

---

### Bước 3: Tạo Pod Identity Association trên EKS Console

1. Mở dịch vụ **Amazon EKS** -> Chọn cluster `sre-platform-dev`.
2. Chuyển sang tab **Access** (nằm cạnh Overview, Workloads, Compute).
3. Cuộn xuống mục **Pod Identity associations** -> Nhấp nút cam **Create Pod Identity association**.
4. **Cấu hình Association:**
   - **IAM role:** Chọn `sre-platform-dev-pod-identity-test-role`.
   - **Kubernetes namespace:** Nhập `default`.
   - **Kubernetes service account:** Nhập `sre-test-sa`.
5. Nhấp nút **Create**.
6. Xác nhận Association mới xuất hiện trong bảng với trạng thái **Active** (Màu xanh).

---

## 4. Kiểm chứng Thực tế từ Terminal (Verification)

### 4.1. Tạo ServiceAccount và Pod Kiểm thử trong Kubernetes

Từ terminal quản trị, chạy lệnh triển khai Pod kiểm thử:

```bash
# 1. Tạo ServiceAccount (Lưu ý: KHÔNG CẦN ANNOTATION NÀO)
kubectl create serviceaccount sre-test-sa -n default

# 2. Khởi chạy một Pod chứa AWS CLI sử dụng ServiceAccount trên
cat << 'EOF' | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: aws-cli-pod-identity-test
  namespace: default
spec:
  serviceAccountName: sre-test-sa
  containers:
    - name: aws-cli
      image: amazon/aws-cli:latest
      command: ["sleep", "3600"]
EOF
```

### 4.2. Kiểm tra Danh tính AWS bên trong Pod

Khi pod ở trạng thái `Running`, thực thi lệnh vào trong container:

```bash
# Kiểm tra danh tính caller hiện tại bên trong container
kubectl exec -it aws-cli-pod-identity-test -n default -- aws sts get-caller-identity
```

**Kết quả mong đợi:**
```json
{
    "UserId": "AROAXXXXXXXXXXXX:botocore-session-XXXXXXXX",
    "Account": "123456789012",
    "Arn": "arn:aws:sts::123456789012:assumed-role/sre-platform-dev-pod-identity-test-role/eks-sre-platform-dev-sre-test-sa-..."
}
```

```bash
# Thử nghiệm quyền gọi S3
kubectl exec -it aws-cli-pod-identity-test -n default -- aws s3 ls
# Kết quả: Liệt kê danh sách các S3 buckets trong tài khoản thành công!
```

---

## 5. Chuyển giao sang IaC (Terraform Snippet)

```hcl
resource "aws_eks_pod_identity_association" "test" {
  cluster_name    = aws_eks_cluster.main.name
  namespace       = "default"
  service_account = "sre-test-sa"
  role_arn        = aws_iam_role.pod_identity_test.arn
}
```

---

## 6. Điều kiện hoàn thành Gate (Gate Check)

- [ ] Pod Identity Association ở trạng thái **Active** trên EKS Console.
- [ ] Pod `aws-cli-pod-identity-test` tự động nhận credentials của role `sre-platform-dev-pod-identity-test-role`.
- [ ] Lệnh `aws sts get-caller-identity` bên trong pod xác nhận đúng IAM Role ARN.
- [ ] Nền tảng EKS sẵn sàng để áp dụng cơ chế này cho External Secrets Operator (Module 05) và AWS Load Balancer Controller.

---

## 7. Dọn dẹp tài nguyên (Cleanup)

1. Xóa pod kiểm thử: `kubectl delete pod aws-cli-pod-identity-test -n default`.
2. Xóa serviceaccount: `kubectl delete sa sre-test-sa -n default`.
3. Xóa Association trên **EKS Console** -> Tab **Access** -> Chọn association -> Nhấp **Delete**.
4. Xóa IAM Role `sre-platform-dev-pod-identity-test-role` và Policy trong IAM Console.
