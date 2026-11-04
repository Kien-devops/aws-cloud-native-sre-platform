# Lab 10.05: Reverse Dependency Cleanup Order

## 1. Mục tiêu & Nguyên lý SRE

Lab này hướng dẫn quy trình giải phóng và dọn dẹp toàn bộ tài nguyên của nền tảng Cloud-Native SRE theo **thứ tự phụ thuộc ngược (Reverse Dependency Order)**. Khi cần hủy môi trường thử nghiệm `dev` hoặc decommission một cụm hạ tầng, việc xóa sai thứ tự sẽ dẫn đến tài nguyên bị kẹt (Resource Lock), xóa thất bại do phụ thuộc vòng (Dependency Deadlock), hoặc để sót các tài nguyên ẩn tiếp tục bị tính phí (Cost Leakage: Orphaned ALBs, EIPs, ENIs, EBS Volumes).

```
+---------------------------------------------------------------------------------------------------------+
|                                  STRICT REVERSE DEPENDENCY CLEANUP PIPELINE                             |
+---------------------------------------------------------------------------------------------------------+
|  STEP 1: INGRESS & K8S APPS   ===>  STEP 2: EKS NODES & CLUSTER   ===>  STEP 3: STATEFUL DATA STORES   |
|  - Delete Ingress (ALB tear)        - Cordon/Drain Worker Nodes         - Take Final DB Snapshot        |
|  - Delete ReliabilityShop Apps      - Delete Karpenter NodePools        - Delete RDS Postgres & Redis   |
|  - Uninstall Platform Helm/Argo     - Delete EKS Cluster & Add-ons      - Purge SQS Queues & ECR Images |
+---------------------------------------------------------------------------------------------------------+
                                                     |
                                                     v
+---------------------------------------------------------------------------------------------------------+
|  STEP 4: VPC & NETWORK INFRASTRUCTURE                             STEP 5: KMS & SECRETS GOVERNANCE      |
|  - Delete VPC Endpoints (S3, ECR, Secrets)                       - Schedule Secrets Manager Deletion    |
|  - Delete NAT Gateway & Release Elastic IP                       - Schedule KMS CMK Key Deletion (7-day)|
|  - Detach IGW, Delete Route Tables, SGs, VPC                     - Purge CloudWatch Log Groups          |
+---------------------------------------------------------------------------------------------------------+
```

### Nguyên lý SRE cốt lõi:
- **Clean Ingress Before Cluster:** Luôn luôn xóa đối tượng `Ingress` trong Kubernetes trước để AWS Load Balancer Controller có cơ hội dọn dẹp Application Load Balancer và Target Groups trên AWS. Nếu xóa cluster trước, ALB sẽ trở thành "tài nguyên mồ côi" (Orphaned ALB) liên tục trừ tiền mỗi giờ.
- **Consumer Before Producer / Workload Before Storage:** Tắt ứng dụng tiêu thụ trước khi xóa Queue/Database để tránh lỗi phát sinh và mất dữ liệu dở dang.
- **Safe Preservation of Persistent Data:** Không bao giờ force-delete cơ sở dữ liệu sản xuất mà không tạo bản sao lưu cuối cùng (Final Snapshot).
- **Zero Orphan Guarantee:** Thực thi script săn lùng tài nguyên mồ côi (Orphan Hunter) để đảm bảo không còn bất kỳ ENI, EIP, EBS volume hay ALB nào lẩn khuất sau khi hoàn tất.

---

## 2. Thứ tự dọn dẹp chi tiết 7 bước (Step-by-Step Console Walkthrough)

### Bước 1: Dọn dẹp Ingress và Ứng dụng Kubernetes
> [!CRITICAL]
> Phải xóa Ingress từ bên trong Kubernetes trước để AWS Load Balancer Controller phát lệnh gọi AWS API hủy Application Load Balancer tương ứng.

1. Chạy lệnh xóa toàn bộ namespace ứng dụng:
   ```bash
   # Xóa Ingress trước tiên
   kubectl delete ingress reliability-shop-ingress -n reliability-shop
   
   # Chờ AWS Load Balancer Controller dọn xong ALB (theo dõi trên Console: EC2 > Load Balancers)
   kubectl delete namespace reliability-shop
   ```
2. Xác nhận trên AWS Console:
   - Vào **EC2 > Load Balancers**: Đảm bảo ALB có tiền tố `k8s-reliabil-ordering` đã chuyển sang trạng thái `deleting` và biến mất.
   - Vào **EC2 > Target Groups**: Đảm bảo các Target Group tương ứng đã bị hủy bỏ.

### Bước 2: Dọn dẹp Argo CD & Platform Controllers
1. Gỡ bỏ các ứng dụng quản lý nền tảng:
   ```bash
   kubectl delete -f gitops/bootstrap/root-application.yaml
   kubectl delete namespace observability
   kubectl delete namespace external-secrets
   kubectl delete namespace kube-system -l app.kubernetes.io/name=aws-load-balancer-controller
   kubectl delete namespace argocd
   ```

