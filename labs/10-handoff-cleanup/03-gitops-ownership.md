# Lab 10.03: GitOps Ownership, Separation of Concerns & Drift Management

## 1. Mục tiêu & Nguyên lý SRE

Lab này thiết lập ranh giới trách nhiệm tuyệt đối (**Separation of Concerns**) giữa **Terraform (IaC)** và **Argo CD (GitOps)** nhằm loại bỏ triệt để hiện tượng xung đột quản lý tài nguyên (Mutating Clashes), ghi đè trạng thái (State Overwrites) và can thiệp thủ công thiếu kiểm soát (Out-of-band Hotfixes).

```
+---------------------------------------------------------------------------------------------------------+
|                                    PLATFORM OWNERSHIP SEPARATION MATRIX                                 |
+---------------------------------------------------------------------------------------------------------+
|                                                                                                         |
|   LAYER 1: CLOUD FOUNDATION (AWS)                 LAYER 2: K8S PLATFORM & APPS (GitOps)                 |
|   +---------------------------------------+       +-----------------------------------------------+     |
|   | Owner: Terraform (iac/terraform/)     |       | Owner: Argo CD (gitops/)                      |     |
|   | - VPC, Subnets, Route Tables, NAT, EIP|       | - Platform Apps: LBC, ESO, OTel, Prometheus   |     |
|   | - EKS Cluster & IAM Pod Identity Roles|  ==>  | - Workload Apps: Order, Payment, Inventory    |     |
|   | - RDS PostgreSQL & ElastiCache Redis  |       | - K8s Manifests: Deployment, Service, Ingress |     |
|   | - SQS, ECR, KMS Keys, Secrets Manager |       | - CRDs: Rollout, ScaledObject, ExternalSecret |     |
|   +---------------------------------------+       +-----------------------------------------------+     |
|                                                                                                         |
|   LAYER 3: DYNAMIC RUNTIME RESOURCES (Controllers)                                                      |
|   +-----------------------------------------------------------------------------------------------+     |
|   | - AWS Application Load Balancer (ALB) & Target Groups ==> Created by AWS Load Balancer Controller    |
|   | - Dynamic EC2 Spot/On-Demand Worker Nodes              ==> Provisioned by Karpenter Controller    |
|   | - K8s Secret Object (base64)                           ==> Reconciled by External Secrets Operator   |
|   | * TUYỆT ĐỐI KHÔNG KHAI BÁO CÁC TÀI NGUYÊN NÀY TRONG TERRAFORM ĐỂ TRÁNH XUNG ĐỘT IMPORT KÉP!   |
|   +-----------------------------------------------------------------------------------------------+     |
+---------------------------------------------------------------------------------------------------------+
```

### Nguyên lý SRE cốt lõi:
- **Strict Single Ownership:** Mỗi tài nguyên trong toàn bộ hệ sinh thái chỉ được phép quản lý bởi đúng **MỘT** công cụ tự động hóa duy nhất.
- **Anti-Overlap Rule:** Terraform chịu trách nhiệm cấp phát hạ tầng vật lý/đám mây cơ bản; Argo CD chịu trách nhiệm cho vòng đời của ứng dụng và các bộ điều khiển nội bộ Kubernetes.
- **Zero Console Mutations:** Mọi hành vi cấu hình thủ công qua AWS Console đều bị coi là vi phạm tuân thủ (Compliance Violation) và sẽ bị hệ thống tự động hoàn tác hoặc cảnh báo ngay lập tức.

---

## 2. Bảng phân định quyền sở hữu chi tiết (Ownership Matrix)

| Danh mục | Tài nguyên | Công cụ quản lý (Owner) | Vị trí mã nguồn / Khởi tạo | Xử lý khi có lệch (Drift Action) |
| :--- | :--- | :--- | :--- | :--- |
| **Cloud Network** | VPC, Subnets, Route Tables, NAT, IGW, Endpoints | **Terraform** | `iac/terraform/01-vpc.tf` | Terraform Plan alert qua CI/CD |
| **Cloud Security** | KMS Keys, IAM Roles, Pod Identity Associations | **Terraform** | `iac/terraform/02-iam.tf` | Terraform Plan alert |
| **Cloud Data** | RDS PostgreSQL, ElastiCache Redis | **Terraform** | `iac/terraform/03-db.tf` | Terraform Plan alert |
| **Cloud Compute** | EKS Cluster, EKS Managed Node Group (Default) | **Terraform** | `iac/terraform/04-eks.tf` | Terraform Plan alert |
| **Cloud Ingress** | AWS Application Load Balancer (ALB), Target Groups | **LBC (Controller)** | Sinh động từ `Ingress` K8s | Do Controller tự động điều chỉnh |
| **Dynamic Compute**| Dynamic EC2 Instances (Spot/On-Demand) | **Karpenter** | Sinh động từ `NodeClaim` | Do Karpenter scale/consolidate |
| **K8s Add-ons** | LBC, ESO, Prometheus, Loki, Tempo, KEDA, Rollouts | **Argo CD** | `gitops/apps/platform/` | Tự động đồng bộ (Self-Heal: Enabled) |
| **Application** | ReliabilityShop (Order, Inventory, Payment) | **Argo CD** | `gitops/apps/workloads/` | Tự động đồng bộ (Self-Heal: Enabled) |
| **Secret Value** | Plaintext secret values | **Secrets Manager** | AWS Secrets Manager Console/CLI | Đồng bộ sang K8s Secret qua ESO |

