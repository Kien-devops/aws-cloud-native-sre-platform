import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Diagram, group, grid, icon, phantom, renderTree } from "drawio-ai-kit";

const d = new Diagram("network");

const az = (s) =>
  group(`az_${s}`, "group_availability_zone", `Availability Zone ${s.toUpperCase()}`, { dir: "col", gap: 32, align: "center" }, [
    group(`pub_${s}`, "group_subnet", `Public Subnet (${s})`, { dir: "row", gap: 16 }, [
      icon(`alb_${s}`, "application_load_balancer", `ALB Ingress (${s})`),
      icon(`nat_${s}`, "nat_gateway", `NAT Gateway (${s})`),
    ]),
    group(`prv_${s}`, "group_subnet", `Private App Subnet (${s})`, { dir: "row", gap: 16 }, [
      icon(`sys_node_${s}`, "ec2", `System Node (t3.medium)`),
      icon(`spot_node_${s}`, "ec2", `Karpenter Spot (c5.large)`),
    ]),
    group(`db_${s}`, "group_subnet", `Private Data Subnet (${s})`, { dir: "row", gap: 16 }, [
      icon(`rds_${s}`, "rds", s === "a" ? "RDS Postgres (16.3)" : "RDS Standby"),
      icon(`redis_${s}`, "elasticache", s === "a" ? "ElastiCache Redis (7.1)" : "Redis Replica"),
    ]),
  ]);

const tree = group("region", "group_region", "AWS Region: ap-southeast-1 (Singapore)", { dir: "col", gap: 20, align: "center" }, [
  group("vpc", "group_vpc", "VPC 10.0.0.0/16 (sre-platform-dev-vpc)", { dir: "col", gap: 20 }, [
    icon("igw", "internet_gateway", "Internet Gateway"),
    phantom("body", "", { dir: "row", gap: 40, align: "top", header: 0 }, [az("a"), az("b")]),
  ]),
  grid("services", null, "AWS Managed Platform Services & Governance", { cols: 4, gap: 20 }, [
    icon("sqs_queue", "sqs", "SQS Order Queue + DLQ"),
    icon("secrets_mgr", "secrets_manager", "AWS Secrets Manager"),
    icon("kms_key", "key_management_service", "KMS CMK (sre-platform-dev-main)"),
    icon("s3_endpoint", "s3", "S3 Gateway Endpoint"),
  ]),
]);

renderTree(d, tree, [40, 80]);
d.title("AWS Cloud-Native SRE Platform — Production Architecture (ap-southeast-1)");

d.link("igw", "alb_a", "HTTPS / 443", { role: "fanout" });
d.link("alb_a", "sys_node_a", "Forward to Pods", { dir: "TB" });
d.link("alb_a", "spot_node_a", "Traffic (TargetGroupBinding)", { dir: "TB" });
d.link("spot_node_a", "rds_a", "Port 5432 (KMS encrypted)", { dir: "TB" });
d.link("spot_node_a", "redis_a", "Port 6379 (Cache)", { dir: "TB" });
d.link("spot_node_a", "sqs_queue", "Publish Orders / Ingest", { dash: true });
d.link("spot_node_a", "secrets_mgr", "ESO Sync via Pod Identity", { dash: true });
d.link("secrets_mgr", "kms_key", "Envelope Encryption", { dash: true });
d.link("spot_node_a", "s3_endpoint", "Zero-cost S3 Gateway", { dash: true });

// EKS cluster: dashed orange frame spanning app subnets across both AZs
d.clusterBox("eks_cluster", ["prv_a", "prv_b"], "Amazon EKS Cluster v1.31 (sre-platform-dev-cluster)", { icon: "eks" });

const res = d.validate();
console.log("VALIDATE:", JSON.stringify({ ok: res.ok, errors: res.errors, warnings: res.warnings, advice: res.audit.advice }));

const outPath = fileURLToPath(new URL("./platform_architecture.drawio", import.meta.url));
writeFileSync(outPath, d.mxfile("SRE Platform Architecture"));
console.log("SAVED_DRAWIO:", outPath);