### Bước 3: Dọn dẹp EKS Worker Nodes & Cluster
1. Dọn dẹp tài nguyên do Karpenter tạo ra:
   ```bash
   kubectl delete nodepools --all
   kubectl delete ec2nodeclasses --all
   ```
2. Mở AWS Console: **Amazon EKS > Clusters > `sre-platform-dev-cluster`**.
3. Vào tab **Compute**:
   - Chọn Node Group `sre-platform-dev-system-nodes` và nhấp nút **Delete**.
   - Nhập tên Node Group để xác nhận. Chờ quá trình giải phóng EC2 Instances và unattach EBS volumes hoàn tất (~5 phút).
4. Sau khi Node Group đã bị xóa hoàn toàn, quay lại đầu trang EKS Cluster:
   - Nhấp nút **Delete cluster**.
   - Xác nhận bằng cách nhập tên `sre-platform-dev-cluster`.
   - Chờ cluster chuyển từ `DELETING` sang biến mất hoàn toàn (~10 phút).

### Bước 4: Dọn dẹp các kho lưu trữ dữ liệu (Data Stores)
1. **RDS PostgreSQL:**
   - Mở Console: **RDS > Databases > `sre-platform-dev-pg`**.
   - Chọn **Actions > Delete**.
   - Bỏ chọn *Create final snapshot?* (nếu đây là môi trường test thuần túy) HOẶC tick chọn và đặt tên `sre-platform-dev-pg-final-snapshot-20261021` (nếu cần bảo toàn bằng chứng nghiệm thu).
   - Bỏ chọn *Retain automated backups*.
   - Gõ `delete me` để xác nhận xóa.
   - Sau khi DB xóa xong, vào **Subnet groups** xóa `sre-platform-dev-database-subnet-group`.
2. **ElastiCache Redis:**
   - Mở Console: **ElastiCache > Redis clusters > `sre-platform-dev-redis-001`**.
   - Chọn cluster và nhấp **Delete**.
   - Không cần tạo final backup.
   - Xóa Subnet group `sre-platform-dev-redis-subnet-group`.
3. **Amazon SQS:**
   - Mở Console: **Simple Queue Service (SQS)**.
   - Chọn `reliability-shop-dev-order-queue` và `reliability-shop-dev-order-dlq`.
   - Nhấp **Delete** và xác nhận.
4. **Amazon ECR:**
   - Mở Console: **Elastic Container Registry > Repositories**.
   - Chọn các repo `order-service`, `inventory-service`, `payment-worker`.
   - Chọn **Delete** > Tick chọn *Delete all images contained in repository* > Xác nhận xóa.

### Bước 5: Dọn dẹp Mạng VPC & Cổng kết nối (Networking)
> [!WARNING]
> Nếu xóa VPC ngay lập tức sẽ bị lỗi `DependencyViolation` do các ENI phụ thuộc chưa được giải phóng. Phải làm tuần tự:

1. **Xóa VPC Endpoints:**
   - Mở **VPC > Endpoints**.
   - Chọn S3 Gateway Endpoint (`com.amazonaws.ap-southeast-1.s3`) thuộc `sre-platform-dev-vpc`.
   - Nhấp **Actions > Delete VPC endpoints**.
2. **Xóa NAT Gateway:**
   - Mở **VPC > NAT Gateways > `sre-platform-dev-nat-gw-1a`**.
   - Nhấp **Actions > Delete NAT gateway**.
   - Chờ NAT Gateway chuyển từ `Deleting` sang `Deleted` (khoảng 3 phút).
3. **Giải phóng Elastic IP (EIP):**
   - Mở **EC2 > Elastic IPs**.
   - Sau khi NAT Gateway xóa xong, chọn EIP của NAT Gateway.
   - Nhấp **Actions > Release Elastic IP addresses** (Tránh bị tính phí $0.005/giờ cho IP không sử dụng!).
4. **Tách và Xóa Internet Gateway (IGW):**
   - Mở **VPC > Internet Gateways > `sre-platform-dev-igw`**.
   - Chọn **Actions > Detach from VPC** > Xác nhận.
   - Chọn **Actions > Delete internet gateway** > Xác nhận.
5. **Xóa Subnets và Route Tables:**
   - Mở **VPC > Route Tables**: Xóa các custom route table liên kết với public/private subnets.
   - Mở **VPC > Subnets**: Chọn tất cả 6 subnets thuộc VPC và nhấp **Actions > Delete subnet**.
6. **Xóa Security Groups & VPC:**
   - Mở **VPC > Security Groups**: Xóa các custom Security Groups (`alb-sg`, `node-sg`, `db-sg`).
   - Mở **VPC > Your VPCs > `sre-platform-dev-vpc`**.
   - Nhấp **Actions > Delete VPC** > Nhập `delete` để xác nhận.

### Bước 6: Dọn dẹp Bảo mật & Khóa KMS
1. **Secrets Manager:**
   - Mở **Secrets Manager > Secrets > `/sre-platform/dev/reliability-shop/credentials`**.
   - Chọn **Actions > Delete secret**.
   - Chọn thời gian chờ phục hồi (Recovery window) tối thiểu: `7 days` (AWS không cho phép xóa ngay lập tức vì lý do an toàn).
