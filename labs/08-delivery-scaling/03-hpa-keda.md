# 08.03 — Tự động Co giãn Pods với Kubernetes HPA và Event-Driven KEDA (SQS Scaling)

> **Trạng thái:** Hướng dẫn thực hành chi tiết cấu hình Horizontal Pod Autoscaler và KEDA.  
> **Áp dụng cho:** Tự động co giãn theo tải CPU/Memory (HPA) và co giãn theo độ dài hàng đợi SQS (KEDA Event-Driven).

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Khởi tạo **Horizontal Pod Autoscaler (HPA)** cho API đồng bộ (`order-service`) dựa trên mức sử dụng CPU (Ngưỡng: 70%) kết hợp chính sách chống rung giật (Scale-down Stabilization Window: 300 giây).
  - Cài đặt và cấu hình **KEDA (Kubernetes Event-driven Autoscaling)** cho Worker bất đồng bộ (`payment-worker`) dựa trên độ sâu hàng đợi **Amazon SQS** (`ApproximateNumberOfMessagesVisible`).
  - Thiết lập cơ chế xác thực **KEDA TriggerAuthentication** sử dụng EKS Pod Identity, không lưu trữ IAM credentials trong cluster.
  - Tận dụng tính năng **Scale-to-Zero** của KEDA: Khi không có message nào trong hàng đợi SQS, tự động giảm số lượng worker xuống 0 pods để tiết kiệm tối đa chi phí compute; khi có đơn hàng, lập tức scale lên 1-10 pods.
- **Nguyên tắc SRE:**
  - **Asymmetric Scaling Dynamics (Động thái co giãn bất đối xứng):** Tăng quy mô thật nhanh (Fast Scale-Up: phản ứng trong vòng 15 giây khi có traffic spike) nhưng giảm quy mô thật chậm (Cautious Scale-Down: duy trì tối thiểu 5 phút) để tránh hiện tượng rung lắc tài nguyên (Thrashing/Flapping).
  - **Queue Backlog as Primary Scaler:** Đối với các tác vụ xử lý hàng đợi, CPU không phản ánh đúng áp lực hệ thống; độ dài hàng đợi (Queue Depth) và tuổi của thông điệp (Message Age) mới là chỉ số quyết định để bảo vệ SLO xử lý đơn hàng (< 60 giây).
  - **Capacity Ceiling (Giới hạn trần an toàn):** Luôn đặt `maxReplicas` cố định (ví dụ: tối đa 10 pods) để ngăn chặn việc ứng dụng scale vô hạn làm sập database backend hoặc gây cạn kiệt ngân sách AWS.

---

## 2. Kiến trúc Co giãn Hai Tầng (HPA & KEDA Architecture)

```text
  [ User Traffic Spike (k6) ]               [ SQS Order Queue Backlog ]
              |                                          |
              v                                          v
   +----------------------+                  +----------------------+
   | HPA (order-service)  |                  | KEDA (payment-worker)|
   | Metric: CPU > 70%    |                  | Metric: SQS Depth > 5|
   +----------+-----------+                  +----------+-----------+
              |                                          |
              v                                          v
   Scale: 2 -> 10 Pods                        Scale: 0 -> 10 Workers
```

---

## 3. Các bước Khai báo Chi tiết (Manifest Walkthrough)

### Bước 1: Khai báo HPA cho `order-service`

Tạo file `gitops/applications/reliability-shop/base/order-service/hpa.yaml`:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: order-service-hpa
  namespace: reliability-shop
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: order-service
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    # PHẢN ỨNG TỨC THÌ KHI CÓ TẢI ĐỘT BIẾN (SPIKE REACTION)
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
        - type: Percent
          value: 100 # Nhân đôi số pods mỗi 15 giây
          periodSeconds: 15
    # GIẢM TẢI THẬN TRỌNG ĐỂ CHỐNG RUNG GIẬT (ANTI-THRASHING)
    scaleDown:
      stabilizationWindowSeconds: 300 # Giữ nguyên 5 phút trước khi quyết định giảm pod
      policies:
        - type: Percent
          value: 20
          periodSeconds: 60
