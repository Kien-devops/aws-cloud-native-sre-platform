# 03.04 — Amazon ElastiCache for Redis (TLS In-Memory Cache)

> **Phạm vi:** Cache-Aside & Sub-Millisecond Reads | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Private & TLS Encrypted:** Chỉ nằm trong Private DB Subnets, bật `TransitEncryptionEnabled = true` (TLS 6379) và `AtRestEncryptionEnabled = true`.
- **Graceful Degradation:** Ứng dụng (`order-service`) dùng mô hình Cache-Aside với fallback tự động sang RDS PostgreSQL nếu Redis không phản hồi.

---

## 2. Đặc tả Tài nguyên (Resource Inventory & Config)

| Resource Type | Tên Resource (Naming) | Tham số Cấu hình Cốt lõi |
| :--- | :--- | :--- |
| **Cache Subnet Group** | `sre-platform-dev-redis-subnet-group` | Subnets: `private-db-1a`, `private-db-1b` |
| **Replication Group** | `sre-platform-dev-redis` | Engine: `Redis 7.1`, Node Type: `cache.t4g.micro`, Port: `6379`, `TransitEncryptionEnabled = true`, `AtRestEncryptionEnabled = true`, Security Group: `sre-platform-dev-db-sg` |
| **Primary Endpoint** | `master.sre-platform-dev-redis.*.apse1.cache.amazonaws.com:6379` | Chỉ phân giải Private IP nội bộ VPC |

---

## 3. Chiến lược Tagging & Labels

| Tag Key | Tag Value | Mục đích |
| :--- | :--- | :--- |
| `Name` | `sre-platform-dev-redis` | Định danh Redis cluster |
| `Project` | `sre-platform` | Phân bổ chi phí Cache |
| `Environment` | `dev` | Cô lập môi trường |
| `Component` | `cache` | Tầng bộ nhớ đệm |

---

## 4. Tham chiếu IaC / GitOps
- [kustomization.yaml](../../gitops/applications/reliability-shop/base/kustomization.yaml#L29-L31) — `REDIS_HOST`, `REDIS_PORT=6379`, `REDIS_TLS=true`.

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
```bash
aws elasticache describe-replication-groups --replication-group-id sre-platform-dev-redis --region ap-southeast-1 --query "ReplicationGroups[0].{Status:Status,TLS:TransitEncryptionEnabled,AtRest:AtRestEncryptionEnabled}"
```
- **PASS:** `Status = available`, `TransitEncryptionEnabled = true`, `AtRestEncryptionEnabled = true`.
