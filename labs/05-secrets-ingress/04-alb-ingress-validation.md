# 05.04 — Xác minh và Vận hành Application Load Balancer (ALB) Ingress

> **Trạng thái:** Hướng dẫn thực hành chi tiết trên AWS Management Console (Console-first).  
> **Áp dụng cho:** Kiểm tra đường truyền HTTPS, Target Group Health, chứng chỉ ACM, DNS Routing và giám sát chỉ số ALB qua CloudWatch.

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Xác nhận rằng sau khi Argo CD triển khai Ingress manifest, **AWS Load Balancer Controller** đã tự động tạo một **Application Load Balancer (ALB)** trên AWS.
  - Kiểm tra trạng thái sức khỏe (Target Health) của các Pod endpoints trong Target Group thông qua AWS Console.
  - Thiết lập Route 53 Alias Record trỏ tên miền dịch vụ về DNS name của ALB.
  - Phân tích các chỉ số vận hành quan trọng (Golden Signals: Latency, Request Count, 4xx/5xx Errors) trên AWS CloudWatch Metrics.
- **Nguyên tắc SRE:**
  - **Fail-open vs Fail-closed:** Xác nhận hành vi của Target Group khi Pods bị lỗi; đảm bảo health check threshold phản ánh đúng tình trạng Pod thật sự.
  - **Zero Unhealthy Targets in Steady State:** Ở trạng thái bình thường, 100% targets trong Target Group phải báo trạng thái `Healthy`.
  - **SRE Latency Tracking:** Giám sát phân vị độ trễ của ALB (`TargetResponseTime`) để so sánh với mục tiêu SLO latency (< 300ms p95).

---

## 2. Thông số đầu vào (Input Parameters)

| Tham số | Giá trị mẫu / Quy ước | Ý nghĩa |
| :--- | :--- | :--- |
| **Domain FQDN** | `shop.dev.sreplatform.yourdomain.com` | Tên miền người dùng truy cập vào ứng dụng |
| **Ingress Class** | `alb` | Điều khiển bởi AWS Load Balancer Controller |
| **Target Type** | `ip` | Điều hướng trực tiếp đến Pod IP thông qua AWS VPC CNI |
| **Health Check Path** | `/health` hoặc `/actuator/health` | Đường dẫn kiểm tra trạng thái của microservice |
| **Target Port** | `8080` (hoặc port của container) | Cổng lắng nghe của container Pod |
| **ALB Scheme** | `internet-facing` | Load balancer tiếp nhận traffic trực tiếp từ Internet |

---

## 3. Các bước thực hiện chi tiết trên AWS Console (Console Steps)

### Bước 1: Kiểm tra Application Load Balancer trên EC2 Console

1. Mở ô tìm kiếm Console -> Nhập `EC2` -> Chọn dịch vụ **EC2**.
2. Tại menu bên trái, cuộn xuống mục **Load Balancing** -> Chọn **Load Balancers**.
3. Bạn sẽ thấy một ALB mới được tạo tự động với tiền tố dạng `k8s-reliabilityshop-...`.
4. Nhấp vào tên của Load Balancer để xem chi tiết:
   - **DNS name:** Dạng `k8s-reliabilityshop-xxxxxx.ap-southeast-1.elb.amazonaws.com`. *(Sao chép DNS name này)*.
   - **State:** Kiểm tra trạng thái phải là **Active** (Màu xanh).
   - **Scheme:** Xác nhận là **Internet-facing**.
   - **IP address type:** `IPv4`.
   - **VPC & Subnets:** Xác nhận ALB nằm trong đúng 2 Public Subnet thuộc 2 AZ khác nhau.
5. Chuyển sang tab **Listeners and rules**:
   - **HTTP:80:** Phải có rule chuyển hướng (Redirect HTTP to HTTPS:443).
   - **HTTPS:443:** Default action chuyển tiếp (Forward) tới Target Group của ứng dụng.
   - **Certificate:** Kiểm tra chứng chỉ gắn vào HTTPS listener: phải trỏ đúng chứng chỉ ACM `*.dev.sreplatform.yourdomain.com` đã tạo ở bài 05.02.

