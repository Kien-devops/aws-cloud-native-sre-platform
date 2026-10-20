# 03.05 (04) — Khởi tạo Amazon ElastiCache Redis Cluster và Chính sách Caching Resilience

> **Trạng thái:** Hướng dẫn thực hành chi tiết trên AWS Management Console (Console-first).  
> **Áp dụng cho:** Quản trị bộ nhớ đệm (In-Memory Cache), quản lý phiên làm việc và kiểm soát sự cố suy giảm dịch vụ (Graceful Degradation).

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Khởi tạo **ElastiCache Subnet Group** nằm trọn vẹn trong các Private Database Subnets (`ap-southeast-1a` và `ap-southeast-1b`).
  - Triển khai **Amazon ElastiCache for Redis (Cluster Mode Disabled)** với nút chính (Primary) và tùy chọn nút dự phòng (Read Replica) cấu hình Multi-AZ.
  - Bật mã hóa kép: **Transit Encryption (TLS)** cho đường truyền mạng và **At-Rest Encryption** cho dữ liệu lưu trữ với KMS CMK.
  - Kích hoạt cơ chế xác thực **Redis AUTH** sử dụng token đã được tạo trong AWS Secrets Manager (`REDIS_AUTH`).
  - Gắn Security Group `sre-platform-dev-db-sg` để chỉ mở cổng 6379 cho EKS Worker Nodes.
- **Nguyên tắc SRE:**
  - **Graceful Degradation & Fallback:** Ứng dụng ReliabilityShop phải áp dụng mô hình **Cache-Aside Pattern**. Khi Redis gặp sự cố hoặc bảo trì, ứng dụng không được phép crash; nó phải tự động fall-back truy vấn trực tiếp vào PostgreSQL (chấp nhận latency tăng nhẹ nhưng bảo toàn Availability).
  - **Eviction Policy & Memory Saturation:** Cấu hình chính sách giải phóng bộ nhớ (ví dụ: `volatile-lru` hoặc `allkeys-lru`) để tránh lỗi `OOM command not allowed when used memory > 'maxmemory'`.
  - **Throttling & Cache Stampede Defense:** Tránh việc hàng nghìn request đồng thời đổ dồn vào database khi một key quan trọng hết hạn (Cache Stampede).

---

## 2. Thông số đầu vào (Input Parameters)

| Tham số | Giá trị mẫu / Quy ước | Ý nghĩa |
| :--- | :--- | :--- |
| **Cluster Name** | `sre-platform-dev-redis` | Tên cụm Redis Cache |
| **Engine Version** | `Redis 7.x` (hoặc Valkey) | Phiên bản engine hỗ trợ TLS và ACL |
| **Node Type** | `cache.t4g.micro` | Cấu hình Graviton tiết kiệm chi phí cho dev |
| **Replicas** | `0` (Single-node cho dev) hoặc `1` (HA) | Số lượng bản sao đọc |
| **In-transit Encryption**| `Enabled` (TLS: Yes) | Bắt buộc mã hóa lưu lượng giữa Pods và Redis |
| **At-rest Encryption** | `Enabled` (KMS: Yes) | Mã hóa dữ liệu bộ nhớ đệm khi ghi xuống disk/swap |
| **Redis AUTH Token** | Lấy từ Secrets Manager (`REDIS_AUTH`) | Chuỗi mật khẩu xác thực kết nối |
| **Port** | `6379` | Cổng tiêu chuẩn của Redis |

---

## 3. Các bước thực hiện chi tiết trên AWS Console (Console Steps)

### Bước 1: Khởi tạo ElastiCache Subnet Group

1. Mở ô tìm kiếm Console -> Nhập `ElastiCache` -> Chọn dịch vụ **Amazon ElastiCache**.
2. Tại menu bên trái, nhấp vào **Subnet groups** -> Nhấp nút cam **Create subnet group**.
3. **Subnet group details:**
   - **Name:** Nhập `sre-platform-dev-redis-subnet-group`.
   - **Description:** `Subnet group for dev Redis cache`.
   - **VPC:** Chọn `sre-platform-dev-vpc`.
4. **Subnets:**
   - Chọn 2 AZs: `ap-southeast-1a` và `ap-southeast-1b`.
   - Tích chọn 2 Private Database Subnets (`10.0.20.0/24` và `10.0.21.0/24`).
5. Nhấp nút **Create**.

---

### Bước 2: Tạo Cụm ElastiCache Redis

1. Tại menu bên trái của ElastiCache Console, chọn **Redis clusters** (hoặc ElastiCache clusters).
2. Nhấp nút cam **Create cluster** -> Chọn **Create Redis cluster**.
3. **Cluster engine:**
   - Chọn radio button **Redis OSS** (hoặc Valkey).
4. **Cluster mode:**
   - Chọn **Cluster mode disabled** (Phù hợp cho môi trường dev/staging quy mô nhỏ, đơn giản hóa endpoint kết nối).
