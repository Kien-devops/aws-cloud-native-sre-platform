# 08.05 — Phát hành An toàn theo Chiến lược Canary với Argo Rollouts và Phân tích Metric Tự động

> **Trạng thái:** Hướng dẫn thực hành chuẩn hóa triển khai Argo Rollouts Controller, cấu hình Rollout Canary cho `order-service` và tích hợp Prometheus AnalysisTemplate tự động hóa quyết định phát hành (Progressive Delivery).
> **Áp dụng cho:** Quản lý vòng đời phát hành ứng dụng microservices trên Amazon EKS, giảm thiểu bán kính ảnh hưởng (Blast Radius) và tự động Rollback tức thì khi vi phạm chỉ tiêu SLO.

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:**
  - Triển khai **Argo Rollouts Controller** vào cụm EKS để thay thế cơ chế cập nhật mặc định (`RollingUpdate`) của Kubernetes `Deployment`.
  - Chuyển đổi microservice `order-service` sang đối tượng **`Rollout`** với chiến lược phát hành **Canary**:
    - **Step 1:** Chuyển `20%` lưu lượng sang phiên bản mới -> Tạm dừng `1 phút` để hệ thống phân tích metrics.
    - **Step 2:** Chuyển `50%` lưu lượng -> Tạm dừng `2 phút` để đánh giá tải trung bình.
    - **Step 3:** Thăng cấp lên `100%` lưu lượng (Full Promotion) và thu hồi phiên bản cũ (Stable).
  - Tích hợp **`AnalysisTemplate`** kết nối trực tiếp với Prometheus (`monitoring` namespace) đo đạc 2 chỉ số cốt lõi cứ mỗi 30 giây:
    1. **Tỷ lệ thành công (Success Rate):** `Error Rate <= 0.5%` (hay `Success Rate >= 99.5%`).
    2. **Độ trễ phân vị p95:** `< 300ms`.
  - Tự động hóa quyết định: **Auto-Promotion** khi mọi lần đo đạt chỉ tiêu, hoặc **Auto-Abort / Instant Rollback** đưa 100% lưu lượng về phiên bản Stable ngay khi phát hiện vi phạm.
- **Nguyên tắc SRE:**
  - **Blast Radius Reduction:** Giới hạn phạm vi lỗi trong tối đa 20% người dùng thử nghiệm, ngăn chặn triệt để thảm họa gián đoạn dịch vụ toàn cụm.
  - **Data-Driven Automation:** Loại bỏ sự can thiệp và phán đoán cảm tính của con người; chất lượng bản build được quyết định hoàn toàn dựa trên dữ liệu đo lường thực tế từ Prometheus.
  - **Zero Downtime:** Quá trình chuyển dịch diễn ra liên tục, hai Service `order-service-stable` và `order-service-canary` đảm bảo điều tiết traffic mượt mà.

---

## 2. Kiến trúc và Luồng Dịch chuyển Canary

```text
                 Frontend Service / Internal Caller
                                 |
                                 v
                     [ ClusterIP: order-service ]
                                 |
      +--------------------------+--------------------------+
      | (80% Stable Traffic)                                | (20% Canary Traffic)
      v                                                     v
[ Service: order-service-stable ]            [ Service: order-service-canary ]
(Pods: order-service v1.0.0)                 (Pods: order-service v1.1.0)
      |                                                     |
  [ 4 Pods ]                                            [ 1 Pod ]
                                                            |
                                                [ AnalysisTemplate Run ]
                                                            |
                                        +-------------------+-------------------+
                                        |                                       |
                                        v                                       v
                               (Prometheus Query)                      (Prometheus Query)
                             Error Rate <= 0.5%                      p95 Latency <= 300ms
                                        |                                       |
                                        +-------------------+-------------------+
                                                            |
                                           +----------------+----------------+
                                           |                                 |
                                           v (Pass)                          v (Fail)
                                   Tăng lên 50% -> 100%            Auto-Abort & Rollback v1.0.0
```

---

## 3. Các bước Triển khai Chi tiết

### Bước 0: Triển khai Argo Rollouts Controller & Cài đặt CLI Plugin

#### 1. Triển khai Controller vào cụm EKS
Argo Rollouts controller quản lý các CRDs (`Rollout`, `AnalysisTemplate`, `AnalysisRun`, `Experiment`).

Áp dụng manifest chính thức phiên bản ổn định mới nhất:
```bash
# Tạo namespace chuyên dụng cho Argo Rollouts
kubectl create namespace argo-rollouts

# Cài đặt Argo Rollouts Controller và các CRD liên quan
kubectl apply -n argo-rollouts -f https://github.com/argoproj/argo-rollouts/releases/latest/download/install.yaml

# Kiểm tra trạng thái sẵn sàng của Controller
kubectl rollout status deployment/argo-rollouts -n argo-rollouts --timeout=90s
```

