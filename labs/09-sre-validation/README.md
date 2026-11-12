# Module 09 — SRE Validation, Performance & Chaos Engineering

> **Phạm vi:** SLI/SLO Governance, k6 Load Testing, Chaos GameDay & Go-Live Gate | **Region:** `ap-southeast-1`

Module 09 đặc tả bộ tiêu chuẩn kiểm chứng độ tin cậy dựa trên số liệu thực tế (Evidence-Based SRE): đo lường SLI/SLO, kiểm thử tải k6 in-cluster, diễn tập phá vỡ có kiểm soát (Chaos GameDay) và tiêu chí nghiệm thu Go-Live.

---

## Danh sách Đặc tả

| Mã | Tài liệu | Nội dung Chính |
| :--- | :--- | :--- |
| `09.01` | [Platform Smoke Baseline](01-platform-smoke.md) | Kiểm tra toàn bộ Pods, ALB, DB, Redis, SQS trước khi chạy tải |
| `09.02` | [SLI / SLO & Error Budget](02-sli-slo-error-budget.md) | Availability `99.9%`, P95 `< 500ms`, Error Budget Policy |
| `09.03` | [k6 In-Cluster Load Test](03-k6-baseline.md) | Kịch bản Smoke, Load, Stress, Spike (2,712 reqs, 0.00% 5xx) |
| `09.04` | [Pod Resilience & PDB](04-resilience-test.md) | PodDisruptionBudget (`minAvailable: 1`) & Pod Kill Recovery |
| `09.05` | [Chaos GameDay Scenarios](05-chaos-gameday.md) | EC2 Worker Termination (`< 60s` recovery) & SQS Poison Pill DLQ |
| `09.06` | [Incident Runbooks & Postmortem](06-incident-runbook.md) | Quy trình triage sự cố & Blameless Postmortem |
| `09.07` | [Go-Live Acceptance Gate](07-go-live-gate.md) | Ma trận tiêu chí kỹ thuật bắt buộc trước khi bàn giao |
