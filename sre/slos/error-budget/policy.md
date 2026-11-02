# Error budget policy

Status: proposed. Runtime values are `NOT_MEASURED` until Prometheus evidence is attached.

For a 99.9% availability SLO, the allowed bad-event ratio is 0.001. Remaining budget is:

```text
1 - observed_bad_events / (eligible_events * 0.001)
```

Policy:

| Remaining budget | Release guidance |
| --- | --- |
| >50% | Normal review and canary process |
| 20-50% | Reliability review required before risky promotion |
| <20% | Reliability work prioritized; risky releases require explicit approval |
| <=0% | Feature freeze; permit reliability fixes and approved rollback |

Burn-rate pages require both a short and long window plus a minimum traffic guard. A missing scrape, zero denominator, or unvalidated alert does not justify an automatic release block. Release decisions require the query, window, UTC timestamps, owner, and evidence link.