#### 2. Cài đặt `kubectl-argo-rollouts` CLI Plugin

* **Trên máy Linux / macOS:**
  ```bash
  # Tải binary plugin cho Linux AMD64 (hoặc macOS darwin)
  curl -LO https://github.com/argoproj/argo-rollouts/releases/latest/download/kubectl-argo-rollouts-linux-amd64
  chmod +x kubectl-argo-rollouts-linux-amd64
  sudo mv kubectl-argo-rollouts-linux-amd64 /usr/local/bin/kubectl-argo-rollouts

  # Kiểm tra plugin
  kubectl argo rollouts version
  ```

* **Trên máy Windows (PowerShell):**
  ```powershell
  # Tải kubectl-argo-rollouts.exe và đưa vào thư mục PATH
  Invoke-WebRequest -Uri "https://github.com/argoproj/argo-rollouts/releases/latest/download/kubectl-argo-rollouts-windows-amd64.exe" -OutFile "$env:TEMP\kubectl-argo-rollouts.exe"
  Move-Item "$env:TEMP\kubectl-argo-rollouts.exe" "C:\Windows\System32\kubectl-argo-rollouts.exe"

  # Kiểm tra
  kubectl argo rollouts version
  ```

---

### Bước 1: Khai báo `AnalysisTemplate` Đánh giá Chất lượng Phiên bản

Tạo file `gitops/applications/reliability-shop/base/order-service-analysis-template.yaml`:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: order-service-metrics-check
  namespace: reliability-shop
spec:
  metrics:
    # TIÊU CHÍ 1: TỶ LỆ LỖI (ERROR RATE) <= 0.5%
    - name: error-rate
      interval: 30s
      successCondition: result[0] <= 0.005
      failureLimit: 2 # Thất bại 2 lần đo liên tiếp sẽ kích hoạt Abort ngay lập tức
      provider:
        prometheus:
          # Địa chỉ nội bộ chính xác của Prometheus trong cụm EKS
          address: http://prometheus-kube-prometheus-prometheus.monitoring.svc.cluster.local:9090
          query: |
            (
              sum(rate(http_requests_total{service="order-service", status=~"5.."}[1m])) or vector(0)
            )
            /
            (
              sum(rate(http_requests_total{service="order-service"}[1m])) or vector(1)
            )

    # TIÊU CHÍ 2: ĐỘ TRỄ P95 (LATENCY) <= 300MS (0.3 giây)
    - name: p95-latency
      interval: 30s
      successCondition: result[0] <= 0.300
      failureLimit: 2
      provider:
        prometheus:
          address: http://prometheus-kube-prometheus-prometheus.monitoring.svc.cluster.local:9090
          query: |
            histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{service="order-service"}[1m])) by (le)) or vector(0.05)
```

> [!NOTE]
> Đoạn toán tử `or vector(0)` và `or vector(1)` trong câu lệnh PromQL đảm bảo nếu chưa có lưu lượng truy cập lớn trong những giây đầu tiên, Prometheus sẽ không trả về giá trị `NaN` hoặc `null`, giúp `AnalysisRun` không bị đánh fail sai lầm (False Positive).

---

### Bước 2: Khai báo Services Điều phối Lưu lượng (Stable & Canary)

Tạo file `gitops/applications/reliability-shop/base/order-service-rollout-services.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: order-service-stable
  namespace: reliability-shop
  labels:
    app.kubernetes.io/name: order-service
spec:
  type: ClusterIP
  ports:
    - port: 8080
      targetPort: 8080
      name: http
  selector:
    app.kubernetes.io/name: order-service
---
apiVersion: v1
kind: Service
metadata:
  name: order-service-canary
  namespace: reliability-shop
  labels:
    app.kubernetes.io/name: order-service
spec:
  type: ClusterIP
  ports:
    - port: 8080
      targetPort: 8080
      name: http
  selector:
    app.kubernetes.io/name: order-service