---

### Bước 2: Kiểm tra Target Group và Trạng thái Sức khỏe Pods (Target Health)

1. Tại menu bên trái của EC2 Console, chọn **Target Groups**.
2. Chọn Target Group được tạo cho ứng dụng (thường có tên `k8s-reliabil-orderapi-...`).
3. **Tab Details:**
   - **Target type:** Bắt buộc phải là **IP** (cho phép ALB định tuyến thẳng tới Pod IP mà không qua NodePort, giảm một chặng network hop).
   - **Protocol & Port:** `HTTP:8080`.
4. **Tab Health checks:**
   - **Health check path:** Xác nhận đường dẫn (ví dụ `/health`).
   - **Healthy threshold:** `2` consecutive successes.
   - **Unhealthy threshold:** `2` consecutive failures.
   - **Timeout:** `5 seconds`.
   - **Interval:** `15 seconds`.
5. **Tab Targets:**
   - Xem bảng danh sách các Target IP đã đăng ký:
     - Các IP này chính là các Pod IP của ứng dụng ReliabilityShop trong cluster EKS.
     - **Health status:** Bắt buộc phải hiển thị **Healthy** (Màu xanh lá).
     - Nếu hiển thị `Unhealthy`, nhấp vào trạng thái để xem mã lỗi (ví dụ: `Target.FailedHealthCheck` hoặc `Target.ResponseCodeMismatch`).

---

### Bước 3: Cấu hình Route 53 Alias Record trỏ về ALB

1. Nhập `Route 53` vào thanh tìm kiếm Console -> Chọn **Route 53**.
2. Chọn **Hosted zones** -> Nhấp vào tên miền của bạn (`sreplatform.yourdomain.com`).
3. Nhấp vào nút cam **Create record**.
4. Cấu hình bản ghi DNS:
   - **Record name:** Nhập `shop.dev` (tạo FQDN: `shop.dev.sreplatform.yourdomain.com`).
   - **Record type:** `A - Routes traffic to an IPv4 address and some AWS resources`.
   - **Alias:** Gạt công tắc sang **ON** (Bật).
   - **Route traffic to:**
     - Chọn mục 1: **Alias to Application and Classic Load Balancer**.
     - Chọn mục 2 (Region): Chọn Region của bạn (ví dụ `ap-southeast-1`).
     - Chọn mục 3 (Choose load balancer): Chọn ALB vừa kiểm tra ở Bước 1 (`k8s-reliabilityshop-...`).
   - **Routing policy:** `Simple routing`.
   - **Evaluate target health:** `Yes`.
5. Nhấp **Create records**.

---

### Bước 4: Giám sát Chỉ số Vận hành ALB trên AWS CloudWatch

1. Nhập `CloudWatch` vào thanh tìm kiếm Console -> Chọn **CloudWatch**.
2. Tại menu bên trái, chọn **Metrics** -> **All metrics**.
3. Chọn namespace **AWS/ApplicationELB** -> Chọn **Per AppELB Metrics**.
4. Tìm kiếm theo tên Load Balancer và tích chọn các metrics trọng yếu của SRE:
   - **RequestCount:** Tổng số lượng request gửi đến ALB.
   - **TargetResponseTime:** Thời gian xử lý từ khi ALB gửi request đến khi nhận phản hồi từ Pod (dùng để theo dõi Latency SLO).
   - **HTTPCode_Target_2XX_Count:** Số lượng request thành công.
   - **HTTPCode_Target_5XX_Count:** Số lỗi do ứng dụng Pod sinh ra.
   - **HTTPCode_ELB_5XX_Count:** Số lỗi do chính ALB sinh ra (ví dụ không có target healthy, gateway timeout).
5. Chuyển sang tab **Graphed metrics**, đổi Statistic thành `Sum` (cho Count) hoặc `p95` (cho TargetResponseTime), đổi Period thành `1 Minute`.
6. Quan sát biểu đồ biến thiên theo thời gian thực khi chạy thử nghiệm tải.