```

---

### Bước 2: Khai báo KEDA TriggerAuthentication & ScaledObject cho `payment-worker`

Tạo file `gitops/applications/reliability-shop/base/payment-worker/keda-scaledobject.yaml`:

```yaml
apiVersion: keda.sh/v1alpha1
kind: TriggerAuthentication
metadata:
  name: keda-aws-credentials
  namespace: reliability-shop
spec:
  podIdentity:
    provider: aws-eks # Sử dụng EKS Pod Identity
---
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: payment-worker-scaler
  namespace: reliability-shop
spec:
  scaleTargetRef:
    name: payment-worker
  minReplicaCount: 0 # Cho phép Scale-to-Zero khi hàng đợi rỗng
  maxReplicaCount: 10
  cooldownPeriod: 60
  pollingInterval: 10 # Kiểm tra SQS sau mỗi 10 giây
  triggers:
    - type: aws-sqs-queue
      authenticationRef:
        name: keda-aws-credentials
      metadata:
        queueURL: https://sqs.ap-southeast-1.amazonaws.com/<ACCOUNT_ID>/reliability-shop-dev-order-queue
        queueLength: "5" # Cứ 5 messages tồn đọng sẽ scale thêm 1 worker pod
        awsRegion: ap-southeast-1
```

Áp dụng vào cluster:
```bash
kubectl apply -f gitops/applications/reliability-shop/base/order-service/hpa.yaml
kubectl apply -f gitops/applications/reliability-shop/base/payment-worker/keda-scaledobject.yaml
```

---

## 4. Xác minh và Diễn tập Tải Thực nghiệm (Verification Drill)

### 4.1. Kiểm tra trạng thái HPA và ScaledObject
```bash
# 1. Kiểm tra trạng thái HPA
kubectl get hpa -n reliability-shop

# 2. Kiểm tra trạng thái KEDA ScaledObject
kubectl get scaledobject -n reliability-shop
```

### 4.2. Diễn tập Tải Hàng đợi: Bơm 50 Messages vào SQS
Chạy script gửi hàng loạt message mẫu vào SQS từ terminal:

```bash
QUEUE_URL=$(aws sqs get-queue-url --queue-name reliability-shop-dev-order-queue --query 'QueueUrl' --output text)

echo "==> Simulating queue backlog: Sending 50 messages..."
for i in {1..50}; do
  aws sqs send-message \
    --queue-url $QUEUE_URL \
    --message-body "{\"order_id\":\"BURST-$i\",\"amount\":50.0}" > /dev/null
done
echo "==> 50 messages queued successfully."
```

### 4.3. Quan sát KEDA Tự động Scale Workers
Theo dõi số lượng pods của `payment-worker`:

```bash
kubectl get deployment payment-worker -n reliability-shop -w
```

**Kết quả quan sát thực tế:**
- Ban đầu: `Replicas = 0` (hoặc 1).
- Sau 10 giây (KEDA poll SQS thấy backlog = 50): KEDA tính toán `50 / 5 = 10 workers`.
- Deployment lập tức scale lên `10/10 Pods Ready`!
- Các workers tiêu thụ hết 50 messages trong vòng chưa đầy 20 giây.
- Sau khi hàng đợi về 0 và hết thời gian `cooldownPeriod` (60s), KEDA tự động scale số lượng worker về lại `0` hoặc `1`.

---

## 5. Điều kiện hoàn thành Gate (Gate Check)

- [ ] HPA cho `order-service` hiển thị trạng thái `TARGETS: 0%/70%` bình thường.
- [ ] KEDA ScaledObject cho `payment-worker` hiển thị `READY: True`.
- [ ] Thử nghiệm bơm message vào SQS làm kích hoạt thành công tiến trình scale-up lên 10 pods.
- [ ] Tính năng tự động scale-down an toàn khi hàng đợi cạn kiệt.

---

## 6. Dọn dẹp tài nguyên (Cleanup)

- Duy trì HPA và KEDA để phục vụ việc kiểm thử tải quy mô lớn ở Module 09.