```

---

### Bước 3: Chuyển đổi `Deployment` Sang Đối tượng `Rollout`

Tạo file `gitops/applications/reliability-shop/base/order-service-rollout.yaml`:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: order-service
  namespace: reliability-shop
  labels:
    app.kubernetes.io/name: order-service
    app.kubernetes.io/part-of: reliability-shop
spec:
  replicas: 5 # Đặt 5 replicas để chia tỷ lệ 20% (1 Pod canary, 4 Pods stable) chính xác
  strategy:
    canary:
      # Liên kết với 2 service điều tiết
      stableService: order-service-stable
      canaryService: order-service-canary
      # Tích hợp bộ phân tích tự động
      analysis:
        templates:
          - templateName: order-service-metrics-check
      # Các bước thăng cấp từng giai đoạn
      steps:
        - setWeight: 20
        - pause: { duration: 1m }
        - setWeight: 50
        - pause: { duration: 2m }
  selector:
    matchLabels:
      app.kubernetes.io/name: order-service
  template:
    metadata:
      labels:
        app.kubernetes.io/name: order-service
    spec:
      serviceAccountName: reliability-shop-sa
      initContainers:
        - name: opentelemetry-auto-instrumentation
          image: ghcr.io/open-telemetry/opentelemetry-operator/autoinstrumentation-nodejs:latest
          command: ["cp", "-r", "/autoinstrumentation/.", "/otel-auto-instrumentation"]
          volumeMounts:
            - name: opentelemetry-auto-instrumentation
              mountPath: /otel-auto-instrumentation
      containers:
        - name: app
          image: reliabilityshop/order-service:bootstrap
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 8080
              name: http
          envFrom:
            - configMapRef:
                name: app-config
          env:
            - name: OTEL_SERVICE_NAME
              value: "order-service"
            - name: DB_USER
              valueFrom:
                secretKeyRef:
                  name: app-credentials
                  key: DB_USER
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: app-credentials
                  key: DB_PASSWORD
            - name: REDIS_AUTH
              valueFrom:
                secretKeyRef:
                  name: app-credentials
                  key: REDIS_AUTH
          resources:
            requests:
              cpu: 50m
              memory: 64Mi
            limits:
              cpu: 250m
              memory: 256Mi
          startupProbe:
            httpGet:
              path: /health
              port: 8080
            failureThreshold: 30
            periodSeconds: 5
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /ready
              port: 8080
            periodSeconds: 5
          volumeMounts:
            - name: opentelemetry-auto-instrumentation
              mountPath: /otel-auto-instrumentation
      volumes:
        - name: opentelemetry-auto-instrumentation
          emptyDir: {}
```

---

### Bước 4: Tích hợp vào GitOps Kustomize

Cập nhật `gitops/applications/reliability-shop/base/kustomization.yaml`:

```yaml
resources:
  - service-account.yaml
  - external-secret.yaml
  - reliability-shop-app.yaml
  - ingress.yaml
  - hpa.yaml
  - keda-scaledobject.yaml
  - order-service-analysis-template.yaml
  - order-service-rollout-services.yaml
  - order-service-rollout.yaml
```

> [!IMPORTANT]
> Khi chuyển từ `Deployment` sang `Rollout`, để tránh việc 2 đối tượng cùng quản lý một nhóm Pods:
> 1. Xóa hoặc bình luận (`comment out`) đoạn khai báo `Deployment` của `order-service` trong `reliability-shop-app.yaml`.
> 2. Giữ nguyên đối tượng `Service: order-service` trong `reliability-shop-app.yaml` làm cổng chính cho các dịch vụ khác (như `frontend`) gọi đến.

---

## 4. Kịch bản Kiểm chứng & Vận hành SRE (Verification & Operations)

### Kịch bản A: Theo dõi Trạng thái Khởi tạo Ban đầu
Sau khi triển khai, kiểm tra Rollout khởi tạo thành công ở trạng thái Stable:

```bash
# Kiểm tra danh sách rollouts
kubectl argo rollouts list rollouts -n reliability-shop

# Xem chi tiết trực quan tiến trình
kubectl argo rollouts get rollout order-service -n reliability-shop
```

**Kết quả kỳ vọng:**
```text
NAME           KIND     STATUS        AGE  INFO
order-service  Rollout  Healthy       1m
└──# revision:1
   └──⧉ order-service-xxxxxxxxx  ReplicaSet  Healthy  1m  stable
      ├──□ order-service-xxxxxxxxx-11111     Pod  Running  1m  ready
      ├──□ order-service-xxxxxxxxx-22222     Pod  Running  1m  ready
      ├──□ order-service-xxxxxxxxx-33333     Pod  Running  1m  ready
      ├──□ order-service-xxxxxxxxx-44444     Pod  Running  1m  ready
      └──□ order-service-xxxxxxxxx-55555     Pod  Running  1m  ready
```

---

### Kịch bản B: Kích hoạt Phát hành Canary Thành công (Happy Path)

