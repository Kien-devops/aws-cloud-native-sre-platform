# 06.05 — Thiết lập Lớp phủ Môi trường Kustomize (Environment Overlays)

> **Trạng thái:** Hướng dẫn thực hành chi tiết cấu hình Kustomize Overlay cho môi trường `dev`.  
> **Áp dụng cho:** Gắn Ingress ALB Annotations, trỏ endpoints Database/Redis thực tế và cấu hình tham số môi trường chuyên biệt.

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Tạo thư mục **Kustomize Overlay** cho môi trường `dev` tại `gitops/applications/reliability-shop/envs/dev/` kế thừa toàn bộ cấu trúc từ thư mục `base/`.
  - Khai báo tài nguyên **Kubernetes Ingress** với đầy đủ các **AWS Load Balancer Controller Annotations** (Scheme: `internet-facing`, Target Type: `ip`, SSL Redirect, ACM Certificate ARN từ Module 05).
  - Khởi tạo `ConfigMap` ghi đè các biến kết nối thực tế trên AWS: **RDS PostgreSQL Endpoint** và **ElastiCache Redis Primary Endpoint** đã tạo ở Module 03.
  - Cập nhật phiên bản image tag bất biến (Immutable Git SHA tag).
- **Nguyên tắc SRE:**
  - **Environment Parity (Tính tương đồng môi trường):** Cấu trúc kiến trúc giữa `dev`, `staging` và `prod` là giống nhau 100% nhờ dùng chung `base/`. Chỉ có thông số quy mô (Replicas, CPU/Memory) và chuỗi kết nối là thay đổi qua Overlays.
  - **Direct IP Target Routing:** Sử dụng annotation `alb.ingress.kubernetes.io/target-type: ip` để ALB bắn trực tiếp vào Pod IP thông qua AWS VPC CNI, giảm thiểu độ trễ mạng và loại bỏ hiện tượng lệch tải (imbalanced traffic) của NodePort.
  - **HTTPS Redirection at the Edge:** Tự động chuyển hướng toàn bộ traffic HTTP (Cổng 80) sang HTTPS (Cổng 443) ngay tại tầng ALB để giảm tải xử lý mã hóa cho các container pods.

---

## 2. Cấu trúc Thư mục Overlay Môi trường Dev

```text
gitops/applications/reliability-shop/envs/dev/
├── kustomization.yaml
├── ingress.yaml
├── configmap-env.yaml
└── patches/
    └── replicas-patch.yaml
```

---

## 3. Các bước Khai báo Chi tiết (Overlay Manifests)

### Bước 1: Khai báo Ingress với ALB Annotations

Tạo file `gitops/applications/reliability-shop/envs/dev/ingress.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: reliability-shop-ingress
  namespace: reliability-shop
  annotations:
    # BẮT BUỘC CHO AWS LOAD BALANCER CONTROLLER
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/load-balancer-name: sre-platform-dev-alb
    # CẤU HÌNH CỔNG VÀ CHUYỂN HƯỚNG SSL TỰ ĐỘNG
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}, {"HTTPS": 443}]'
    alb.ingress.kubernetes.io/ssl-redirect: '443'
    # GẮN CHỨNG CHỈ ACM TỪ LAB 05.02 (THAY BẰNG ARN THỰC TẾ)
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:ap-southeast-1:<ACCOUNT_ID>:certificate/<CERTIFICATE_UUID>
    # HEALTH CHECK CHUẨN SRE CHO TARGET GROUP
    alb.ingress.kubernetes.io/healthcheck-path: /health
    alb.ingress.kubernetes.io/healthcheck-interval-seconds: '15'
    alb.ingress.kubernetes.io/healthcheck-timeout-seconds: '5'
    alb.ingress.kubernetes.io/healthy-threshold-count: '2'
    alb.ingress.kubernetes.io/unhealthy-threshold-count: '2'
    # SECURITY GROUP ĐÃ TẠO Ở LAB 02.04
    alb.ingress.kubernetes.io/security-groups: sre-platform-dev-alb-sg
spec:
  rules:
    - host: shop.dev.sreplatform.yourdomain.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: order-service
                port:
                  number: 8080
```

---

### Bước 2: Khai báo ConfigMap Kết nối Hạ tầng Thực tế

Tạo file `gitops/applications/reliability-shop/envs/dev/configmap-env.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: order-config
  namespace: reliability-shop
data:
  # Kết nối RDS PostgreSQL từ Lab 03.04
  DB_HOST: "sre-platform-dev-pg.xxxxxx.ap-southeast-1.rds.amazonaws.com"
  DB_PORT: "5432"
  DB_NAME: "reliability_shop"
  # Kết nối Redis Cache từ Lab 03.05
  REDIS_HOST: "sre-platform-dev-redis.xxxxxx.0001.apse1.cache.amazonaws.com"
  REDIS_PORT: "6379"
  # Tham số vận hành ứng dụng
  ENVIRONMENT: "dev"
  LOG_LEVEL: "INFO"
  OTEL_SERVICE_NAME: "order-service"
```

---

### Bước 3: Tạo Tệp `kustomization.yaml` Cho Môi trường Dev

Tạo file `gitops/applications/reliability-shop/envs/dev/kustomization.yaml`:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

# KẾ THỪA TẦNG BASE
resources:
  - ../../base
  - ingress.yaml
  - configmap-env.yaml

# GẮN TIỀN TỐ/HẬU TỐ VÀ LABELS MÔI TRƯỜNG
namespace: reliability-shop

commonLabels:
  environment: dev
  tier: application

# QUẢN LÝ PHIÊN BẢN IMAGE BẤT BIẾN (TAG IMMUTABILITY)
images:
  - name: <ACCOUNT_ID>.dkr.ecr.ap-southeast-1.amazonaws.com/reliabilityshop/order-service
    newTag: git-v1.0.0
  - name: <ACCOUNT_ID>.dkr.ecr.ap-southeast-1.amazonaws.com/reliabilityshop/payment-worker
    newTag: git-v1.0.0
```

---

## 4. Xác minh Biên dịch Kustomize Môi trường Dev (Verification)

Chạy lệnh kiểm tra kết quả ghép nối giữa Base và Overlay từ terminal:

```bash
kubectl kustomize gitops/applications/reliability-shop/envs/dev/
```

**Kết quả mong đợi:**
- File YAML hoàn chỉnh kết hợp cả Deployments từ `base/` và Ingress, ConfigMap từ `envs/dev/`.
- Giá trị `DB_HOST` và `REDIS_HOST` trong ConfigMap phản ánh đúng Endpoint thực tế của AWS.
- Ingress chứa đầy đủ các annotations ALB đã chỉ định ARN của chứng chỉ ACM.

---

## 5. Điều kiện hoàn thành Gate (Gate Check)

- [ ] Kustomize Overlay cho `dev` tham chiếu chính xác thư mục `base/`.
- [ ] Ingress manifest có đầy đủ annotations của AWS Load Balancer Controller.
- [ ] Certificate ARN trong Ingress trỏ đúng chứng chỉ ACM `Issued` ở Module 05.
- [ ] Lệnh `kubectl kustomize` thực thi không có lỗi.

---

## 6. Dọn dẹp tài nguyên (Cleanup)

- Thư mục overlays là mã nguồn trong Git; không áp dụng trực tiếp bằng `kubectl`. Việc triển khai vào cluster sẽ do Argo CD thực hiện ở bài 06.06.