---

## 3. Cấu hình Anti-Drift & Tự động phục hồi (Self-Healing) trên Argo CD

Để đảm bảo các can thiệp thủ công vào cụm Kubernetes bằng `kubectl edit` hoặc `kubectl delete` bị triệt tiêu ngay lập tức, cấu hình thuộc tính `automated.selfHeal: true` và `automated.prune: true` trên tất cả các Application của Argo CD.

### 1. Áp dụng chuẩn hóa cho `gitops/apps/platform/platform-apps.yaml`:
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: platform-apps
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: platform
  source:
    repoURL: 'https://github.com/my-org/aws-cloud-native-sre-platform.git'
    targetRevision: HEAD
    path: gitops/apps/platform
  destination:
    server: 'https://kubernetes.default.svc'
    namespace: argocd
  syncPolicy:
    automated:
      prune: true      # Tự động xóa tài nguyên K8s nếu bị xóa khỏi Git
      selfHeal: true   # Tự động hoàn tác nếu ai đó sửa bằng kubectl
    syncOptions:
      - CreateNamespace=true
      - RespectIgnoreDifferences=true
      - ServerSideApply=true
```

### 2. Kiểm tra tính năng Self-Healing thực tế bằng kịch bản Chaos nhẹ:
Chạy lệnh can thiệp thủ công sửa cấu hình Deployment trên cụm:
```bash
# Thử xóa một label hoặc sửa replica thủ công bằng kubectl
kubectl scale deployment order-service -n reliability-shop --replicas=10

# Quan sát Argo CD tự động phát hiện OutOfSync và hoàn tác về đúng số lượng trong Git (Desired = 2)
kubectl get deployment order-service -n reliability-shop -w
```
*Kết quả quan sát:* Argo CD lập tức phát hiện sự sai lệch và kích hoạt đồng bộ (Synced), ép số replica trở về 2 sau chưa đầy 10 giây.

---

## 4. Runbook xử lý can thiệp khẩn cấp (Console Hotfix Remediation Runbook)

Trong trường hợp xảy ra sự cố nghiêm trọng (Incident P1) đòi hỏi kỹ sư On-call phải sửa khẩn cấp trên AWS Console hoặc `kubectl` để cứu dịch vụ, quy trình hoàn trả trạng thái (Reconciliation) bắt buộc phải diễn ra như sau:

```
[Incident P1 xảy ra] 
       |
       v
[Console Hotfix được áp dụng để cứu vãn hệ thống]
       |
       v
[Hệ thống ổn định trở lại]
       |
       +---> BƯỚC 1: Xuất diff thuộc tính vừa sửa trên AWS Console / kubectl.
       |
       +---> BƯỚC 2: Mở Pull Request cập nhật mã nguồn (HCL cho Terraform, YAML cho GitOps).
       |
       +---> BƯỚC 3: Review và Merge PR vào nhánh `main`.
       |
       +---> BƯỚC 4: Chạy `terraform apply` hoặc `argocd app sync` để biến hotfix thành chuẩn chính thức.
       |
       v
[Kết thúc: Drift = 0, Kiến trúc trở lại trạng thái quản lý mã nguồn duy nhất]
```

---

## 5. Xác thực quyền sở hữu và rà soát Field Management trong Kubernetes

Kiểm tra `managedFields` của tài nguyên để xác định chắc chắn hệ thống nào đang nắm giữ quyền ghi:

```bash
kubectl get deployment order-service -n reliability-shop -o jsonpath='{.metadata.managedFields[*].manager}'
```

*Kỳ vọng đầu ra:*
```text
argocd-application-controller kube-controller-manager
```
Nếu nhìn thấy các manager bất thường như `kubectl-client-side-apply` hay `dashboard`, điều đó chứng tỏ có kỹ sư đã can thiệp ngoài luồng.

---

## 6. SRE Gate Check & Tiêu chí nghiệm thu

| STT | Hạng mục kiểm tra (Gate Criteria) | Điều kiện đạt (Pass Criteria) | Trạng thái |
| :--- | :--- | :--- | :--- |
| 1 | **Clear Separation Boundary** | Không có tài nguyên nào của Kubernetes được import trực tiếp vào file Terraform HCL | [ ] Đạt |
| 2 | **Argo CD Self-Heal Active** | Toàn bộ Application trên Argo CD đều bật cờ `prune: true` và `selfHeal: true` | [ ] Đạt |
| 3 | **No Duplicate Dynamic Resources**| ALB và Karpenter Nodes không bị quản lý tĩnh bởi Terraform state | [ ] Đạt |
| 4 | **Field Manager Hygiene** | `managedFields` trong toàn bộ namespace `reliability-shop` chỉ thuộc về `argocd` và controllers chuẩn | [ ] Đạt |

---

## 7. Quy tắc an toàn & Bước kế tiếp

> [!NOTE]
> Việc giữ vững ranh giới sở hữu là bức tường bảo vệ quan trọng nhất giúp ngăn ngừa các sự cố "kỹ sư này apply ghi đè lên cấu hình của kỹ sư khác". 

Chuyển sang [Lab 10.04: Rebuild & Disaster Recovery Restore](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/10-handoff-cleanup/04-rebuild-restore.md) để đo đạc và kiểm chứng khả năng tái tạo toàn bộ hạ tầng từ con số không.