---

## 4. Xác minh Thực nghiệm từ Terminal (Verification)

### 4.1. Kiểm tra Ingress trên Kubernetes
```bash
# Xem thông tin ingress
kubectl get ingress -n reliability-shop

# Xem chi tiết events và ALB hostname được gán
kubectl describe ingress reliability-shop-ingress -n reliability-shop
```

### 4.2. Kiểm tra Kết nối HTTPS & Chứng chỉ TLS
```bash
# Kiểm tra HTTP Redirect sang HTTPS (Mong đợi 301 Moved Permanently)
curl -I http://shop.dev.sreplatform.yourdomain.com

# Kiểm tra trực tiếp HTTPS Endpoint và TLS Handshake
curl -Iv https://shop.dev.sreplatform.yourdomain.com/health
```

**Kết quả mong đợi:**
- HTTP trả về `HTTP/1.1 301 Moved Permanently` với header `Location: https://...`.
- HTTPS trả về `HTTP/2 200` (hoặc `HTTP/1.1 200 OK`).
- SSL Certificate handshake hiển thị:
  - `Server certificate: *.dev.sreplatform.yourdomain.com`
  - `Issuer: Amazon`
  - `SSL certificate verify ok`.

---

## 5. Chuyển giao sang IaC (Terraform Snippet cho Route 53 Record)

```hcl
data "aws_lb" "ingress_alb" {
  tags = {
    "ingress.k8s.aws/stack" = "reliability-shop-ingress"
  }
}

resource "aws_route53_record" "shop" {
  zone_id = data.aws_route53_zone.primary.zone_id
  name    = "shop.dev.sreplatform.yourdomain.com"
  type    = "A"

  alias {
    name                   = data.aws_lb.ingress_alb.dns_name
    zone_id                = data.aws_lb.ingress_alb.zone_id
    evaluate_target_health = true
  }
}
```

---

## 6. Output & Bằng chứng thực nghiệm (Evidence Template)

```text
=== LAB 05.04 EVIDENCE ===
Timestamp:            2026-10-21T01:35:00Z
ALB DNS Name:         k8s-reliabilityshop-1234567890.ap-southeast-1.elb.amazonaws.com
Target Group Health:  2/2 Targets Healthy (IP Target Type)
Route 53 Alias:       shop.dev.sreplatform.yourdomain.com -> ALB Alias
HTTP Status:          301 Redirect to HTTPS
HTTPS Status:         HTTP/2 200 OK
TLS Cipher / Cert:    TLS_AES_128_GCM_SHA256 / Amazon Issued ACM
TargetResponseTime:   p95 = 24.5 ms
```

---

## 7. Điều kiện hoàn thành Gate (Gate Check)

- [ ] ALB hiển thị trạng thái `Active`, scheme `internet-facing`.
- [ ] 100% Targets trong Target Group hiển thị trạng thái `Healthy`.
- [ ] Route 53 Alias Record phân giải chính xác về DNS name của ALB.
- [ ] Lệnh `curl -Iv https://<FQDN>/health` trả về HTTP 200 và chứng chỉ hợp lệ.
- [ ] CloudWatch Metrics ghi nhận request và latency bình thường, không có lỗi `ELB_5XX`.

---

## 8. Dọn dẹp tài nguyên (Cleanup)

1. Khi dọn dẹp, Ingress manifest phải được xóa thông qua **Argo CD** hoặc `kubectl delete ingress`.  
   AWS Load Balancer Controller sẽ tự động phát hiện và xóa ALB cùng Target Group tương ứng trên AWS.
2. Xóa bản ghi Alias Record `shop.dev` trong **Route 53 Hosted zones**.
3. Kiểm tra lại **EC2 > Load Balancers** để đảm bảo ALB đã bị hủy hoàn toàn, tránh phát sinh chi phí duy trì hàng giờ ($0.0225/giờ + LCU).