1. Cập nhật phiên bản container image hoặc biến môi trường mới cho `order-service`:
   ```bash
   kubectl argo rollouts set image order-service app=reliabilityshop/order-service:bootstrap -n reliability-shop
   ```
2. Mở cửa sổ Dashboard theo dõi trực tiếp trong Terminal:
   ```bash
   kubectl argo rollouts get rollout order-service -n reliability-shop --watch
   ```
3. Quan sát các bước chuyển dịch:
   - **Step 1 (20%):** 1 Pod Canary được khởi tạo và chạy `Running`. AnalysisRun `order-service-metrics-check` tự động kích hoạt truy vấn Prometheus.
   - **Đồng hồ đếm ngược:** Trạng thái `Paused - 1m0s` đếm lùi trong khi các bài đo Success Rate và Latency đều hiển thị tick xanh `✔`.
   - **Step 2 (50%):** Sau 1 phút thành công, Rollouts tự nâng số Pod Canary lên 3 Pods (50%), tiếp tục đo trong 2 phút.
   - **Full Promotion:** Sau 2 phút tiếp tục pass, 100% traffic chuyển sang revision mới, các Pods cũ tự động được dọn dẹp sạch sẽ.

---

### Kịch bản C: Diễn tập Tự động Hủy bỏ khi Phiên bản Lỗi (Auto-Abort & Rollback)

1. Giả lập đưa vào một image lỗi hoặc cấu hình sai gây crash/lỗi 500:
   ```bash
   # Giả lập thay đổi image không tồn tại hoặc gây lỗi
   kubectl argo rollouts set image order-service app=reliabilityshop/order-service:invalid-tag -n reliability-shop
   ```
2. Theo dõi phản ứng của Argo Rollouts:
   ```bash
   kubectl argo rollouts get rollout order-service -n reliability-shop
   ```
3. **Phản ứng tự động của SRE Engine:**
   - Pod canary không vượt qua Readiness Probe hoặc `AnalysisRun` ghi nhận tỷ lệ lỗi vượt quá `0.5%`.
   - Controller ghi nhận `failureLimit: 2` bị chạm ngưỡng -> Lập tức kích hoạt **`Degraded / Aborted`**.
   - Lưu lượng toàn bộ lập tức được giữ nguyên 100% ở phiên bản `stableService` an toàn.
   - Pods canary bị cô lập và scale về `0`, người dùng cuối hoàn toàn không cảm nhận thấy sự cố.

---

### Các lệnh Vận hành Cấp cứu Khẩn cấp (SRE Cheat Sheet)

```bash
# 1. Thăng cấp thủ công ngay lập tức (Bỏ qua thời gian chờ Analysis)
kubectl argo rollouts promote order-service -n reliability-shop

# 2. Dừng khẩn cấp đợt phát hành và chuyển toàn bộ lưu lượng về stable
kubectl argo rollouts abort order-service -n reliability-shop

# 3. Khôi phục (Undo / Rollback) về revision trước đó
kubectl argo rollouts undo order-service -n reliability-shop

# 4. Thử lại sau khi đã abort (Retry)
kubectl argo rollouts retry rollout order-service -n reliability-shop
```

---

## 5. Tiêu chí Đánh giá Hoàn thành Gate (SRE Gate Check)

- [ ] **Controller Readiness:** `argo-rollouts` controller và CRDs hoạt động ổn định trong namespace `argo-rollouts`.
- [ ] **Object Migration:** Đối tượng `Rollout` thay thế `Deployment` cho `order-service` thành công, duy trì `5/5 Ready Pods`.
- [ ] **Dual Services:** Hai Service `order-service-stable` và `order-service-canary` được tạo đầy đủ với selector phù hợp.
- [ ] **Prometheus Connectivity:** `AnalysisTemplate` truy vấn chính xác địa chỉ `http://prometheus-kube-prometheus-prometheus.monitoring.svc.cluster.local:9090` mà không phát sinh lỗi DNS hoặc kết nối.
- [ ] **Automated Safety Gate:** Quá trình Canary tạm dừng và kích hoạt phép đo tự động theo đúng tiến trình `20% (1m) -> 50% (2m) -> 100%`.

---

## 6. Dọn dẹp Tài nguyên (Cleanup)

- Duy trì cấu hình Argo Rollouts trên cluster để phục vụ bài diễn tập Chaos Engineering và Stress Testing ở Chương 09.
- Nếu muốn hoàn nguyên về Kubernetes Deployment truyền thống:
  ```bash
  kubectl delete rollout order-service -n reliability-shop
  kubectl apply -f gitops/applications/reliability-shop/base/reliability-shop-app.yaml
  ```
