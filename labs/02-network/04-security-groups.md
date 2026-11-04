# 02.04 — Thiết lập Ma trận Phân quyền Security Groups (Defense-in-Depth)

> **Trạng thái:** Hướng dẫn thực hành chi tiết trên AWS Management Console (Console-first).  
> **Áp dụng cho:** Thiết kế tường lửa phân tầng (Microsegmentation), ngăn chặn truy cập trái phép giữa các lớp Ingress, Compute và Data.

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Khởi tạo hệ thống **Security Groups (SG)** có tham chiếu chéo (Cross-Referenced Security Groups) thay vì dựa vào dải IP tĩnh (CIDR Blocks).
  - Triển khai mô hình 4 tầng phòng thủ:
    1. **ALB Security Group:** Tiếp nhận traffic Internet (Cổng 80/443).
    2. **EKS Cluster Security Group:** Bảo vệ EKS Control Plane (Cổng 443 API Server).
    3. **EKS Node Security Group:** Nhận traffic từ ALB và giao tiếp nội bộ giữa các Pods (Kubelet, VXLAN, CNI).
    4. **Database Security Group:** Chỉ cho phép kết nối từ Node Security Group tới PostgreSQL (5432) và Redis (6379).
- **Nguyên tắc SRE:**
  - **Zero Trust Microsegmentation:** Không tin tưởng bất kỳ kết nối nào trong cùng VPC. Từng service chỉ được phép mở cổng đúng giao thức nghiệp vụ.
  - **Dynamic Group Referencing (Không hardcode IP):** Khi EKS scale thêm hàng chục nodes mới, các nodes tự động kế thừa quyền truy cập Database thông qua Security Group ID mà không cần cập nhật lại firewall rules.
  - **Egress Lockdown for Data Layer:** Database SG không được phép mở bất kỳ egress rule nào ra Internet hoặc các subnet không liên quan.

---

## 2. Ma trận Ma trận Tường lửa (Security Groups Matrix)

| Security Group | Inbound Rules | Outbound Rules |
| :--- | :--- | :--- |
| **`sre-platform-dev-alb-sg`** | • TCP 80 từ `0.0.0.0/0`<br>• TCP 443 từ `0.0.0.0/0` | • Tất cả traffic tới `sre-platform-dev-node-sg` |
| **`sre-platform-dev-cluster-sg`** | • TCP 443 từ `sre-platform-dev-node-sg`<br>• TCP 443 từ Admin IP | • TCP 10250 & NodePorts tới `sre-platform-dev-node-sg` |
| **`sre-platform-dev-node-sg`** | • Tất cả traffic từ `sre-platform-dev-alb-sg`<br>• Tất cả traffic từ chính nó (`self`) cho Pod overlay<br>• TCP 443 & 10250 từ `cluster-sg` | • `0.0.0.0/0` (Egress qua NAT Gateway) |
| **`sre-platform-dev-db-sg`** | • TCP 5432 (PostgreSQL) từ `sre-platform-dev-node-sg`<br>• TCP 6379 (Redis) từ `sre-platform-dev-node-sg` | • Không có (None) |

---

## 3. Các bước thực hiện chi tiết trên AWS Console (Console Steps)

### Bước 1: Tạo ALB Security Group (`alb-sg`)

1. Mở ô tìm kiếm Console -> Nhập `EC2` -> Chọn dịch vụ **EC2**.
2. Tại menu bên trái, mục **Network & Security**, nhấp vào **Security Groups**.
3. Nhấp nút cam **Create security group**.
4. **Basic details:**
   - **Security group name:** `sre-platform-dev-alb-sg`.
   - **Description:** `Public ALB Security Group for HTTP and HTTPS`.
   - **VPC:** Chọn `sre-platform-dev-vpc`.
5. **Inbound rules:**
   - Rule 1: **Type:** `HTTP` (80) — **Source:** `0.0.0.0/0`.
   - Rule 2: **Type:** `HTTPS` (443) — **Source:** `0.0.0.0/0`.
6. Nhấp **Create security group**. Ghi lại ID (ví dụ `sg-alb...`).

---

### Bước 2: Tạo EKS Node Security Group (`node-sg`)

1. Quay lại danh sách **Security Groups** -> Nhấp **Create security group**.
2. **Basic details:**
   - **Security group name:** `sre-platform-dev-node-sg`.
   - **Description:** `Security Group for EKS Worker Nodes and Pods`.
   - **VPC:** Chọn `sre-platform-dev-vpc`.
