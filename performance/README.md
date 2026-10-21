# Performance Engineering

Status: scripts and calculators are `IMPLEMENTED`; runtime results are `REQUIRES AWS` until an approved target, fixed application revision, and telemetry evidence exist.

## k6

Profiles use the App3 contract documented in the Labs: `GET /health`, `GET /api/v1/products`, and optional `POST /api/v1/orders` when `RUN_WRITE_TEST=true`. App3 currently contains empty source files, so paths remain overrideable. The write journey is fail-closed.

```powershell
$env:BASE_URL = 'https://<approved-host>'
$env:AUTH_TOKEN = '<short-lived-token>'
$env:RUN_WRITE_TEST = 'false'
k6 run performance/k6/smoke/smoke.js --summary-export artifacts/smoke.json
```

Profiles: `load/load.js`, `stress/stress.js`, `spike/spike.js`, `soak/soak.js`. Stress, spike, and soak require an explicit test window and approval. Defaults are test guardrails, not measured SLO evidence.

## Capacity and comparison

```powershell
python performance/capacity-planning/calculate.py --peak-rps 600 --sustainable-rps-per-replica 80 --headroom-percent 30
python performance/benchmarks/compare.py --baseline artifacts/baseline.json --candidate artifacts/candidate.json
```

Keep raw k6 JSON, commit SHA, region, node type, dataset, and telemetry snapshot with each run. Missing values remain `NOT_MEASURED`.
