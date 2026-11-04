# SRE Incident Drill Report: Automated Canary Abort & Instant Rollback

## 5. Báo cáo Thực tế Diễn tập Sự cố SRE (Actual Incident Drill Report)

Dữ liệu ghi nhận thực tế từ đợt diễn tập trên cụm EKS `sre-platform-dev` (được lưu giữ tại `sre/incidents/drill-canary-abort.md`):

```text
================================================================================
               SRE INCIDENT DRILL REPORT: CANARY AUTO-ABORT & ROLLBACK
================================================================================
Timestamp:               2026-11-04T16:31:50Z (23:31:50 GMT+7)
Target Cluster:          sre-platform-dev (Amazon EKS v1.31)
Target Namespace:        reliability-shop (dev)
Target Workload:         Rollout/order-service
Canary Target Revision:  Revision 6 (Image: 123456789012.dkr.ecr.ap-southeast-1.amazonaws.com/reliabilityshop/order-service:git-v1.0.1)
Stable Baseline Revision:Revision 5 (Image Digest: sha256:5107d6e6072102b3c38c38b9d9a052b1c461ff7dbc9717ec1c672a31a292f916)
Traffic Weight at Fault: 20% (Step 1 Canary Phase - 1 Canary Pod vs 4 Stable Pods)

--- SRE TELEMETRY & PROMETHEUS METRICS ---
Telemetry Engine:        OpenTelemetry Auto-Instrumentation (Node.js) -> OTel Collector -> Prometheus Core
Metric 1 (Error Rate):   otel_http_server_duration_milliseconds_count{exported_job="order-service", http_status_code=~"5.."}
                         PromQL: (sum(rate(5xx[1m])) or vector(0)) / (sum(rate(total[1m])) or vector(1))
                         Threshold: <= 0.5% (0.005) | Measured Normal: 0.0% | Violation Level: 20.0%
Metric 2 (p95 Latency):  otel_http_server_duration_milliseconds_bucket{exported_job="order-service"}
                         PromQL: histogram_quantile(0.95, sum(rate(bucket[1m])) by (le)) or vector(50)
                         Threshold: <= 300ms | Measured Baseline: 4.75ms (Pass ✔)
Analysis Evaluation:     Interval: 30s | Failure Limit: 2 consecutive intervals

--- TIMING & RECOVERY METRICS ---
Time to Detect (MTTD):   < 60 seconds (2 measurement cycles)
Time to Recover (MTTR):  < 5 seconds (Instant traffic weight cutback to 0%)
Canary Pod Scale-down:   Immediate (order-service-84dc868ccd scaled down to 0)
Blast Radius:            Strictly bounded to 20% of order-service; 0% impact on auth, frontend, inventory, worker
Error Budget Impact:     Consumed 0.02% of monthly budget (Minimal SLO burn)

--- TERMINAL VERIFICATION EVIDENCE ---
1. Trạng thái Abort tức thì (RolloutAborted):
   Name:            order-service
   Namespace:       reliability-shop
   Status:          ✖ Degraded
   Message:         RolloutAborted: Rollout aborted update to revision 6
   Strategy:        Canary
     Step:          0/4
     SetWeight:     0
     ActualWeight:  0
   Replicas:        Desired: 5, Current: 5, Updated: 0, Ready: 5, Available: 5
   ├──# revision:6  ReplicaSet order-service-84dc868ccd  • ScaledDown (canary 0/0)
   └──# revision:5  ReplicaSet order-service-7db69fb48   ✔ Healthy    (stable 5/5 ready)

2. Phục hồi hoàn nguyên sạch (Clean Undo Recovery):
   Command:         kubectl argo rollouts undo order-service -n reliability-shop
   Rollout Status:  ✔ Healthy (Revision 7 promoted to Active Stable, SetWeight: 100, ActualWeight: 100)
   GitOps Status:   All 4 Argo CD Applications Synced & Healthy (100% green)
================================================================================
```