2. **AWS KMS:**
   - Mở **Key Management Service (KMS) > Customer managed keys**.
   - Chọn khóa có alias `alias/sre-platform-dev-main`.
   - Chọn **Key actions > Schedule key deletion**.
   - Đặt thời gian chờ: `7 days` > Xác nhận.

---

## 3. Kịch bản tự động hóa quét tài nguyên mồ côi (Orphan Leak Hunter)

Sau khi hoàn tất quy trình xóa, thực thi script Bash sau để rà soát toàn bộ tài khoản tại Region `ap-southeast-1`:

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "============================================================"
echo "      RUNNING SRE ORPHAN & COST LEAK HUNTER (ap-southeast-1)"
echo "============================================================"

# 1. Kiểm tra Elastic IPs chưa liên kết
ORPHAN_EIPS=$(aws ec2 describe-addresses \
  --region ap-southeast-1 \
  --query "Addresses[?AssociationId==null].[PublicIp,AllocationId]" \
  --output text)

if [ -n "${ORPHAN_EIPS}" ]; then
  echo "::warning::Phát hiện Elastic IPs mồ côi (đang bị tính phí $0.005/h):"
  echo "${ORPHAN_EIPS}"
else
  echo "[OK] Không có Elastic IP mồ côi."
fi

# 2. Kiểm tra EBS Volumes ở trạng thái available (chưa unattach/chưa xóa)
ORPHAN_VOLUMES=$(aws ec2 describe-volumes \
  --region ap-southeast-1 \
  --filters Name=status,Values=available \
  --query "Volumes[].[VolumeId,Size,CreateTime]" \
  --output text)

if [ -n "${ORPHAN_VOLUMES}" ]; then
  echo "::warning::Phát hiện EBS Volumes mồ côi (đang bị tính phí gp3):"
  echo "${ORPHAN_VOLUMES}"
else
  echo "[OK] Không có EBS Volume mồ côi."
fi

# 3. Kiểm tra Load Balancers còn sót
LINGERING_ALB=$(aws elbv2 describe-load-balancers \
  --region ap-southeast-1 \
  --query "LoadBalancers[?contains(LoadBalancerName, 'k8s')].[LoadBalancerName,DNSName]" \
  --output text)

if [ -n "${LINGERING_ALB}" ]; then
  echo "::error::CẢNH BÁO: Còn Application Load Balancer sót lại:"
  echo "${LINGERING_ALB}"
else
  echo "[OK] Không còn Application Load Balancer nào."
fi

# 4. Kiểm tra NAT Gateways chưa xóa
LINGERING_NAT=$(aws ec2 describe-nat-gateways \
  --region ap-southeast-1 \
  --filter "Name=state,Values=pending,available" \
  --query "NatGateways[].[NatGatewayId,VpcId,State]" \
  --output text)

if [ -n "${LINGERING_NAT}" ]; then
  echo "::error::CẢNH BÁO: Còn NAT Gateway đang hoạt động:"
  echo "${LINGERING_NAT}"
else
  echo "[OK] Không còn NAT Gateway nào."
fi

echo "============================================================"
echo "      KIỂM TRA HOÀN TẤT - BÁO CÁO SẴN SÀNG CHO COST AUDIT"
echo "============================================================"
```

---

## 4. SRE Gate Check & Tiêu chí nghiệm thu

| STT | Hạng mục kiểm tra (Gate Criteria) | Điều kiện đạt (Pass Criteria) | Trạng thái |
| :--- | :--- | :--- | :--- |
| 1 | **ALB Ingress Graceful Cleanup** | ALB và Target Group tự động hủy trước khi cụm EKS bị xóa | [x] Đạt quy trình |
| 2 | **Final DB Snapshot Created** | Snapshot cơ sở dữ liệu `sre-platform-dev-pg-final-snapshot-*` được lưu trữ an toàn | [x] Đạt quy trình |
| 3 | **Zero Unattached EIPs** | Không còn Elastic IP nào tồn tại ở trạng thái không gắn với tài nguyên | [x] Đạt quy trình |
| 4 | **Zero Available EBS Volumes** | Không còn ổ cứng gp3 nào mồ côi sau khi các worker nodes chấm dứt | [x] Đạt quy trình |
| 5 | **VPC Fully Deleted** | VPC `sre-platform-dev-vpc` không còn tồn tại trên AWS Console | [x] Đạt quy trình |

---

## 5. Quy tắc an toàn & Bước kế tiếp

> [!CAUTION]
> **Tuyệt đối không thực hiện xóa KMS CMK ngay lập tức bằng các công cụ can thiệp thô bạo.** AWS áp dụng cơ chế 7-day waiting period để bảo vệ người dùng khỏi việc vô tình làm mất vĩnh viễn quyền truy cập vào các bản sao lưu đã mã hóa.

Chuyển sang [Lab 10.06: Cost Audit & Production Handoff](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/10-handoff-cleanup/06-cost-audit.md) để kiểm toán lần cuối hóa đơn AWS Billing và bàn giao chính thức tài liệu vận hành nền tảng.
