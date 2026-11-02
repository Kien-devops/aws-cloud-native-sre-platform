# 05.02b — Handoff External Secrets Operator (ESO) & Pod Identity

> **Trạng thái:** Hướng dẫn thực hành phân quyền AWS Console kết hợp chuyển giao GitOps (Handoff).  
> **Áp dụng cho:** Cấu hình IAM Role, EKS Pod Identity và khai báo manifest đồng bộ secret từ AWS Secrets Manager vào Kubernetes Secrets.

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Tạo IAM Role phân quyền tối thiểu (Least Privilege) trên AWS Console cho phép **External Secrets Operator (ESO)** truy cập AWS Secrets Manager và giải mã với KMS.
  - Liên kết IAM Role với ServiceAccount của ESO thông qua cơ chế **EKS Pod Identity** hiện đại (thay thế IRSA truyền thống).
  - Khai báo tài nguyên GitOps Kubernetes (`ClusterSecretStore` và `ExternalSecret`) để đồng bộ secret một cách tự động, an toàn và có kiểm soát.
- **Nguyên tắc SRE:**
  - **No Manual K8s Secrets:** Không tạo Kubernetes Secret thủ công bằng `kubectl create secret` (vì dễ lộ trong shell history và không lưu trữ an toàn trong etcd).
  - **Reconciliation & Drift Detection:** ESO định kỳ đồng bộ (refreshInterval: 1h) để đảm bảo Kubernetes Secret luôn phản ánh chính xác cấu hình từ Secrets Manager.
  - **Audit Trail:** Mọi thao tác đồng bộ từ ESO đều để lại dấu vết rõ ràng trong CloudTrail và Controller Logs.

---

## 2. Thông số đầu vào (Input Parameters)

| Tham số | Giá trị mẫu / Quy ước | Ý nghĩa |
| :--- | :--- | :--- |
| **AWS Region** | `ap-southeast-1` | Region chứa Secrets Manager và EKS Cluster |
| **EKS Cluster Name** | `sre-platform-dev` | Tên EKS Cluster đã dựng ở Lab 04 |
| **IAM Policy Name** | `SREPlatformESOPermissions` | Chính sách IAM cấp quyền đọc Secret và giải mã KMS |
| **IAM Role Name** | `sre-platform-dev-eso-role` | Role dành cho ESO Pod Identity |
| **Kubernetes Namespace** | `external-secrets` | Namespace cài đặt ESO Helm chart / GitOps |
| **Kubernetes ServiceAccount** | `external-secrets-sa` | ServiceAccount của ESO Controller |
| **App Namespace** | `reliability-shop` | Namespace chứa workload microservices tiêu thụ secret |

---

## 3. Các bước thực hiện chi tiết trên AWS Console (Console Steps)

### Bước 1: Tạo IAM Policy cho External Secrets Operator

