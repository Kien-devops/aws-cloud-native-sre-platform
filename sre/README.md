# Site Reliability Engineering (SRE) — Reliability Governance & Chaos Drills

**SLO, incident response và bằng chứng phục hồi trong cùng một nơi.**

[Trang chủ](../README.md) / SRE · [Runbooks](runbooks/README.md) · [Performance](../performance/README.md) · [Chaos](../chaos/README.md)

| Nhu cầu | Điểm vào |
| --- | --- |
| Định nghĩa mục tiêu | [Service SLOs](slos/service-slos.yaml) · [Error budget policy](slos/error-budget/policy.md) |
| Theo dõi burn rate | [Recording & alert rules](alerts/slo-recording-and-alerts.yaml) |
| Xử lý incident | [Runbooks](runbooks/README.md) · [Incident template](incidents/incident-template.md) |
| Học sau sự cố | [Postmortem template](postmortems/template.md) |
| Lập kế hoạch remediation | [Dry-run planner](auto-remediation/pod-restart.py) |
| Tổng hợp reliability | [Reports](reliability-reports/README.md) |

> [!NOTE]
> SLO và budget policy hiện ghi trạng thái `proposed`. Remediation script chỉ trả kế hoạch, không restart Pod. Các scorecard và sign-off bên dưới là hồ sơ được lưu, không phải phê duyệt production mới.

Thư mục này là trung tâm chỉ huy kỹ thuật (**SRE Command Center**) của hệ sinh thái **AWS Cloud-Native SRE Platform**. Nơi đây lưu trữ các kịch bản diễn tập sự cố (Chaos GameDay), quy trình vận hành khẩn cấp (On-call Runbooks), báo cáo hậu sự cố không đổ lỗi (Blameless Postmortems), và biên bản nghiệm thu Go-Live chính thức.

---

## 1. Kiến trúc Diễn tập Khả năng Tự phục hồi (Resilience & Chaos Architecture)

![SRE Chaos GameDay Resilience](../docs/images/architecture/sre-chaos-resilience-drawio.png)

<details>
<summary><b>🔍 Xem sơ đồ logic chi tiết định dạng Mermaid</b></summary>

```mermaid
flowchart TD
    subgraph Traffic_Generator ["k6 In-Cluster Load Generator"]
        k6["k6 Load Runner (45 - 68 RPS liên tục)"]
    end

    subgraph AWS_EKS_Cluster ["Amazon EKS Multi-AZ Cluster"]
        ALB["AWS Application Load Balancer"]
        
        subgraph AZ_1A ["Availability Zone 1A (Fault Domain)"]
            Node_A["EC2 Worker Node (i-07bd945956fb84f26)"]
            Pod_A["order-service Pod 1 (TERMINATED)"]
        end
        
        subgraph AZ_1B ["Availability Zone 1B (Survivor Domain)"]
            Node_B["EC2 Worker Node (Healthy)"]
            Pod_B["order-service Pod 2 (PDB Protected)"]
        end
        
        subgraph Auto_Healing ["Karpenter Dynamic Compute"]
            Karpenter["Karpenter Controller"]
            New_Node["Replacement Node (Online < 60s)"]
        end
    end

    k6 -- "4,023 Requests" --> ALB
    ALB --> Pod_A & Pod_B
    
    Fault["Chaos Injection: aws ec2 terminate-instances"] -.-> Node_A
    Node_A --> Pod_A
    
    ALB -- "100% Traffic Shift (0 Drops)" --> Pod_B
    Karpenter -- "Auto Provision" --> New_Node
    New_Node -.-> Pod_New["Rescheduled Pod"]
```

</details>

Mô hình chi tiết định dạng Draw.io có thể xem và tải tại: [**`docs/diagrams/sre_resilience_chaos.drawio`**](../docs/diagrams/sre_resilience_chaos.drawio).

---

## 2. Minh chứng Diễn tập GameDay Thực tế (Live Chaos Evidence)

### 2.1. Bằng chứng EC2 Worker Node bị Terminate & Cụm Tự phục hồi
Ảnh chụp AWS Management Console xác thực EC2 Instance `i-07bd945956fb84f26` (AZ-1a) đã chuyển trạng thái `Terminated` thành công trong buổi diễn tập GameDay, trong khi 5 Nodes còn lại (bao gồm các node Karpenter Spot `c5.large` tự động bù vào) tiếp tục duy trì 100% SLA:

![AWS EC2 GameDay Node Termination](../docs/images/evidence/aws-ec2-gameday-node-termination.png)

### 2.2. Kiểm chứng Cô lập Poison Pill qua Amazon SQS Dead Letter Queue (DLQ)
Danh sách hàng đợi SQS được mã hóa bằng KMS CMK Key; Dead Letter Queue (`reliability-shop-dev-order-dlq`) đã bắt và cô lập an toàn 40 thông điệp lỗi độc hại, ngăn ngừa worker sập dây chuyền:

![AWS SQS Queues and DLQ](../docs/images/evidence/aws-sqs-queues-encryption.png)

### 2.3. Bảng Điều Khiển SRE Diagnostics & Luồng Giao Dịch Outbox
Giao diện SRE Console tích hợp đo lường thời gian thực kết nối RDS, Redis, và SQS. Luồng đặt hàng ghi nhận tường minh 4 giai đoạn (`RDS Commit` $\rightarrow$ `SQS Event` $\rightarrow$ `Worker Consume` $\rightarrow$ `Redis Cache`):