5. **Cluster info:**
   - **Cluster name:** Nhập `sre-platform-dev-redis`.
   - **Description:** `Redis cache cluster for ReliabilityShop`.
   - **Node type:** Chọn `cache.t4g.micro`.
   - **Number of replicas:** Chọn `0` (cho môi trường dev tiết kiệm chi phí; chọn `1` kèm Multi-AZ nếu kiểm thử failover).
6. **Connectivity:**
   - **Subnet group:** Chọn `sre-platform-dev-redis-subnet-group` vừa tạo.
   - **VPC Security Group:**
     - Bỏ chọn default SG.
     - Tích chọn `sre-platform-dev-db-sg` (đã mở cổng 6379 từ EKS Node Group).
7. **Security settings (Mã hóa và Xác thực):**
   - **Encryption at rest:** Tích chọn **Enabled** -> Chọn KMS Customer Managed Key `alias/sre-platform-dev-main`.
   - **Encryption in-transit:** Tích chọn **Enabled** (Bắt buộc dùng TLS).
   - **Redis AUTH default user:** Tích chọn **Require token**.
     - Nhập chuỗi mật khẩu mạnh đã lưu trong Secrets Manager (`REDIS_AUTH` từ Lab 05.01).
8. **Tags:** Thêm `Environment` = `dev`, `Project` = `sre-platform`, `Component` = `cache`.
9. Nhấp nút **Next** -> Xem lại tổng quan -> Nhấp **Create**.
10. Quá trình tạo Redis Cluster mất khoảng 5-10 phút. Chờ trạng thái chuyển sang **Available**.

---

## 4. Xác minh và Kiểm tra Kết nối (Verification)

### 4.1. Lấy Primary Endpoint từ Console
1. Trong danh sách **Redis clusters**, nhấp vào `sre-platform-dev-redis`.
2. Tại bảng **Details**, sao chép:
   - **Primary Endpoint:** Dạng `sre-platform-dev-redis.xxxxxx.0001.apse1.cache.amazonaws.com`.
   - **Port:** `6379`.
   - **Encryption in-transit:** `Yes`.
   - **AUTH enabled:** `Yes`.

### 4.2. Kiểm tra bằng AWS CLI
```bash
aws elasticache describe-cache-clusters \
  --cache-cluster-id sre-platform-dev-redis-001 \
  --show-cache-node-info \
  --query 'CacheClusters[0].{Status:CacheClusterStatus,NodeType:CacheNodeType,Engine:Engine,Endpoint:Endpoint.Address,Port:Endpoint.Port}' \
  --output table
```

### 4.3. Kiểm thử Kết nối An toàn (TLS + AUTH) từ Worker Pod
```bash
# Lệnh kiểm thử từ một pod bên trong EKS cluster
redis-cli -h <REDIS_PRIMARY_ENDPOINT> -p 6379 --tls -a <REDIS_AUTH_TOKEN> ping
# Kết quả mong đợi: PONG
```

---

## 5. Chuyển giao sang IaC (Terraform Snippet)

```hcl
resource "aws_elasticache_subnet_group" "redis" {
  name       = "sre-platform-dev-redis-subnet-group"
  subnet_ids = [aws_subnet.private_db_1a.id, aws_subnet.private_db_1b.id]
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "sre-platform-dev-redis"
  description          = "Redis cache cluster for ReliabilityShop"
  engine               = "redis"
  engine_version       = "7.1"
  node_type            = "cache.t4g.micro"
  port                 = 6379

  subnet_group_name  = aws_elasticache_subnet_group.redis.name
  security_group_ids = [aws_security_group.db.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = var.redis_auth_token
  kms_key_id                 = data.aws_kms_key.main.arn

  num_cache_clusters = 1

  tags = {
    Environment = "dev"
    Project     = "sre-platform"
  }
}
```

---

## 6. Điều kiện hoàn thành Gate (Gate Check)

- [ ] Cụm Redis `sre-platform-dev-redis` ở trạng thái `Available`.
- [ ] Subnet group gắn đúng vào các Private Database Subnets.
- [ ] Bật đầy đủ cả `Transit Encryption (TLS)` và `At-Rest Encryption`.
- [ ] Tính năng xác thực Redis AUTH được bật với token từ Secrets Manager.
- [ ] Cổng 6379 chỉ cho phép kết nối nội bộ từ EKS Worker Nodes.

---

## 7. Dọn dẹp tài nguyên (Cleanup)

1. Vào **ElastiCache Console** -> **Redis clusters** -> Chọn `sre-platform-dev-redis`.
2. Nhấp **Actions** -> Chọn **Delete**.
3. **Create final backup?** Chọn **No** -> Nhấp **Delete**.
4. Vào **Subnet groups** -> Xóa `sre-platform-dev-redis-subnet-group`.
