# Observability manifests

Offline-ready Kubernetes manifests for the telemetry path:

```text
App3 OTLP -> OTel Collector -> Prometheus / Loki / Tempo -> Grafana
                                      |
                                      +-> PrometheusRule -> Alertmanager
```

The manifests target the `monitoring` namespace and assume Prometheus Operator and Grafana are installed by the platform GitOps layer. They do not create AWS resources or store credentials. `alertmanager-notifications` must be populated by External Secrets/Secrets Manager before enabling webhook notifications.

Metric recording rules expect `http_requests_total` and `http_request_duration_seconds_bucket`. If App3 exposes different names, adapt the rules after confirming its `/metrics` contract; no synthetic metrics are provided.

Status: IMPLEMENTED (static manifests); VALIDATED LOCALLY means YAML/JSON parsing only. Runtime scrape, traces, logs, alert routing and retention remain REQUIRES AWS/Kubernetes.