3. **Inbound rules:**
   - Rule 1 (Nhận traffic từ ALB):
     - **Type:** `All traffic` (hoặc Custom TCP `1025-65535`).
     - **Source:** Chọn `Custom` -> Nhập ID của `sre-platform-dev-alb-sg`.
     - **Description:** `Allow all traffic from ALB`.
4. **Outbound rules:** Giữ mặc định `All traffic` ra `0.0.0.0/0`.
5. Nhấp **Create security group**. Ghi lại ID (ví dụ `sg-node...`).

---

### Bước 3: Thêm Rule Giao tiếp Nội bộ (Self-Referencing) cho `node-sg`

1. Chọn `sre-platform-dev-node-sg` vừa tạo.
2. Chọn tab **Inbound rules** -> Nhấp **Edit inbound rules**.
3. Nhấp **Add rule**:
   - **Type:** `All traffic`.
   - **Source:** Chọn `Custom` -> Nhập chính ID của `sre-platform-dev-node-sg` (`self`).
   - **Description:** `Allow nodes and pods to communicate internally`.
4. Nhấp **Save rules**.

---

### Bước 4: Tạo Database Security Group (`db-sg`)

1. Nhấp **Create security group**.
2. **Basic details:**
   - **Security group name:** `sre-platform-dev-db-sg`.
   - **Description:** `Security Group for RDS PostgreSQL and ElastiCache Redis`.
   - **VPC:** Chọn `sre-platform-dev-vpc`.
3. **Inbound rules:**
   - Rule 1 (PostgreSQL):
     - **Type:** `PostgreSQL` (Port 5432).
     - **Source:** Chọn `Custom` -> Nhập ID của `sre-platform-dev-node-sg`.
     - **Description:** `Allow PostgreSQL access from EKS worker nodes only`.
   - Rule 2 (Redis):
     - **Type:** `Custom TCP` (Port 6379).
     - **Source:** Chọn `Custom` -> Nhập ID của `sre-platform-dev-node-sg`.
     - **Description:** `Allow Redis cache access from EKS worker nodes only`.
4. **Outbound rules:**
   - Xóa bỏ rule mặc định `All traffic 0.0.0.0/0` để ngăn database kết nối ra ngoài trái phép.
5. Nhấp **Create security group**.

---

## 4. Xác minh (Verification)

Chạy lệnh kiểm tra các liên kết phụ thuộc giữa các Security Groups:

```bash
# Kiểm tra Inbound Rules của Database Security Group
aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=sre-platform-dev-db-sg" \
  --query 'SecurityGroups[0].IpPermissions[*].{Port:FromPort,Protocol:IpProtocol,SourceSG:UserIdGroupPairs[*].GroupId}' \
  --output table
```

**Kết quả mong đợi:**
- Port 5432 và Port 6379 chỉ có nguồn duy nhất là Group ID của `node-sg`.
- Không có bất kỳ dải IP CIDR nào (`0.0.0.0/0` hay public IP) được cấp quyền vào Database.

---

## 5. Chuyển giao sang IaC (Terraform Snippet)

```hcl
resource "aws_security_group" "db" {
  name        = "sre-platform-dev-db-sg"
  description = "Security Group for RDS and Redis"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from EKS nodes"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.node.id]
  }

  ingress {
    description     = "Redis from EKS nodes"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.node.id]
  }

  tags = { Name = "sre-platform-dev-db-sg" }
}
```

---

## 6. Điều kiện hoàn thành Gate (Gate Check)

- [ ] Cả 3 Security Groups (`alb-sg`, `node-sg`, `db-sg`) được tạo thành công trong VPC của lab.
- [ ] Database Security Group chỉ mở kết nối cho `node-sg` trên cổng 5432 và 6379.
- [ ] Tính năng tự tham chiếu (`self-referencing`) cho `node-sg` đã bật để đảm bảo CNI hoạt động.
- [ ] Không có quy tắc mở bất cẩn nào ra `0.0.0.0/0` ở tầng Node và Database.

---

## 7. Dọn dẹp tài nguyên (Cleanup)

> [!NOTE]
> Do các Security Groups có quy tắc tham chiếu chéo nhau, khi xóa phải thực hiện xóa các Inbound Rules tham chiếu trước, hoặc xóa theo thứ tự ngược: `db-sg` -> `node-sg` -> `alb-sg`.