![ReliabilityShop SRE Diagnostics](../docs/images/evidence/reliability-shop-sre-diagnostics.jpg)
![ReliabilityShop Order Outbox Flow](../docs/images/evidence/reliability-shop-order-outbox-flow.jpg)

---

## 3. Bảng Dữ Liệu Diễn Tập Thực Tế (Chaos GameDay Scorecard)

Trong buổi diễn tập GameDay, một EC2 Worker Node (`i-07bd945956fb84f26`) bị hủy đột ngột thông qua AWS API khi k6 đang đẩy tải 45 RPS:

| Chỉ số Đánh giá SRE | Kết quả Diễn tập Thực tế | Mục tiêu Đặt ra (Target SLA) | Đánh giá |
| :--- | :--- | :--- | :---: |
| **Tổng số Requests trong GameDay** | **4,023 requests** | $\ge 3,000\text{ reqs}$ | **PASS** |
| **Tỷ lệ thành công (Success Rate)** | **100.00% HTTP 200 OK** | $\ge 99.90\%$ | **PASS** |
| **Số requests bị rớt (Dropped Reqs)**| **0 requests** (Nhờ Pod Disruption Budget) | $0\text{ dropped}$ | **PASS** |
| **Thời gian phục hồi Pod (MTTR Pod)** | **35 giây** | $\le 60\text{ giây}$ | **PASS** |
| **Thời gian bù Node mới (Karpenter)**| **< 60 giây** (Node `10.0.11.243` Ready) | $\le 120\text{ giây}$ | **PASS** |
| **Dữ liệu giao dịch ghi nhận** | **1,356 orders** (Không mất bản ghi nào) | Toàn vẹn 100% ACID | **PASS** |

---

## 3. Các kịch bản Kiểm chứng Khả năng Chịu lỗi (Resilience Drill Scenarios)

1. **Pod Disruption Budget (PDB) & Pod Eviction:**
   - Cấu hình `minAvailable: 1` cho mọi microservice.
   - Khi 1 Pod bị xóa đột ngột bằng `kubectl delete pod`, Ingress lập tức cắt traffic đến Pod đó và chuyển hướng sang Pod còn lại trong AZ khác, đảm bảo **0 request timeout**.
2. **Redis In-Memory Cache Fallback:**
   - Khi dịch vụ cache Redis bị cô lập hoặc quá tải, microservice tự động fallback trực tiếp xuống PostgreSQL mà không gây gián đoạn dịch vụ khách hàng.
3. **SQS DLQ Poison Pill Isolation:**
   - Khi một thông điệp chứa payload lỗi hoặc độc hại đi vào hàng đợi thanh toán, worker sau 3 lần retry thất bại sẽ tự động chuyển thông điệp vào Dead Letter Queue (`*-dlq`), bảo vệ worker không bị crash loop.

---

## 4. Biên bản Nghiệm thu Production Go-Live Readiness (Go-Live Gate Sign-Off)

Nền tảng đã vượt qua toàn diện 8 trụ cột đánh giá của hội đồng SRE với kết quả **APPROVED (GO)**:

| Trụ cột Đánh giá (Pillar) | Số tiêu chí đạt | Tình trạng |
| :--- | :---: | :---: |
| 1. **Infrastructure & Network HA** (Multi-AZ, S3 VPCE, NAT) | 4 / 4 | **APPROVED** |
| 2. **Security & Identity** (KMS CMK, EKS Pod Identity, Zero Secrets) | 4 / 4 | **APPROVED** |
| 3. **Data Layer Reliability** (RDS Multi-AZ, Redis Cache, SQS DLQ) | 4 / 4 | **APPROVED** |
| 4. **GitOps & Delivery Safety** (Argo CD Self-Heal, Argo Rollouts Canary) | 4 / 4 | **APPROVED** |
| 5. **Observability & SLOs** (OTel, Prometheus, Multi-burn-rate Alerting) | 4 / 4 | **APPROVED** |
| 6. **Auto-Scaling & Elasticity** (KEDA Queue Scaling, Karpenter Spot) | 4 / 4 | **APPROVED** |
| 7. **Resilience & Chaos Readiness** (PDB, GameDay Verified, MTTR < 35s) | 4 / 4 | **APPROVED** |
| 8. **FinOps & Cost Governance** (Budget Alert, $6.50/day Active $\rightarrow$ $0.04/day Idle) | 4 / 4 | **APPROVED** |
| **TỔNG KẾT ĐÁNH GIÁ CHUNG** | **32 / 32 (100%)** | **OFFICIAL GO-LIVE** |

---

## 5. Cấu trúc thư mục

```text
sre/
├── alerts/                # Quy tắc PrometheusRules & Alertmanager Routing
├── auto-remediation/      # Kịch bản tự phục hồi sự cố tự động
├── incidents/             # Nhật ký phân loại sự cố P1 - P4
├── postmortems/           # Biên bản Postmortem không đổ lỗi (Blameless)
├── reliability-reports/   # Báo cáo định lượng độ tin cậy định kỳ
├── runbooks/              # Sổ tay vận hành On-call (Scale Rollout, DB Failover)
└── slos/                  # Định nghĩa toán học SLI/SLO & Error Budget
```

