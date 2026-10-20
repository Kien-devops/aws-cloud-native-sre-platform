# 02.05 — Thiết lập Amazon VPC Flow Logs và Chẩn đoán Mạng (Network Diagnostics)

> **Trạng thái:** Hướng dẫn thực hành chi tiết trên AWS Management Console (Console-first).  
> **Áp dụng cho:** Giám sát lưu lượng IP, phát hiện gói tin bị chặn (REJECT) và chẩn đoán sự cố kết nối mạng giữa Microservices và Cơ sở dữ liệu.

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Kích hoạt **Amazon VPC Flow Logs** trên toàn bộ VPC `sre-platform-dev-vpc` để ghi lại metadata của toàn bộ các gói tin IP (Source IP, Destination IP, Port, Action: ACCEPT/REJECT).
  - Định tuyến dữ liệu log về **Amazon CloudWatch Logs** (với thời gian lưu trữ - Retention 7 ngày để tối ưu chi phí).
  - Sử dụng **CloudWatch Logs Insights** để chạy các truy vấn SRE thực tế: tìm các gói tin bị từ chối do sai Security Group, phát hiện port scanning hoặc kiểm tra lưu lượng đột biến.
- **Nguyên tắc SRE:**
  - **Telemetry at Every Layer:** Observability không dừng lại ở tầng ứng dụng (Application Traces) mà phải bao phủ cả tầng hạ tầng mạng (Network Telemetry).
  - **Mean Time to Diagnose (MTTD) Reduction:** Khi ứng dụng báo lỗi `Connection refused` hoặc `Timeout`, Flow Logs giúp kỹ sư SRE xác định ngay lập tức nguyên nhân nằm ở Security Group/NACL (REJECT) hay do ứng dụng chưa lắng nghe cổng (ACCEPT nhưng không phản hồi).
  - **Retention & Cost Control:** Log mạng có dung lượng rất lớn. Bắt buộc đặt Retention ngắn hạn (3 đến 7 ngày) cho môi trường lab để tránh hóa đơn CloudWatch Ingestion tăng vọt.

---

## 2. Thông số đầu vào (Input Parameters)

| Tham số | Giá trị mẫu | Ý nghĩa |
| :--- | :--- | :--- |
| **VPC ID** | `sre-platform-dev-vpc` | VPC đối tượng cần theo dõi |
| **Filter** | `ALL` (hoặc `REJECT`) | Ghi cả kết nối thành công và bị chặn |
| **Destination** | `CloudWatch Logs` | Điểm đến phục vụ phân tích thời gian thực |
| **Log Group Name** | `/aws/vpc/sre-platform-dev-flow-logs` | Tên nhóm log trong CloudWatch |
| **Log Retention** | `7 days` | Tự động hủy log sau 7 ngày để tiết kiệm chi phí |
| **Flow Logs IAM Role** | `sre-platform-dev-vpc-flow-logs-role` | Role cấp quyền cho VPC ghi log vào CloudWatch |

---

## 3. Các bước thực hiện chi tiết trên AWS Console (Console Steps)

### Bước 1: Tạo IAM Role cho VPC Flow Logs

1. Mở ô tìm kiếm Console -> Nhập `IAM` -> Chọn **IAM**.
2. Nhấp vào **Roles** ở menu bên trái -> Nhấp nút cam **Create role**.
3. **Select trusted entity:**
   - Chọn **Custom trust policy**.
   - Dán Trust Policy cho dịch vụ VPC Flow Logs:
     ```json
     {
       "Version": "2012-10-17",
       "Statement": [
         {
           "Sid": "AllowVPCFlowLogs",
           "Effect": "Allow",
           "Principal": {
             "Service": "vpc-flow-logs.amazonaws.com"
           },
           "Action": "sts:AssumeRole"
         }
       ]
     }
     ```
   - Nhấp **Next**.
4. **Add permissions:**
   - Nhấp nút **Create policy** (mở tab mới) -> Chọn tab **JSON** -> Dán quyền ghi CloudWatch Logs:
     ```json
     {
       "Version": "2012-10-17",
       "Statement": [
         {
           "Effect": "Allow",
           "Action": [
             "logs:CreateLogGroup",
             "logs:CreateLogStream",
             "logs:PutLogEvents",
             "logs:DescribeLogGroups",
             "logs:DescribeLogStreams"
           ],
           "Resource": "*"
         }
       ]
     }
     ```
   - Đặt tên policy: `VPCFlowLogsDeliveryPolicy` -> Nhấp **Create policy**.
5. Quay lại tab tạo Role -> Nhấn nút Refresh -> Tìm và tích chọn `VPCFlowLogsDeliveryPolicy` vừa tạo.
6. **Role name:** Nhập `sre-platform-dev-vpc-flow-logs-role`.
7. Nhấp **Create role**.

