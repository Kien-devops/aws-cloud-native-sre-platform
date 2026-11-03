# Monitoring Platform GitOps

## Status

`DEPLOYED & GITOPS ACTIVE` — Quản lý toàn bộ hạ tầng Observability bao gồm OpenTelemetry Collector, Grafana Loki, Grafana Tempo, Grafana Dashboards as Code, Ingress chia sẻ và Prometheus Alerting Rules.

## Components Managed

| Thành phần | Manifest | Loại (Kind) | Chức năng |
| :--- | :--- | :--- | :--- |
| **Namespace** | `namespace.yaml` | `Namespace` | Không gian tên cô lập `monitoring`. |
| **OpenTelemetry Collector** | `otel-collector.yaml` | `ConfigMap`, `Deployment`, `Service` | Telemetry Hub tiếp nhận OTLP 4317/4318, xử lý batch, lọc dữ liệu nhạy cảm và export tới Tempo, Loki, Prometheus. |
| **Loki & Tempo** | `loki-tempo.yaml` | `ConfigMap`, `Deployment`, `Service` | Lưu trữ Logs phân tán và Distributed Traces với local persistent storage. |
| **Grafana Platform** | `grafana.yaml` | `ConfigMap` (Datasources/Dashboards), `Deployment`, `Service`, `Ingress` | Giao diện trực quan hóa SRE Dashboards as Code, Ingress chia sẻ ALB `sre-platform` tại `grafana.dev.devopsss.site`. |
| **Prometheus Rules** | `prometheus-rules.yaml` | `ServiceMonitor`, `PrometheusRule`, `AlertmanagerConfig` | Cào metric OTel Collector 8889, Multi-Window Multi-Burn-Rate alerting và routing thông báo Pager/Webhook. |

## Verification

Toàn bộ tài nguyên được đồng bộ hóa tự động qua ArgoCD Application `platform-infrastructure`.
