# GitOps Delivery

**Desired state cho platform và ReliabilityShop trên Amazon EKS.**

[Trang chủ](../README.md) / GitOps · [Bootstrap](bootstrap/README.md) · [Platform](platform/README.md) · [Environments](applications/reliability-shop/envs/README.md)

## Bản đồ cấu hình

| Thư mục | Trách nhiệm |
| --- | --- |
| [bootstrap/](bootstrap/README.md) | Bốn Application ngang hàng: platform, dev, staging, prod |
| [projects/](projects/) | AppProject và ranh giới tài nguyên/namespace |
| [platform/](platform/README.md) | Ingress, secret store, monitoring, KEDA, Karpenter, Rollouts |
| [base/](applications/reliability-shop/base/) | Workloads, Services, HPA, KEDA và order canary |
| [envs/](applications/reliability-shop/envs/README.md) | Namespace, image digest và patch từng môi trường |

## Luồng phát hành

```mermaid
flowchart LR
    CI[App3: test / scan / build] --> ECR[ECR digest]
    ECR --> PR[GitOps PR]
    PR --> Argo[Argo CD sync]
    Argo --> Rollout[Order canary]
    Rollout --> Analysis[Prometheus analysis]
    Analysis --> Decision[Promote / abort]
```

| Application | Revision | Sync |
| --- | --- | --- |
| `platform-infrastructure` | `HEAD` | Auto, prune, self-heal |
| `reliability-shop` | `dev` | Auto, prune, self-heal |
| `reliability-shop-staging` | `staging` | Auto, prune, self-heal |
| `reliability-shop-prod` | `main` | Manual |

Nguồn cấu hình: [root-application.yaml](bootstrap/root-application.yaml). Rollback dùng commit/digest đã biết tốt; kiểm tra thêm Rollout, API và dữ liệu sau sync.

> [!NOTE]
> Hồ sơ bên dưới được giữ để tham khảo. Một số sơ đồ, đường dẫn và số liệu thuộc revision trước; manifest hiện tại quyết định hành vi triển khai. Canary chưa có `trafficRouting`; overlay staging/prod vẫn kế thừa DB, Redis và secret dev.

<details>
<summary>Hồ sơ kiến trúc, ảnh chụp và diễn tập đã lưu</summary>

---

## 1. Kiến trúc Phân phối GitOps (GitOps Architecture)

![GitOps Progressive Delivery Pipeline](../docs/images/architecture/gitops-pipeline-drawio.png)

<details>
<summary><b>🔍 Xem sơ đồ logic chi tiết định dạng Mermaid</b></summary>

```mermaid
flowchart LR
    subgraph Git_Source ["Git Single Source of Truth (SSOT)"]
        Repo["GitHub: aws-cloud-native-sre-platform"]
        Bootstrap["gitops/bootstrap/root-application.yaml"]
    end

    subgraph ArgoCD_Engine ["Argo CD Engine (Namespace: argocd)"]
        RootApp["Root Application"]
        PlatformApp["Application: platform"]
        WorkloadApp["Application: reliability-shop"]
    end

    subgraph EKS_Workloads ["Amazon EKS Cluster Runtime"]
        subgraph Platform_Layer ["Platform Controllers"]
            LBC["AWS Load Balancer Controller"]
            ESO["External Secrets Operator"]
            Rollouts["Argo Rollouts Controller"]
            KEDA["KEDA Autoscaler"]
            Karpenter["Karpenter Node Autoscaler"]
            OTel["OpenTelemetry & Monitoring"]
        end
        
        subgraph Microservices_Layer ["ReliabilityShop Microservices"]
            Order["Rollout: order-service (Canary)"]
            Inventory["Deployment: inventory-service"]
            Payment["Deployment: payment-worker"]
        end
    end

    Repo --> Bootstrap --> RootApp
    RootApp --> PlatformApp --> Platform_Layer
    RootApp --> WorkloadApp --> Microservices_Layer
```

</details>

Mô hình chi tiết định dạng Draw.io có thể xem và tải tại: [**`docs/diagrams/gitops_pipeline.drawio`**](../docs/diagrams/gitops_pipeline.drawio).

---

## 2. Minh chứng Trực quan trên Môi trường Thực tế (Live Evidence)

### 2.1. Quản lý Đa Môi trường trên Argo CD v2.11 (100% Synced & Healthy)
Kiến trúc App-of-Apps điều phối đồng thời cả 4 applications lớn (`platform-infrastructure`, `reliability-shop` dev, `reliability-shop-staging`, và `reliability-shop-prod`) hoàn toàn tự động, 0 trôi lệch:

![Argo CD Multi-Environment Apps Healthy](../docs/images/evidence/argocd-multi-env-apps-healthy.jpg)

