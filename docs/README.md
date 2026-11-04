# Bộ tài liệu AWS Cloud-Native SRE Platform

> **Trạng thái:** Tài liệu hiện là scaffold hướng dẫn. Nội dung mô tả kiến trúc mục tiêu, cách triển khai và cách kiểm chứng; không khẳng định hạ tầng đã dựng hoặc production đã đạt SLO. [README dự án](../README.md).

## Ranh giới kết quả

- **Expected:** hành vi hoặc trạng thái mong đợi theo thiết kế.
- **Measured Result:** chỉ ghi khi có output, log, metric, trace hoặc event kèm timestamp, môi trường và phiên bản.
- Thiếu raw evidence thì không kết luận triển khai thành công, đạt RTO/RPO hoặc đạt SLO.

## Lộ trình đọc

Đọc theo đường đi từ kiến trúc đến vận hành: SRE → request flow → observability → SLI/SLO → performance/capacity → resilience/chaos → incident → progressive delivery → security.

1. [SRE là gì?](architecture/01-sre-overview.md) — tư duy SRE và sự khác biệt với quan sát hệ thống.
2. [Luồng ứng dụng](architecture/04-application-request-flow.md) và [Observability](architecture/05-observability-architecture.md).
3. [SLI/SLO/SLA](operations/01-sli-slo-sla.md) và [Error Budget/Burn Rate](operations/02-error-budget-burn-rate.md).
4. [Prometheus Alerts](operations/03-prometheus-alerting.md).
5. [Performance Engineering](operations/09-performance-engineering.md), [HPA/KEDA/Karpenter](operations/11-autoscaling-hpa-keda-karpenter.md).
6. [Resilience](operations/07-resilience-engineering.md), [Chaos](operations/08-chaos-engineering.md).
7. [Incident](operations/04-incident-management.md), [Runbook](operations/05-runbook-postmortem.md), [Auto-remediation](operations/06-auto-remediation.md).
8. [Progressive Delivery](deployment/05-progressive-delivery.md), [SRE Reporting](operations/12-sre-metrics-and-reporting.md).

## Kiến trúc và tư duy hệ thống

- [Tổng quan SRE](architecture/01-sre-overview.md)
- [Kiến trúc hệ thống](architecture/02-system-architecture.md)
- [Kiến trúc AWS EKS](architecture/03-aws-eks-architecture.md)
- [Luồng request ứng dụng](architecture/04-application-request-flow.md)
- [Kiến trúc observability](architecture/05-observability-architecture.md)
- [Reliability engineering](architecture/06-reliability-engineering.md)
- [Tương tác thành phần nền tảng](architecture/07-platform-component-interactions.md)

## Triển khai và vòng đời phát hành

- [Nền tảng Terraform](deployment/01-terraform-foundation.md)
- [Nền tảng EKS](deployment/02-eks-platform.md)
- [GitOps và Argo CD](deployment/03-gitops-argocd.md)
- [Stack observability](deployment/04-observability-stack.md)
- [Progressive delivery](deployment/05-progressive-delivery.md)
- [Vòng đời triển khai](deployment/06-deployment-lifecycle.md)

## Vận hành và thực nghiệm SRE

- [SLI, SLO và SLA](operations/01-sli-slo-sla.md)
- [Error budget và burn rate](operations/02-error-budget-burn-rate.md)
- [Cảnh báo Prometheus](operations/03-prometheus-alerting.md)
- [Quản lý incident](operations/04-incident-management.md)
- [Runbook và postmortem](operations/05-runbook-postmortem.md)
- [Tự động remediation](operations/06-auto-remediation.md)
- [Resilience engineering](operations/07-resilience-engineering.md)
- [Chaos engineering](operations/08-chaos-engineering.md)
- [Performance engineering](operations/09-performance-engineering.md)
- [Capacity planning](operations/10-capacity-planning.md)
- [Autoscaling HPA, KEDA và Karpenter](operations/11-autoscaling-hpa-keda-karpenter.md)
- [Metrics và báo cáo SRE](operations/12-sre-metrics-and-reporting.md)

## Bảo mật và quyền truy cập

- [Kiến trúc bảo mật](security/01-security-architecture.md)
- [IAM và EKS Pod Identity](security/02-iam-pod-identity.md)
- [Quản lý Secret](security/03-secrets-management.md)
- [Cổng bảo mật DevSecOps](security/04-devsecops-security-gates.md)

## Sơ đồ Mermaid

- [Kiến trúc AWS EKS và ứng dụng](diagrams/platform-architecture.mmd)
- [Luồng Observability](diagrams/observability-flow.mmd)
- [Vòng đời Incident](diagrams/incident-response-flow.mmd)
- [Progressive Delivery](diagrams/progressive-delivery-flow.mmd)
- [Chaos Experiment](diagrams/chaos-experiment-flow.mmd)
- [Giải thích sơ đồ](diagrams/README.md)

## Kết hợp với labs/

`labs/` ở **gốc repository** được giữ nguyên là một thư mục duy nhất. Quy trình đề xuất: AWS Console → xác minh bằng CLI/metrics → lưu bằng chứng → viết Terraform → import state → reconcile plan → refactor modules → GitOps → kiểm thử tái dựng → cleanup. Không tự động chạy apply/destroy trên AWS.

## Nguyên tắc đánh giá và vận hành

- Số liệu thử nghiệm phải có nguồn, mốc thời gian, môi trường, cấu hình tải và phiên bản ứng dụng.
- Không thay thế user-facing SLI bằng trạng thái Pod Ready hoặc CPU usage.
- Không ghi expected output minh họa thành kết quả có thật.
- Chỉ thử lỗi phá hủy trong môi trường lab cô lập, có stop condition, rollback và giới hạn chi phí.
- Nội dung hiện là bản hướng dẫn nền tảng; cần bổ sung manifest và CLI chính xác theo phiên bản khi triển khai thật.

