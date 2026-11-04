import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Diagram, grid, group, icon, phantom, renderTree } from "drawio-ai-kit";

const d = new Diagram("hubspoke");

const tree = group("chaos_scope", null, "SRE Chaos Engineering & High Availability Resilience Testbed", { dir: "col", gap: 24, align: "center" }, [
  grid("load_tier", null, "1. Load Injection & Entrypoint", { cols: 2, gap: 24 }, [
    icon("k6_engine", "ec2", "k6 Load Generator (45-68 RPS)"),
    icon("alb_entry", "application_load_balancer", "ALB Ingress (AWS LBC TargetGroup)"),
  ]),
  phantom("compute_body", "", { dir: "row", gap: 40, align: "top", header: 0 }, [
    group("node_killed", "group_subnet", "Fault Injection Target (AZ-1a)", { dir: "col", gap: 16 }, [
      icon("ec2_victim", "ec2", "EC2 Worker Node (TERMINATED)"),
      icon("pod_victim", "kubernetes", "Order Service Pod (Evicted)"),
    ]),
    group("node_survivor", "group_subnet", "High Availability Survivor (AZ-1b)", { dir: "col", gap: 16 }, [
      icon("ec2_healthy", "ec2", "EC2 Worker Node (Healthy 100%)"),
      icon("pod_survivor", "kubernetes", "Order Service Pod (PDB Protected)"),
    ]),
    group("karpenter_heal", "group_subnet", "Auto-Remediation (<60s)", { dir: "col", gap: 16 }, [
      icon("karpenter_ctrl", "kubernetes", "Karpenter Controller (NodePool)"),
      icon("ec2_replacement", "ec2", "Replacement EC2 Node (Spot c5.large)"),
    ]),
  ]),
  grid("data_tier", null, "3. Fault-Tolerant Data & Messaging Layer", { cols: 3, gap: 24 }, [
    icon("redis_cache", "elasticache", "Redis (Cache Fallback Active)"),
    icon("postgres_db", "rds", "RDS PostgreSQL (Multi-AZ)"),
    icon("sqs_dlq", "sqs", "SQS Dead Letter Queue (Poison Isolation)"),
  ]),
]);

renderTree(d, tree, [40, 80]);
d.title("SRE Chaos GameDay — EC2 Termination & Auto-Recovery Under Load");

d.link("k6_engine", "alb_entry", "Continuous HTTP Traffic (4,023 reqs)");
d.link("alb_entry", "pod_victim", "Traffic Split 50%");
d.link("alb_entry", "pod_survivor", "Traffic Split 50% (PDB: minAvailable 1)");
d.link("ec2_victim", "pod_victim", "Simulated Crash (Terminate Node)", { dash: true });
d.link("alb_entry", "pod_survivor", "100% Traffic Shift (0 Dropped Reqs)", { dir: "TB" });
d.link("karpenter_ctrl", "ec2_replacement", "Provisions Node in < 60s", { dir: "TB" });
d.link("pod_survivor", "redis_cache", "Read Cache Hit (1.2ms)");
d.link("pod_survivor", "postgres_db", "Write Transactions (ACID)");
d.link("pod_survivor", "sqs_dlq", "Poison Pill Isolated to DLQ", { dash: true });

const res = d.validate();
console.log("VALIDATE:", JSON.stringify({ ok: res.ok, errors: res.errors, warnings: res.warnings, advice: res.audit.advice }));

const outPath = fileURLToPath(new URL("./sre_resilience_chaos.drawio", import.meta.url));
writeFileSync(outPath, d.mxfile("SRE Resilience & Chaos GameDay"));
console.log("SAVED_DRAWIO:", outPath);