### 2.2. Cây Điều phối Hạ tầng Nền tảng (Platform Infrastructure Topology)
Chi tiết topology của application `platform-infrastructure` với 19 resources `Healthy`: OpenTelemetry Collector, Prometheus Operator, Loki Gateway, Tempo Tracing, KEDA Operator, và Grafana Ingress:

![Argo CD Platform Infrastructure Tree](../docs/images/evidence/argocd-platform-infrastructure-tree.jpg)

### 2.3. Cấu trúc Workloads Microservices & Argo Rollout (Dev & Prod)
Các microservices (`order-service` Canary/Stable, `inventory-service`, `payment-worker`, `auth-service`, `frontend`) phân tán đa AZ, bảo vệ bởi Pod Disruption Budget:

![Argo CD Workload Dev Topology](../docs/images/evidence/argocd-workload-dev-topology.png)
![Argo CD Workload Prod Topology](../docs/images/evidence/argocd-workload-prod-topology.png)

### 2.4. Bản đồ Điều phối Lưu lượng Ingress & TargetGroupBinding
AWS Load Balancer Controller kết nối trực tiếp với các Pods thông qua TargetGroupBinding, quản lý 10 endpoints hoàn toàn `Healthy`:

![AWS ALB Resource Map Ingress](../docs/images/evidence/aws-alb-resource-map-ingress.jpg)

---

## 3. Các số liệu kỹ thuật nổi bật (Quantifiable Metrics)

| Chỉ số kỹ thuật | Đo đạc thực tế trên Cluster | Cơ chế kiểm soát | Ý nghĩa SRE / Vận hành |
| :--- | :--- | :--- | :--- |
| **Drift Reconciliation Time** | **< 10 giây** | `automated.selfHeal: true` | Triệt tiêu hoàn toàn các can thiệp thủ công trái phép ngoài Git |
| **Canary Rollout Traffic Split** | **20% $\rightarrow$ 50% $\rightarrow$ 100%** | `Argo Rollout Canary Strategy` | Giới hạn bán kính ảnh hưởng (Blast Radius) khi release phiên bản mới |
| **Automated Rollback Latency** | **< 15 giây** | `AnalysisTemplate (5xx > 1%)` | Tự động hoàn nguyên khi phát hiện suy giảm chỉ số SLI mà không cần con người |
| **Secret Rotation Latency** | **1 giờ (Hoặc tức thì qua webhook)** | `ExternalSecrets Operator (ESO)`| 0 credentials lưu trong Git, tự đồng bộ từ AWS Secrets Manager |
| **Dynamic Compute Provisioning**| **< 60 giây** | `Karpenter NodePool (Spot c5.large)` | Tiết kiệm ~70% chi phí EC2 compute so với On-Demand |

---

## 4. Cấu trúc thư mục GitOps

```text
gitops/
├── bootstrap/                          # Điểm neo triển khai (Bootstrap Root App)
│   ├── root-application.yaml          # Root App-of-Apps khai báo tự động
│   └── applications/                  # Các Application con (platform, workloads)
├── platform/                          # Hạ tầng nền tảng Kubernetes
│   ├── aws-load-balancer-controller/  # Ingress controller điều khiển AWS ALB
│   ├── external-secrets/              # Đồng bộ Secrets Manager qua Pod Identity
│   ├── argo-rollouts/                 # Controller quản lý Canary & Blue/Green
│   ├── keda/                          # Event-driven autoscaling theo độ dài hàng đợi SQS
│   ├── karpenter/                     # Provisioning nodes EC2 Spot động
│   └── monitoring/                    # OpenTelemetry, Prometheus, Loki, Tempo, Grafana
├── applications/                      # Ứng dụng nghiệp vụ ReliabilityShop
│   └── reliability-shop/
│       ├── base/                      # Kustomize base manifests
│       └── environments/
│           ├── dev/                   # Overlay môi trường dev (đang chạy live)
│           ├── staging/               # Overlay môi trường staging
│           └── prod/                  # Overlay môi trường production
└── projects/                          # Argo CD AppProject phân quyền bảo mật
    ├── platform.yaml
    └── workloads.yaml
```

---

## 5. Quy trình Kiểm thử Anti-Drift (Drift Drill)

Để chứng minh tính bất biến của GitOps, chạy lệnh can thiệp thủ công sửa đổi số lượng pods trên cluster:

```bash
# Cố tình sửa số lượng replica của order-service lên 10 bằng kubectl:
kubectl scale rollout order-service -n reliability-shop --replicas=10

# Quan sát Argo CD:
# Ứng dụng lập tức chuyển OutOfSync và tự động hoàn nguyên về 2 replicas trong vòng 10 giây!
kubectl get rollout order-service -n reliability-shop -w
```

</details>

