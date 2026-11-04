import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Diagram, grid, icon, renderTree } from "drawio-ai-kit";

const d = new Diagram("pipeline");

const tree = grid("stages", null, "End-to-End GitOps Continuous Delivery & Progressive Rollout Pipeline", { cols: 4, gap: 32 }, [
  grid("stage_ci", null, "1. CI & Image Governance", { cols: 1, gap: 16 }, [
    icon("git_code", "github", "GitHub Repository (dev/main)"),
    icon("ci_runner", "docker", "GitHub Actions CI (Build & Scan)"),
    icon("ecr_repo", "ecr", "Amazon ECR (Immutable SHA tags)"),
  ]),
  grid("stage_gitops", null, "2. Declarative Desired State", { cols: 1, gap: 16 }, [
    icon("git_manifests", "github", "GitOps Manifests (gitops/)"),
    icon("argo_root", "kubernetes", "Argo CD Root App-of-Apps"),
    icon("argo_sync", "kubernetes", "Argo CD Controller (Self-Heal: 10s)"),
  ]),
  grid("stage_runtime", null, "3. Progressive Delivery", { cols: 1, gap: 16 }, [
    icon("rollout_ctrl", "kubernetes", "Argo Rollouts (Canary Controller)"),
    icon("canary_pods", "ec2", "Canary Pods (20% Weight)"),
    icon("stable_pods", "ec2", "Stable Workloads (80% Weight)"),
  ]),
  grid("stage_sre", null, "4. Real-time Analysis & Gate", { cols: 1, gap: 16 }, [
    icon("otel_collector", "ec2", "OpenTelemetry Collector"),
    icon("prom_engine", "prometheus", "Prometheus SLI Metric Analysis"),
    icon("grafana_gauge", "grafana", "Error Budget Burn Rate Monitor"),
  ]),
]);

renderTree(d, tree, [40, 80]);
d.title("GitOps Delivery & Progressive Canary Rollout Pipeline");

d.link("git_code", "ci_runner", "Push Trigger");
d.link("ci_runner", "ecr_repo", "Push Image Digest");
d.link("ecr_repo", "git_manifests", "Update Image Tag in Git");
d.link("git_manifests", "argo_root", "Webhook / Polling");
d.link("argo_root", "argo_sync", "Reconcile Apps");
d.link("argo_sync", "rollout_ctrl", "Sync Rollout Spec");
d.link("rollout_ctrl", "canary_pods", "Route 20% traffic");
d.link("canary_pods", "otel_collector", "Export Metrics & Traces");
d.link("otel_collector", "prom_engine", "Scrape / Remote Write");
d.link("prom_engine", "rollout_ctrl", "SLI Evaluation (5xx < 1%)", { dash: true });
d.link("prom_engine", "grafana_gauge", "Visualize SLI / SLO Gauges");

const res = d.validate();
console.log("VALIDATE:", JSON.stringify({ ok: res.ok, errors: res.errors, warnings: res.warnings, advice: res.audit.advice }));

const outPath = fileURLToPath(new URL("./gitops_pipeline.drawio", import.meta.url));
writeFileSync(outPath, d.mxfile("GitOps Progressive Delivery Pipeline"));
console.log("SAVED_DRAWIO:", outPath);

