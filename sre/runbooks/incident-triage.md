# Incident triage

1. Acknowledge the alert and create an incident ID in UTC.
2. Confirm impact using eligible request rate, error ratio, latency, and affected journey.
3. Check recent deployments, dependency saturation, and telemetry gaps.
4. Mitigate the smallest safe scope: abort/rollback canary, shed optional load, or scale within policy.
5. Verify user-facing SLI recovery for at least one observation window.
6. Capture evidence, communicate status, and open a postmortem for material incidents.

| Severity | Trigger example | Response target |
| --- | --- | --- |
| P1 | Broad user impact, fast burn >14.4x, data-loss risk | Page immediately; war room |
| P2 | Sustained severe degradation, burn >6x | Page on-call; lead review |
| P3 | Limited feature impact or backlog growth | Business-hours response |
| P4 | Internal warning without user impact | Queue and review |

MTTD is alert-firing to incident creation, MTTA is creation to acknowledgement, and MTTR is acknowledgement/mitigation start to verified recovery. Use timestamps from alert, incident system, deploy audit, and recovery query; never estimate.
