# SRE runbooks

All commands are diagnostic by default. Confirm namespace, workload, cluster, and change window before mutations. GitOps remains the source of truth; record approval and evidence for rollback or scaling actions.

Available runbooks:

- [common-failures.md](common-failures.md): CrashLoopBackOff, Pending, NodeNotReady, 5xx, latency, capacity, queue, deployment, and telemetry failures.
- [incident-triage.md](incident-triage.md): severity, acknowledge, triage, mitigate, verify, escalate.