1. Đăng nhập **AWS Console** -> Tìm kiếm `IAM` -> Chọn **IAM**.
2. Tại menu bên trái, nhấp vào **Policies** -> Nhấp nút cam **Create policy**.
3. Tại ô **Policy editor**, chuyển sang tab **JSON**.
4. Dán nội dung policy sau (đảm bảo thay thế `<ACCOUNT_ID>` và `<REGION>` bằng thông tin thực tế):
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "AllowReadSecretsManager",
         "Effect": "Allow",
         "Action": [
           "secretsmanager:GetResourcePolicy",
           "secretsmanager:GetSecretValue",
           "secretsmanager:DescribeSecret",
           "secretsmanager:ListSecretVersionIds"
         ],
         "Resource": [
           "arn:aws:secretsmanager:ap-southeast-1:<ACCOUNT_ID>:secret:/sre-platform/dev/reliability-shop/*"
         ]
       },
       {
         "Sid": "AllowKMSDecrypt",
         "Effect": "Allow",
         "Action": [
           "kms:Decrypt",
           "kms:DescribeKey"
         ],
         "Resource": [
           "arn:aws:kms:ap-southeast-1:<ACCOUNT_ID>:alias/sre-platform-dev-secrets",
           "arn:aws:kms:ap-southeast-1:<ACCOUNT_ID>:key/*"
         ]
       }
     ]
   }
   ```
   > [!NOTE]
   > Policy trên áp dụng nguyên tắc **Least Privilege** tuyệt đối: chỉ cho phép đọc các secret nằm dưới path `/sre-platform/dev/reliability-shop/*` và chỉ cho phép decrypt bằng đúng KMS key của dev.
5. Nhấp **Next**.
6. **Policy name:** Nhập `SREPlatformESOPermissions`.
7. **Description:** `Least privilege policy for External Secrets Operator to sync dev secrets`.
8. Nhấp **Create policy**.

---

### Bước 2: Tạo IAM Role với Trust Relationship cho EKS Pod Identity

1. Tại menu bên trái của IAM, nhấp vào **Roles** -> Nhấp nút cam **Create role**.
2. **Select trusted entity**:
   - Chọn **Custom trust policy**.
   - Dán nội dung Trust Policy cho **EKS Pod Identity**:
     ```json
     {
       "Version": "2012-10-17",
       "Statement": [
         {
           "Sid": "AllowEKSPodIdentity",
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
3. **Add permissions**:
   - Tìm kiếm policy vừa tạo ở Bước 1: `SREPlatformESOPermissions`.
   - Tích chọn checkbox cạnh policy.
   - Nhấp **Next**.
4. **Name, review, and create**:
   - **Role name:** Nhập `sre-platform-dev-eso-role`.
   - **Description:** `IAM Role for External Secrets Operator via EKS Pod Identity`.
   - **Tags:** `Environment` = `dev`, `Project` = `sre-platform`.
   - Nhấp **Create role**.

---

### Bước 3: Tạo Pod Identity Association trên EKS Console

1. Vào ô tìm kiếm Console -> Nhập `EKS` -> Chọn **Amazon Elastic Kubernetes Service**.
2. Nhấp vào tên cluster: `sre-platform-dev`.
3. Chuyển sang tab **Access** (nằm cạnh Overview, Workloads, Configuration).
4. Kéo xuống mục **Pod Identity associations** -> Nhấp nút **Create Pod Identity association**.
5. Cấu hình các mục sau:
   - **IAM role:** Chọn role vừa tạo: `sre-platform-dev-eso-role`.
   - **Kubernetes namespace:** Nhập `external-secrets`.
   - **Kubernetes service account:** Nhập `external-secrets-sa`.
6. Nhấp **Create**.
7. Chờ trạng thái của Association hiển thị **Active**.

---

## 4. Chuyển giao sang GitOps (GitOps Manifests Handoff)

Sau khi hạ tầng AWS Console đã sẵn sàng, các manifest Kubernetes sau được bàn giao cho GitOps (Argo CD) quản lý:

### 4.1. Khởi tạo `ClusterSecretStore` (`gitops/platform/external-secrets/cluster-secret-store.yaml`)

```yaml
apiVersion: external-secrets.io/v1
kind: ClusterSecretStore
metadata:
  name: aws-secretsmanager-dev
spec:
  provider:
    aws:
      service: SecretsManager
      region: ap-southeast-1
      # Với EKS Pod Identity, biến môi trường AWS_CONTAINER_CREDENTIALS_FULL_URI được inject tự động,
      # AWS SDK tự động suy diễn thông tin xác thực từ môi trường mà không cần cấu hình auth block.
```

### 4.2. Khởi tạo `ExternalSecret` (`gitops/applications/reliability-shop/base/external-secret.yaml`)

```yaml
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata:
  name: reliability-shop-credentials
  namespace: reliability-shop
spec:
  refreshInterval: 1h # Tự động kiểm tra và cập nhật secret sau mỗi 1 giờ
  secretStoreRef:
    name: aws-secretsmanager-dev
    kind: ClusterSecretStore
  target:
    name: app-credentials # Tên Kubernetes Secret đích được tạo ra
    creationPolicy: Owner
  dataFrom:
    - extract:
        key: /sre-platform/dev/reliability-shop/credentials # Tên Secret trên AWS
```

---

## 5. Xác minh (Verification)

Sau khi Argo CD đồng bộ manifest vào cluster, thực hiện xác minh từ dòng lệnh quản trị:

```bash
# 1. Kiểm tra trạng thái ClusterSecretStore
kubectl get clustersecretstore aws-secretsmanager-dev

# 2. Kiểm tra trạng thái ExternalSecret
kubectl get externalsecret -n reliability-shop

# 3. Xác nhận Kubernetes Secret đã được tự động sinh ra
kubectl get secret app-credentials -n reliability-shop

# 4. Kiểm tra các keys có trong secret (KHÔNG in giá trị plaintext)
kubectl get secret app-credentials -n reliability-shop -o jsonpath='{.data}' | jq 'keys'
```

**Kết quả mong đợi:**
- `ClusterSecretStore` hiển thị `STATUS: Valid`.
- `ExternalSecret` hiển thị `READY: True`, `STATUS: SecretSynced`.
- Các key xuất hiện đầy đủ: `["DB_NAME", "DB_PASSWORD", "DB_USER", "JWT_SECRET", "REDIS_AUTH"]`.

---

## 6. SRE Gate & Khắc phục sự cố (Troubleshooting)

### Gate Check
- [ ] IAM Policy giới hạn đúng path `/sre-platform/dev/reliability-shop/*`.
- [ ] EKS Pod Identity Association ở trạng thái `Active`.
- [ ] Kubernetes Secret đích (`app-credentials`) được tự động tạo bởi ESO và sẵn sàng cho pods mount.
- [ ] Không có secret plaintext nào được lưu trong kho Git repository.

### Khắc phục sự cố thường gặp (Troubleshooting)
1. **Lỗi `AccessDeniedException` trong ESO Controller log:**
   - Kiểm tra xem EKS Cluster Add-on `eks-pod-identity-agent` đã cài đặt và đang chạy Healthy hay chưa.
   - Kiểm tra Trust Policy của IAM Role: Principal phải là `pods.eks.amazonaws.com`.
2. **Lỗi `KMS.AccessDeniedException`:**
   - Kiểm tra Key Policy của KMS CMK `alias/sre-platform-dev-secrets`: đảm bảo cho phép Role `sre-platform-dev-eso-role` thực hiện action `kms:Decrypt`.

---

## 7. Dọn dẹp tài nguyên (Cleanup)

1. Xóa Pod Identity Association:
   - Vào **EKS Console** -> Cluster `sre-platform-dev` -> Tab **Access** -> Chọn association của ESO -> Nhấp **Delete**.
2. Xóa IAM Role và Policy:
   - Vào **IAM Console** -> **Roles** -> Xóa `sre-platform-dev-eso-role`.
   - Vào **IAM Console** -> **Policies** -> Xóa `SREPlatformESOPermissions`.