---

### Bước 2: Tạo CloudWatch Log Group với Retention 7 Ngày

1. Nhập `CloudWatch` vào ô tìm kiếm -> Chọn dịch vụ **CloudWatch**.
2. Tại menu bên trái, mục **Logs**, chọn **Log groups**.
3. Nhấp nút cam **Create log group**.
4. **Log group name:** Nhập `/aws/vpc/sre-platform-dev-flow-logs`.
5. **Retention setting:** Chọn `7 days (1 week)`.
   > [!TIP]
   > Không bao giờ để mặc định `Never expire` cho VPC Flow Logs trong môi trường dev/staging.
6. Nhấp **Create**.

---

### Bước 3: Kích hoạt Flow Logs trên VPC Console

1. Mở dịch vụ **VPC** -> Chọn **Your VPCs**.
2. Chọn `sre-platform-dev-vpc`.
3. Chọn tab **Flow logs** ở thanh thông tin phía dưới -> Nhấp nút **Create flow log**.
4. **Flow log settings:**
   - **Name:** Nhập `sre-platform-dev-all-flows`.
   - **Filter:** Chọn `All` (Ghi cả traffic được cho phép và bị từ chối).
   - **Maximum aggregation interval:** Chọn `1 minute` (để nhận dữ liệu nhanh, phục vụ chẩn đoán tức thời trong bài lab).
   - **Destination:** Chọn **Send to CloudWatch Logs**.
   - **Destination log group:** Chọn `/aws/vpc/sre-platform-dev-flow-logs`.
   - **IAM role:** Chọn role đã tạo ở Bước 1: `sre-platform-dev-vpc-flow-logs-role`.
   - **Log record format:** Chọn `AWS default format`.
5. Nhấp nút **Create flow log**.
6. Xác nhận Flow Log hiển thị trong bảng với trạng thái **Active**.

---

## 4. Xác minh và Chẩn đoán với CloudWatch Logs Insights (Verification)

Sau khi hệ thống có traffic (khoảng 5-10 phút), thực hiện truy vấn phân tích:

1. Vào **CloudWatch Console** -> Menu bên trái chọn **Logs** -> **Logs Insights**.
2. Tại ô **Select log group(s)**: Chọn `/aws/vpc/sre-platform-dev-flow-logs`.
3. **Kịch bản SRE: Tìm Top 15 Kết nối bị chặn (REJECT) nhiều nhất:**
   Dán truy vấn sau vào editor và nhấp **Run query**:
   ```sql
   fields @timestamp, srcAddr, dstAddr, srcPort, dstPort, protocol, action
   | filter action = "REJECT"
   | stats count(*) as rejectCount by srcAddr, dstAddr, dstPort
   | sort rejectCount desc
   | limit 15
   ```
4. **Kịch bản SRE: Kiểm tra kết nối tới cổng Database (PostgreSQL 5432):**
   ```sql
   fields @timestamp, srcAddr, dstAddr, action
   | filter dstPort = 5432
   | stats count(*) as totalConnections by srcAddr, action
   | sort totalConnections desc
   ```

---

## 5. Chuyển giao sang IaC (Terraform Snippet)

```hcl
resource "aws_cloudwatch_log_group" "flow_logs" {
  name              = "/aws/vpc/sre-platform-dev-flow-logs"
  retention_in_days = 7
}

resource "aws_flow_log" "main" {
  iam_role_arn    = aws_iam_role.flow_logs.arn
  log_destination = aws_cloudwatch_log_group.flow_logs.arn
  traffic_type    = "ALL"
  vpc_id          = aws_vpc.main.id

  tags = {
    Name        = "sre-platform-dev-all-flows"
    Environment = "dev"
  }
}
```

---

## 6. Điều kiện hoàn thành Gate (Gate Check)

- [ ] Flow Log ở trạng thái `Active` gắn trực tiếp vào VPC của dự án.
- [ ] CloudWatch Log Group `/aws/vpc/sre-platform-dev-flow-logs` nhận log streams liên tục.
- [ ] Retention được cấu hình đúng 7 ngày để bảo đảm FinOps.
- [ ] Truy vấn CloudWatch Logs Insights thực thi thành công và hiển thị bảng phân tích.

---

## 7. Dọn dẹp tài nguyên (Cleanup)

1. Vào **VPC Console** -> **Your VPCs** -> Chọn VPC -> Tab **Flow logs** -> Chọn flow log -> Nhấp **Delete flow log**.
2. Vào **CloudWatch Console** -> **Log groups** -> Chọn `/aws/vpc/sre-platform-dev-flow-logs` -> Nhấp **Actions** -> **Delete log group**.
3. Xóa IAM Role `sre-platform-dev-vpc-flow-logs-role`.
