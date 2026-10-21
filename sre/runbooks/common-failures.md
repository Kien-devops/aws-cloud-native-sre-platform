# Common failure runbook

## Preconditions

Capture UTC start time, alert labels, cluster/context, namespace, workload/version, and a read-only evidence bundle before changing state. Never paste tokens, secrets, or full account identifiers into evidence.

## Diagnostic matrix

| Symptom | Read-only checks | Safe mitigation | Verify |
| --- | --- | --- | --- |
| CrashLoopBackOff | `kubectl -n <ns> describe pod <pod>`; `kubectl -n <ns> logs <pod> --previous` | Roll back the recent GitOps revision only after approval | New pod Ready; restarts stable; SLI recovers |
| Pod Pending | `kubectl -n <ns> describe pod <pod>`; `kubectl get nodes`; events | Correct resource request or capacity through reviewed GitOps change | Scheduled pod and no pending backlog |
| Node NotReady | `kubectl describe node <node>`; events; workload distribution | Cordon/drain only under approved maintenance procedure | Replacement capacity Ready; workloads healthy |
| High HTTP 5xx | Prometheus error ratio; recent deploy; logs/traces; dependency health | Abort canary or rollback immutable image; protect DB/queue from retry storm | 5xx and burn rate below thresholds |
| High p95 latency | RED metrics; trace critical path; DB pool/connections; queue age | Roll back regression or shed optional work; do not blindly restart | p95, saturation, and error rate recover |
| Node capacity exhaustion | Pending reason; allocatable vs requests; Karpenter events | Reviewed node capacity change or reduce noncritical load | Pending pods schedule; headroom restored |
| SQS backlog | Queue depth/age, consumer errors, DLQ, downstream saturation | Scale consumers within approved limits; protect downstream | Age decreases; DLQ stable |
| Failed deployment/canary | Rollout status, AnalysisRun, image digest, events | Abort/rollback to last known-good digest | Rollout healthy; GitOps synced |
| OTel Collector failure | Collector pods, exporter queue, self-metrics, events | Restore collector config through GitOps; sample temporarily if approved | Telemetry export resumes without queue growth |
| Prometheus scrape failure | `up`, target health, ServiceMonitor labels/endpoints | Fix selector/endpoint through GitOps | Target up and rule evaluation succeeds |
| Loki ingestion failure | Loki distributor/ingester health, agent output, storage errors | Restore backend/agent path; avoid unbounded local buffering | New logs queryable with trace IDs |
| Tempo traces missing | Collector exporter errors; Tempo distributor/ingester health | Restore OTLP path; reduce sampling only as approved | New trace searchable and linked to logs |
| Alertmanager notification failure | Alertmanager status, route labels, receiver secret reference | Repair secret/reference through approved change; retain alerts | Test alert delivered and resolved |

## Verification and escalation

Record before/after query results, rollout revision, timestamps, and user impact. Escalate P1 immediately for broad checkout failure, data-loss risk, or fast burn; escalate P2 for sustained severe degradation. Do not claim recovery from pod readiness alone: verify user-facing SLI.
