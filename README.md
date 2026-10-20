# AWS Cloud-Native SRE Platform

> **Nền tảng thực hành Site Reliability Engineering chuyên sâu trên AWS EKS**  
> **Trạng thái:** Đang thiết kế và xây dựng bộ khung (Planning / Scaffold). Những kiến trúc, chỉ tiêu, quy trình và kịch bản bên dưới là **mục tiêu triển khai**, chưa phải kết quả đã đo hay tài nguyên AWS được xác nhận đang chạy.

## Mục lục

1. [Giới thiệu và định hướng](#1-giới-thiệu-và-định-hướng)
2. [Vấn đề cần giải quyết và mục tiêu](#2-vấn-đề-cần-giải-quyết-và-mục-tiêu)
3. [Phạm vi, nguyên tắc và phân chia repository](#3-phạm-vi-nguyên-tắc-và-phân-chia-repository)
4. [Kiến trúc tổng thể](#4-kiến-trúc-tổng-thể)
5. [Technology stack và ranh giới quản lý](#5-technology-stack-và-ranh-giới-quản-lý)
6. [Observability: từ tín hiệu đến chẩn đoán](#6-observability-từ-tín-hiệu-đến-chẩn-đoán)
7. [SLI, SLO, SLA, Error Budget và Burn Rate](#7-sli-slo-sla-error-budget-và-burn-rate)
8. [Resilience, High Availability và tự phục hồi](#8-resilience-high-availability-và-tự-phục-hồi)
9. [Performance Engineering và Capacity Planning](#9-performance-engineering-và-capacity-planning)
10. [Chaos Engineering và GameDay](#10-chaos-engineering-và-gameday)
11. [GitOps, Canary và phát hành an toàn](#11-gitops-canary-và-phát-hành-an-toàn)
12. [Incident Response và Auto-remediation](#12-incident-response-và-auto-remediation)
13. [Quy trình học qua Console rồi đưa vào IaC](#13-quy-trình-học-qua-console-rồi-đưa-vào-iac)
14. [Cấu trúc và chức năng các thư mục](#14-cấu-trúc-và-chức-năng-các-thư-mục)
15. [Roadmap triển khai theo từng giai đoạn](#15-roadmap-triển-khai-theo-từng-giai-đoạn)
16. [Kịch bản kiểm thử và phương pháp đánh giá](#16-kịch-bản-kiểm-thử-và-phương-pháp-đánh-giá)
17. [Bảo mật, chi phí và giới hạn kiến trúc](#17-bảo-mật-chi-phí-và-giới-hạn-kiến-trúc)
18. [Tiêu chí nghiệm thu và bằng chứng](#18-tiêu-chí-nghiệm-thu-và-bằng-chứng)
19. [Tài liệu tham khảo và bước tiếp theo](#19-tài-liệu-tham-khảo-và-bước-tiếp-theo)

---

## 1. Giới thiệu và định hướng

**AWS Cloud-Native SRE Platform** là dự án nghiên cứu, thực hành và kiểm chứng độ tin cậy của hệ thống microservices chạy trên **Amazon EKS đa Availability Zone**. Đích đến không chỉ là triển khai ứng dụng chạy được, mà là xây dựng năng lực **đo lường – phát hiện – ứng phó – phục hồi – tối ưu – chứng minh bằng số liệu**.

Dự án được thiết kế cho người đã quen AWS, Kubernetes, Terraform, CI/CD và Observability nhưng muốn tiến sâu vào **Site Reliability Engineering (SRE)**.

### 1.1. Observability khác SRE ở đâu?

| Góc nhìn | Observability | SRE |
| --- | --- | --- |
| Câu hỏi | Hệ thống đang làm gì, vì sao lỗi? | Độ tin cậy đủ tốt chưa, cần làm gì để bảo vệ người dùng? |
| Đầu vào | Metrics, logs, traces, profile | Telemetry, nhu cầu người dùng, mục tiêu dịch vụ, lịch sử sự cố |
| Đầu ra | Dashboard, truy vấn, cảnh báo kỹ thuật | SLI/SLO, error budget, chính sách release, runbook, phục hồi, cải tiến |
| Ví dụ | Phát hiện Order API bị DB timeout | Đo ảnh hưởng tới SLO, giảm tác động, rollback/mitigate, đo MTTR, phòng ngừa tái diễn |

**Observability là nền tảng quan sát; SRE là phương pháp quản lý và nâng cao reliability dựa trên dữ liệu đó.**

### 1.2. Câu hỏi nghiên cứu trung tâm

- Khi một Pod, Node hoặc dependency lỗi, **người dùng có bị ảnh hưởng không**?
- Khi traffic tăng đột biến, hệ thống đáp ứng tới đâu trước khi p95/p99 và error rate xấu đi?
- Alert có phát đúng vấn đề người dùng đang gặp, hay chỉ gây nhiễu?
- Một deployment lỗi có thể bị phát hiện và tự rollback **trước khi lan rộng** không?
- Tác động của biện pháp cải thiện có đo được qua nhiều lần thử và có tương xứng chi phí không?

## 2. Vấn đề cần giải quyết và mục tiêu

### 2.1. Những vấn đề production điển hình

1. Có dashboards CPU/RAM nhưng chưa biết user-facing availability.
2. Nhiều cảnh báo nhưng không xác định được sự cố nào cần xử lý trước.
3. Pod được Kubernetes restart nhưng API vẫn có downtime hoặc lỗi dây chuyền.
4. Autoscaling làm tăng số Pod nhưng vẫn thiếu node capacity, nghẽn DB hoặc backlog queue.
5. Canary được triển khai nhưng không có tiêu chí khách quan để promote/rollback.
6. Kiến trúc được gọi là HA nhưng chưa kiểm thử thực tế lúc một failure domain biến mất.
7. Không có timeline hoặc evidence để chứng minh MTTD, MTTR và cải thiện trước/sau.

### 2.2. Mục tiêu đầu ra

- Hạ tầng AWS và Kubernetes có thể dựng lại bằng IaC + GitOps.
- Ứng dụng demo có giao dịch qua API, DB, Redis và SQS để tạo tín hiệu đo thật.
- End-to-end observability: infrastructure + application metrics, structured logs, distributed traces.
- SLI/SLO và error budget tính từ **request đủ điều kiện**, có burn-rate alerts.
- Thử nghiệm autoscaling, resilience, canary rollback và chaos một cách an toàn.
- Incident runbook, postmortem không đổ lỗi cá nhân, auto-remediation có kiểm soát.
- Báo cáo **baseline so với optimized**, dữ liệu thô, nhiều lần chạy, giới hạn đo và chi phí.

## 3. Phạm vi, nguyên tắc và phân chia repository

### 3.1. Phạm vi giai đoạn đầu

- **Một AWS Region, tối thiểu hai AZ** cho các thử nghiệm tính sẵn sàng; ưu tiên thiết kế có thể cô lập chi phí.
- Amazon EKS là nền tảng chính, kết hợp AWS managed services và một số OSS observability/SRE tools.
- Không đặt mục tiêu Multi-Region Disaster Recovery trong giai đoạn đầu; DR đa vùng là một hướng mở rộng độc lập.
- Có thể thực hành cục bộ với Kind/K3s cho các chủ đề chưa cần AWS.
- Không tự tuyên bố SLA, zero downtime, RTO/RPO hay SLO compliance khi chưa có đo đạc.

### 3.2. Hai repository

| Repository | Sở hữu |
| --- | --- |
| **aws-cloud-native-sre-platform** (repo này) | AWS IaC, EKS platform, GitOps desired state, telemetry backend, SRE policies, chaos, k6, runbooks, báo cáo |
| **reliability-shop** (repo ứng dụng dự kiến) | Frontend, API Gateway, Auth/Order/Inventory/Payment, business logic, OpenTelemetry SDK, tests, Docker images, ứng dụng CI |

**Ranh giới ownership:** Terraform quản lý AWS resources và bootstrap; Argo CD quản lý Kubernetes workloads/add-ons đã bàn giao; application CI kiểm thử, build, scan, push ECR và cập nhật image reference trong GitOps. Tránh để Terraform, Helm CLI và Argo CD đồng thời thay đổi cùng một đối tượng Kubernetes.

## 4. Kiến trúc tổng thể

```text
              Client / Synthetic Probe / k6
                           |
                      Route 53
                           |
                  AWS WAF (tùy chọn)
                           |
                      ALB / TLS
                           |
              +------------v-------------------+
              | Amazon EKS - Multi-AZ          |
              | Ingress / API Gateway          |
              |       |                        |
              |   Auth / Order / Inventory     |
              |       |                        |
              |   Order --> SQS --> Payment    |
              |       |                        |
              |    PostgreSQL / Redis          |
              |                                |
              | HPA / Karpenter / KEDA         |
              | PDB / Topology Spread          |
              +---------------+----------------+
                              |
                  OTel SDK / Log Agent
                              |
                       OTel Collector
                 +------------+-------------+
                 |            |             |
            Metrics         Logs          Traces
                 |            |             |
           Prometheus       Loki          Tempo
                 +------------+-------------+
                              |
                            Grafana
                              |
               SLO / Burn Rate / Alert Rules
                              |
                       Alertmanager
                              |
                 Incident / Runbook / Action

 GitHub Actions -> ECR -> GitOps update -> Argo CD
                                             |
                                        Argo Rollouts
                                             |
                                     Canary / Rollback

 Chaos Mesh -> Có kiểm soát: fault injection
 k6        -> Load/Stress/Spike/Soak testing
```

Sơ đồ thể hiện **luồng logic dự kiến**, không chứng minh thành phần đã triển khai. Trong thực tế, **Prometheus thường scrape** metrics endpoint; Collector có thể expose metrics cho Prometheus scrape hoặc dùng kiến trúc remote-write phù hợp. Logs có thể được thu thập bằng DaemonSet agent, traces xuất qua OTLP tới Tempo.

### 4.1. Luồng request

1. Client gọi API qua DNS/ALB.
2. ALB chuyển request vào API Gateway/Ingress của EKS.
3. Order Service gọi Inventory hoặc truy cập DB/cache; tác vụ bất đồng bộ được đưa vào SQS để Payment Worker xử lý.
4. Mỗi service ghi structured logs, metrics và trace spans; trace context được truyền qua các lời gọi hỗ trợ.
5. Telemetry về collector/backend; Grafana và Prometheus rules cho biết ảnh hưởng đến request của người dùng.

### 4.2. Luồng deployment

```text
Developer commit
 -> CI: Test + Static/Supply-chain Scan
 -> Build image + immutable Git SHA tag
 -> Push Amazon ECR
 -> Update GitOps desired image reference
 -> Argo CD reconciles state
 -> Argo Rollouts canary
 -> Analysis of error/latency metrics
 -> Promote hoặc Abort/Rollback
 -> Verification / Audit
```

Rollback workload không tự phục hồi schema hoặc dữ liệu database: phải có chiến lược migration tương thích ngược (expand/contract), xử lý transaction và rollback riêng.

## 5. Technology stack và ranh giới quản lý

| Tầng | Công nghệ mục tiêu | Nhiệm vụ |
| --- | --- | --- |
| AWS nền tảng | VPC, subnets, IAM, EKS, ALB, ECR, KMS | Mạng, bảo mật, compute, phân phối traffic |
| Dữ liệu/async | RDS PostgreSQL, Redis/ElastiCache, SQS | Lưu trữ, cache, xử lý bất đồng bộ, mô phỏng dependency failures |
| Infrastructure as Code | Terraform, module, state backend | Tạo, import, cập nhật và hủy AWS resources có kiểm soát |
| GitOps | Argo CD, Helm, Kustomize | Desired state và reconciliation |
| Progressive delivery | Argo Rollouts | Canary analysis, promote/abort |
| Autoscaling | HPA, Karpenter, KEDA | Scale Pod, node và queue consumers |
| Collection | OpenTelemetry SDK/Collector, log agent | Sinh/thu/định tuyến telemetry |
| Monitoring | Prometheus, kube-state-metrics, node/container exporters | Thu thập và truy vấn metric |
| Logging / Tracing | Loki / Tempo | Điều tra log và distributed tracing |
| Visualization | Grafana | Dashboard, dữ liệu tương quan |
| Alerting | Prometheus rules, Alertmanager | Phát hiện và định tuyến sự cố |
| Thử nghiệm | k6, Chaos Mesh | Kiểm thử tải và chèn lỗi |
| Security | GitHub OIDC, Pod Identity, Trivy, Kyverno, ESO | Truy cập tối thiểu và kiểm soát chuỗi cung ứng |

Các dịch vụ tùy chọn chỉ triển khai khi phục vụ mục tiêu lab. Không cần chạy đồng thời nhiều hệ observability tương đương nếu không có nhu cầu so sánh có căn cứ.

## 6. Observability: từ tín hiệu đến chẩn đoán

### 6.1. Ba tín hiệu chính

- **Metrics:** số liệu theo thời gian như RPS, error rate, latency histogram, Pod restart, queue age, CPU/Memory.
- **Logs:** sự kiện chi tiết theo thời gian, có `service.name`, `environment`, `trace_id` phù hợp; không ghi secret hoặc PII.
- **Traces:** đường đi một request qua nhiều dịch vụ; span cho biết bước nào chậm hoặc lỗi.

**RED** ở tầng dịch vụ: Rate, Errors, Duration. **USE** ở tầng hạ tầng: Utilization, Saturation, Errors. Kết hợp dữ liệu ứng dụng và tài nguyên: CPU cao không tự động đồng nghĩa người dùng đang bị lỗi.

### 6.2. Luồng điều tra mẫu

```text
HTTP 5xx tăng
 -> Kiểm tra error rate trên dashboard
 -> Phân tách endpoint/service/version
 -> Tìm trace lỗi của request tương ứng
 -> Thấy Order -> PostgreSQL timeout
 -> Đối chiếu DB connections / saturation / logs
 -> Xác định hướng mitigation và mức ảnh hưởng
```

### 6.3. Những vấn đề phải giải quyết khi triển khai

- Phân biệt **application metrics** (RPS, request duration, business operation) với **container/node metrics**.
- Propagate trace context qua HTTP và xử lý async khi phù hợp.
- Kiểm soát metric cardinality, trace sampling, log retention, chi phí storage/network.
- Chuẩn hóa resource attributes (service, namespace, environment, version).
- Kiểm chứng telemetry bằng request thật và trace/log cụ thể; **dashboard hiển thị không đồng nghĩa dữ liệu đã chính xác**.
- Có phương án cho trường hợp monitoring stack hoặc collector bị lỗi.

## 7. SLI, SLO, SLA, Error Budget và Burn Rate

| Thuật ngữ | Ý nghĩa | Ví dụ |
| --- | --- | --- |
| **SLI** | Chỉ số chất lượng dịch vụ đo thực tế | 99,95% HTTP requests đủ điều kiện thành công |
| **SLO** | Mục tiêu nội bộ của SLI | Ít nhất 99,9% request thành công trong 30 ngày |
| **SLA** | Cam kết dịch vụ có điều khoản cụ thể | Cam kết uptime với khách hàng; **không thiết lập trong lab** |
| **Error Budget** | Mức sai lỗi tối đa cho phép từ SLO | Với SLO 99,9%, bad-request budget là 0,1% |
| **Burn Rate** | Tốc độ tiêu thụ ngân sách lỗi so với tốc độ cho phép | Bad request 2% / budget 0,1% = 20 lần |

### 7.1. Ví dụ Order API

SLI availability theo request:

`Availability = Good eligible requests / Total eligible requests × 100%`

Với **1.000.000 request đủ điều kiện** trong cửa sổ 30 ngày và mục tiêu 99,9%, số request lỗi cho phép là **1.000**. Nếu có 500 lỗi, ngân sách lỗi còn lại khoảng 50% (giả sử cùng định nghĩa tập request và bad event).

Mục tiêu ban đầu để học, **chưa phải kết quả**:

| SLI | Định nghĩa đề xuất | SLO đề xuất |
| --- | --- | --- |
| Availability | Request HTTP hợp lệ được phân loại good / tất cả request hợp lệ | >= 99,9% / rolling 30 ngày |
| Latency | Request đủ điều kiện hoàn tất < 300 ms / tổng request đủ điều kiện | >= 95% / rolling 30 ngày |
| Đúng nghiệp vụ | Đơn hàng đã nhận được ghi nhận chính xác, không xử lý trùng | Chốt sau khi có nghiệp vụ ứng dụng |

**Bắt buộc quy định:** endpoint nào được tính, mã trạng thái nào coi là bad, loại trừ probe/internal traffic ra sao, HTTP 429 và hủy request xử lý thế nào, thiếu telemetry phải được thể hiện thế nào.

### 7.2. Burn-rate alert và release policy

- Burn rate = tỷ lệ bad request quan sát được / tỷ lệ bad request được phép.
- Dùng **multi-window, multi-burn-rate** để bắt cả outage lớn trong thời gian ngắn và degradation chậm kéo dài.
- Alert từ Prometheus cần có labels, severity, owner và runbook link; Alertmanager nhận, gom nhóm và chuyển thông báo.
- Error Budget hết **không tự động** đồng nghĩa đóng băng mọi release; nhóm phải công bố chính sách escalation, ngoại lệ, mức ưu tiên và cách xử lý reliability fixes.

## 8. Resilience, High Availability và tự phục hồi

**Availability** đo mức dịch vụ sử dụng được; **resilience** là khả năng chịu tác động và phục hồi; **fault tolerance** giúp tiếp tục hoạt động dù một thành phần hỏng; **self-healing** là cơ chế phát hiện/sửa lỗi cụ thể.

Các chủ đề phải thực hành:

- Replicas phân bố trên nhiều node/AZ, topology spread và PodDisruptionBudget.
- Readiness/liveness/startup probes khác nhau về tác động.
- Graceful shutdown và connection draining để tránh drop request khi rolling update.
- Timeout, retry với exponential backoff + jitter, retry budget, circuit breaker.
- Idempotency cho thao tác order/payment và message redelivery.
- Queue buffering, bulkhead, cache fallback, graceful degradation.
- HPA, capacity headroom và giới hạn scheduling khi một node/AZ lỗi.
- RDS Multi-AZ failover và database connection management trong kịch bản riêng, có ngân sách chi phí.

**Lưu ý:** Pod được restart không chứng minh request không bị lỗi; Multi-AZ cũng không bảo đảm không có single point of failure ở edge, data path hoặc monitoring.

## 9. Performance Engineering và Capacity Planning

### 9.1. Các kiểu kiểm thử bằng k6

| Loại | Mục tiêu | Câu hỏi cần trả lời |
| --- | --- | --- |
| Smoke | Tải nhỏ, nhanh | Endpoint và test script có chạy đúng? |
| Load | Tải kỳ vọng | Có giữ latency/error rate trong giới hạn? |
| Stress | Vượt ngưỡng thiết kế | Hệ thống suy giảm và phục hồi ra sao? |
| Spike | Traffic tăng rất nhanh | Có xử lý burst và scale kịp? |
| Soak | Duy trì tải dài | Có memory leak, queue lag hoặc connection exhaustion? |

### 9.2. Đo gì?

- Throughput/RPS đạt được và tỷ lệ request thành công, không chỉ traffic generator phát ra.
- p50/p95/p99 latency, timeouts, error rate và request concurrency.
- HPA reaction, thời gian Pending Pod, thời gian Karpenter provision node, KEDA queue scaling.
- RDS connections/locks, Redis latency/hit ratio, SQS queue depth và age.
- CPU/memory, throttling, saturation; chi phí tài nguyên và cost/request khi có dữ liệu.

**Capacity Planning:** từ load test và traffic forecast, xác định request capacity, headroom, scale limits, connection pool, service quotas và điểm nghẽn. Không suy đoán chỉ từ mức CPU trung bình.

## 10. Chaos Engineering và GameDay

Chaos Engineering là **thí nghiệm có giả thuyết và giới hạn an toàn**, không phải xóa ngẫu nhiên Pod.

### 10.1. Mẫu quy trình

1. **Giả thuyết:** mất một replica Order không làm tỷ lệ good request xuống dưới ngưỡng định trước.
2. **Steady state:** có traffic nền ổn định, xác định SLI, latency và dependency health.
3. **Chèn lỗi:** Pod kill, node disruption, latency, CPU pressure, Redis outage... theo phạm vi được duyệt.
4. **Quan sát:** Prometheus + Grafana + traces + logs + Kubernetes events.
5. **Abort criteria:** dừng khi vượt ngưỡng tác động, kéo dài quá thời gian, hoặc xuất hiện rủi ro ngoài phạm vi.
6. **Kết luận:** ghi raw evidence, kết quả, sai lệch giả thuyết và biện pháp cải thiện.
7. **Lặp lại:** chạy cùng điều kiện đủ nhiều lần để so sánh baseline với cấu hình tối ưu.

### 10.2. Những kịch bản mục tiêu

| Kịch bản | Cần kiểm chứng |
| --- | --- |
| Kill một Pod | Thời gian thay thế Pod và request errors trong quá trình |
| Mất một worker | Scheduling/capacity, tác động đến ingress và ứng dụng |
| Độ trễ mạng giữa services | Timeout/retry/circuit breaker và p99 |
| CPU hoặc memory stress | Throttling, OOMKilled, alert và recovery |
| Redis unavailable | Cache fallback và graceful degradation |
| RDS failover | Connection recovery, retry, mất/gián đoạn giao dịch |
| Queue backlog | KEDA tăng worker và giảm oldest message age |
| Canary lỗi | Analysis loại bỏ release kém trước khi tác động lan rộng |

Chỉ inject lỗi phá hủy trong namespace/môi trường lab cô lập, có xác thực target, blast radius, thời gian tối đa, phương án hủy thí nghiệm và phục hồi. Thử nghiệm node/AZ hay DB failover phải duyệt thêm về mức ảnh hưởng và chi phí.

## 11. GitOps, Canary và phát hành an toàn

### 11.1. Trách nhiệm các thành phần

- **GitHub Actions:** test, scan, build, push immutable image tag (Git SHA).
- **ECR:** lưu trữ image và thông tin quét.
- **GitOps repository:** xác định image digest/tag và Kubernetes desired state.
- **Argo CD:** quan sát Git và đồng bộ tài nguyên.
- **Argo Rollouts:** từng bước dịch chuyển traffic; phân tích metric, quyết định promote/abort.
- **Prometheus:** cấp dữ liệu đo performance/error cho AnalysisTemplate.

### 11.2. Canary mẫu (mục tiêu)

`5% -> 20% -> 50% -> 100%`, với khoảng quan sát và ngưỡng kiểm chứng đủ sample size. Nếu bad-request rate hoặc latency xấu hơn baseline theo tiêu chí đã chọn, Rollouts abort và đưa traffic về phiên bản ổn định.

**Không cam kết zero downtime tuyệt đối.** Cần health/readiness, đủ capacity, rollback verification và schema migration tương thích ngược.

## 12. Incident Response và Auto-remediation

### 12.1. Vòng đời incident

```text
Symptom / SLO alert
   -> Notify / Acknowledge
   -> Triage bằng metrics, logs, traces và recent changes
   -> Mitigate: rollback, giảm tải hoặc isolate dependency
   -> Verify recovery từ góc nhìn người dùng
   -> Incident timeline + postmortem
   -> Preventive actions + re-test
```

### 12.2. Các chỉ số vận hành

| Chỉ số | Định nghĩa phải ghi rõ |
| --- | --- |
| MTTD | Từ sự cố bắt đầu đến lúc phát hiện |
| MTTA | Từ lúc cảnh báo đến lúc người phụ trách nhận xử lý |
| MTTR | Từ mốc bắt đầu đã quy ước đến khi khôi phục user-facing service |
| Change failure rate | Tỷ lệ thay đổi gây suy giảm dịch vụ theo định nghĩa thống nhất |
| Error-budget consumption | Mức bad events đã sử dụng trong cửa sổ SLO |

Đo timestamps từ log/alert/traffic test và trình bày giới hạn độ chính xác; không dùng riêng thời gian Pod Ready để thay thế thời gian dịch vụ phục hồi.

### 12.3. Auto-remediation an toàn

Chỉ thực hiện tác vụ đã được kiểm định: ví dụ rollback canary với guardrails. Cần least privilege, giới hạn số lần, idempotency, timeout, audit log, xác minh sau hành động, cơ chế dừng và can thiệp thủ công. Không tự restart hàng loạt Pods mỗi khi CPU hoặc 5xx tăng.

## 13. Quy trình học qua Console rồi đưa vào IaC

Thư mục **`labs/` chỉ để một thư mục gốc**, người thực hành tự tổ chức sau; không tạo sẵn các nhóm lab con.

```text
(1) Dựng resource thủ công trên AWS Console
     |
(2) Hiểu networking/IAM/dependencies và verify thực tế
     |
(3) Lưu bằng chứng đã loại secret và ghi ID/ARN cần thiết
     |
(4) Viết Terraform resource tương ứng và import vào state đúng chỗ
     |
(5) terraform plan -> giải quyết drift, tránh replacement ngoài ý muốn
     |
(6) Refactor module/variable/output và xác định ownership
     |
(7) Chuyển Kubernetes desired state sang Argo CD nếu phù hợp
     |
(8) Dựng lại từ IaC/GitOps ở môi trường sạch
     |
(9) Cleanup, kiểm tra tài nguyên tính phí còn sót và ghi kết quả
```

**Terraform import** đưa đối tượng có sẵn vào state, **không bảo đảm** cấu hình đã đầy đủ hoặc code đã tái sử dụng tốt; phải review plan và dependency. Không import các Kubernetes objects do Argo CD sở hữu rồi quản lý chồng chéo bằng Terraform. Tuyệt đối không commit access key, token, secrets, private key, kubeconfig nhạy cảm hay nội dung Terraform state.

## 14. Cấu trúc và chức năng các thư mục

```text
aws-cloud-native-sre-platform/
├── .github/workflows/             # Kiểm tra IaC, GitOps và security
├── iac/terraform/
│   ├── bootstrap/                 # Backend/state và dependency khởi tạo
│   ├── modules/                   # AWS modules tái sử dụng
│   └── envs/                      # Tách dev/staging/prod
├── gitops/
│   ├── bootstrap/                 # Cài đặt/khởi tạo Argo CD
│   ├── projects/                  # Argo CD Projects, RBAC/phạm vi
│   ├── platform/                  # Cluster add-ons
│   └── applications/              # Base và environment overlays
├── observability/
│   ├── opentelemetry/             # Collector / hướng dẫn instrumentation
│   ├── prometheus/                # Rules và ServiceMonitors
│   ├── loki/                      # Log backend
│   ├── tempo/                     # Trace backend
│   ├── grafana/                   # Dashboards/datasources/provisioning
│   └── alertmanager/              # Định tuyến alerts
├── sre/
│   ├── slos/                      # Availability/latency/error-budget
│   ├── alerts/                    # Policy và phân loại severity
│   ├── runbooks/                  # Hướng dẫn xử lý
│   ├── incidents/                 # Nhật ký sự cố
│   ├── postmortems/               # Phân tích và hành động phòng ngừa
│   ├── auto-remediation/          # Automation có guardrails
│   └── reliability-reports/       # Báo cáo reliability
├── chaos/
│   ├── experiments/               # Pod/node/network/resource/dependency
│   └── gamedays/                  # Diễn tập sự cố
├── performance/
│   ├── k6/                        # Smoke/load/stress/spike/soak
│   ├── benchmarks/                # Baseline và kết quả lặp lại
│   └── capacity-planning/         # Sizing/cost từ số liệu
├── labs/                          # Tự học Console-first, không chia sẵn
├── scripts/                       # Bootstrap/deploy/validate/cleanup
├── docs/                          # Tài liệu tiếng Việt chuyên sâu
├── Makefile
└── README.md
```

### 14.1. Phân biệt cấu hình công cụ và mô tả GitOps

Ví dụ `observability/prometheus/` giữ alert rules/ServiceMonitors; `gitops/platform/monitoring/` giữ Application/Helm/Kustomize references triển khai chúng. Tránh nhân bản cả hai bản nguồn của cùng một cấu hình mà không có cơ chế liên kết rõ ràng.

`sre/slos/` là **nguồn định nghĩa SLO**, có thể sinh ra hoặc tham chiếu Prometheus rules. Các bản rules triển khai phải được đồng bộ tự động hoặc ghi rõ quan hệ để tránh sai lệch.

## 15. Roadmap triển khai theo từng giai đoạn

| Giai đoạn | Hạng mục | Kết quả phải kiểm chứng |
| --- | --- | --- |
| 01 | Terraform VPC, IAM/Pod Identity, EKS Multi-AZ, bootstrap | Terraform validate/plan, cluster access, network/IAM |
| 02 | ReliabilityShop, DB, Redis, SQS và CI/CD | Một giao dịch thật xuyên service và dependency |
| 03 | OpenTelemetry, Prometheus, Loki, Tempo, Grafana | Metrics/logs/traces tương quan cho một request thật |
| 04 | SLI/SLO, error-budget dashboard, burn-rate alert | Inject lỗi có kiểm soát làm alert phản ứng đúng |
| 05 | k6, HPA, Karpenter, KEDA | RPS, error, p95/p99, scale latency, queue age, cost |
| 06 | Readiness, PDB, graceful shutdown, retry, circuit breaker | So sánh tác động dưới cùng loại fault |
| 07 | Argo Rollouts canary + metric analysis | Release lỗi được abort và verify rollback |
| 08 | Chaos Mesh experiments, GameDays | Có giả thuyết, abort condition và evidence |
| 09 | Incident routing, runbook, postmortem, auto-remediation | Incident timeline và MTTD/MTTR đo được |
| 10 | Benchmark lặp lại, scorecard, đánh giá chi phí, cleanup | Baseline vs optimized và báo cáo giới hạn |

**Chiến lược triển khai:** làm một lát cắt dọc nhỏ trước: Order API + một dependency + OTel + SLO + k6 + một lỗi được inject; xác minh trọn vòng lặp SRE rồi mới mở rộng công cụ và số lượng services.

## 16. Kịch bản kiểm thử và phương pháp đánh giá

### 16.1. Mẫu kịch bản tối thiểu

**Tên:** Order API chịu lỗi một Pod.

- **Giả thuyết:** Mất một Pod không làm availability ở thời gian kiểm thử tụt quá mức đã đặt khi replica còn lại đủ năng lực.
- **Baseline:** áp k6 load cố định, ghi good/total requests, p95/p99, placement, CPU, deployment version.
- **Inject:** kill Pod theo namespace/label xác nhận trước; giới hạn một lần và thời lượng.
- **Observe:** Grafana + logs + traces + Kubernetes events + thời gian Ready của Pod thay thế.
- **Đánh giá:** so sánh số lỗi, latency, user-facing recovery, giới hạn của PDB/replicas.
- **Lặp lại:** nhiều lần, đảm bảo reset trạng thái và điều kiện traffic tương đương.
- **Kết luận:** đạt/không đạt giả thuyết, nguyên nhân, hành động cải tiến và số liệu đo lại.

### 16.2. Nguyên tắc số liệu

1. Không tự tạo hoặc tô đẹp data; lưu raw results, timestamps, cấu hình test, phiên bản commit/image.
2. Phân biệt **target, estimate, simulation, measured result**.
3. Khi so sánh phải nêu số lần lặp, biến được cố định, noise và môi trường.
4. Không tuyên bố HA hoặc latency SLO chỉ nhờ manifest có hai replicas.
5. Kết quả SLO rolling 30 ngày không thể chứng minh từ một bài load test vài phút; bài ngắn chỉ xác nhận cơ chế đo/alert.

## 17. Bảo mật, chi phí và giới hạn kiến trúc

### 17.1. Bảo mật

- GitHub Actions sử dụng AWS OIDC thay cho access key dài hạn.
- EKS Pod Identity hoặc cơ chế được lựa chọn rõ ràng, IAM least privilege.
- External Secrets/Secrets Manager quản lý runtime secrets; tránh in giá trị ra logs.
- ECR image scanning, Trivy, policy guardrails (ví dụ Kyverno), pin version/digest.
- RBAC, network policies, TLS, hạn chế public endpoints; bảo vệ Grafana/Argo CD.
- Sanitization trước khi commit evidence; tuyệt đối không đưa ARN có kèm secret hay endpoint nội bộ nhạy cảm nếu không cần.

### 17.2. Chi phí

EKS control plane, node EC2, ALB, NAT Gateway, RDS Multi-AZ, telemetry ingestion/storage và log retention đều có thể tính phí trong lúc idle. Ưu tiên môi trường lab tạm thời, bật thành phần đắt tiền theo đợt kiểm thử và lập checklist dọn dẹp: load balancer, ENI/NAT, EBS/PV, RDS snapshots, EIP, CloudWatch log groups, ECR images, S3 và các resource còn phụ thuộc.

**Không khẳng định chi phí $0** chỉ vì `terraform destroy` thành công; kiểm tra tài nguyên còn sót và chờ dữ liệu billing cập nhật.

### 17.3. Giới hạn

Đây là **production-like learning platform**, chưa chứng minh production-ready. Cần đánh giá thêm HA của monitoring, vùng lỗi edge/control plane, security hardening, restore data, service quotas, alert noise và năng lực vận hành trước khi dùng môi trường thật.

## 18. Tiêu chí nghiệm thu và bằng chứng

Chỉ đánh dấu hoàn thành khi **đã triển khai + xác minh + lưu bằng chứng + xác định giới hạn + kiểm thử tái dựng/cleanup**.

- [ ] AWS networking/IAM/EKS và GitOps tái dựng từ IaC.
- [ ] Application flow có request và dependency thật.
- [ ] Metrics, logs, traces có thể tương quan và truy tìm sự cố.
- [ ] SLI, SLO, Error Budget, Burn Rate có định nghĩa và alert test.
- [ ] k6 kiểm thử đủ 5 profile; có throughput/latency/error/capacity measurements.
- [ ] HPA/Karpenter/KEDA có evidence hoạt động và giới hạn.
- [ ] Canary phát hiện bad rollout, abort/rollback và verify service.
- [ ] Chaos có giả thuyết, phạm vi, guardrails, raw evidence và repeated runs.
- [ ] Incident exercise có MTTD/MTTA/MTTR, runbook, postmortem, action items.
- [ ] Auto-remediation có guardrails, audit và kiểm chứng hậu xử lý.
- [ ] Báo cáo baseline/optimized có số liệu minh bạch và đánh giá trade-off chi phí.
- [ ] Dọn dẹp AWS resources và kiểm tra tồn đọng đã được ghi nhận.

## 19. Tài liệu tham khảo và bước tiếp theo

- [Google SRE Books](https://sre.google/books/) — nền tảng SLI/SLO, error budgets và incident management.
- [AWS Well-Architected Reliability Pillar](https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/welcome.html) — tư duy reliability trên AWS.
- [Amazon EKS Documentation](https://docs.aws.amazon.com/eks/latest/userguide/what-is-eks.html).
- [Kubernetes Documentation](https://kubernetes.io/docs/home/).
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/).
- [Prometheus Documentation](https://prometheus.io/docs/introduction/overview/).
- [Grafana Documentation](https://grafana.com/docs/).
- [Argo CD Documentation](https://argo-cd.readthedocs.io/).
- [Argo Rollouts Documentation](https://argo-rollouts.readthedocs.io/).
- [Chaos Mesh Documentation](https://chaos-mesh.org/docs/).
- [Grafana k6 Documentation](https://grafana.com/docs/k6/latest/).

**Bắt đầu:** thống nhất workload mẫu và SLI, xây một đường request hoàn chỉnh và kiểm chứng telemetry trước. Sau đó mới thêm SLO alert, k6 baseline, resilience, chaos và incident workflow.

---

> **Hiện trạng xác minh khi viết README:** Đã có cấu trúc thư mục repository; việc có cấu trúc không đồng nghĩa đã có hạ tầng triển khai hoặc kết quả SRE được đo. Mọi mục tiêu kỹ thuật, chỉ số và thí nghiệm ở trên cần được thực hiện và xác nhận bằng evidence trước khi cập nhật trạng thái.
