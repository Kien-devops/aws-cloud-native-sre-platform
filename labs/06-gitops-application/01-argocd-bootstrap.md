# 06.01 — Khởi tạo (Bootstrap) Argo CD và Bảo mật Bảng điều khiển Quản trị

> **Trạng thái:** Hướng dẫn thực hành chi tiết từ AWS Console kết hợp chuyển giao GitOps CLI.  
> **Áp dụng cho:** Thiết lập động cơ điều phối GitOps (GitOps Engine) trung tâm cho toàn bộ nền tảng, pin phiên bản ổn định và khóa chặt quyền admin.

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Khởi tạo **Argo CD** (phiên bản v2.11+) trên namespace `argocd` trong EKS cluster.
  - Sử dụng phương thức cài đặt khai báo (**Declarative GitOps Bootstrap**) từ manifest chính thức hoặc Helm chart đã được pin cứng phiên bản.
  - Vô hiệu hóa hoặc xoay vòng ngay lập tức mật khẩu `admin` mặc định (`argocd-initial-admin-secret`), lưu trữ mật khẩu mới an toàn trong AWS Secrets Manager.
  - Thiết lập kênh truy cập bảo mật an toàn vào Argo CD Web UI (thông qua Port-Forwarding nội bộ hoặc Private ALB Ingress kèm TLS).
- **Nguyên tắc SRE:**
  - **Git as Single Source of Truth:** Sau khi Argo CD được cài đặt, toàn bộ tài nguyên Kubernetes (Deployments, Services, ConfigMaps, Ingress) bắt buộc phải được quản lý qua Git. Nghiêm cấm chạy lệnh `kubectl apply` thủ công cho các ứng dụng nghiệp vụ.
  - **Reconciliation Loop & Self-Healing:** Argo CD liên tục giám sát trạng thái thực tế (Live State) và tự động kéo về trạng thái mong muốn trong Git (Desired State) nếu có ai đó can thiệp thủ công (Anti-Drift).
  - **Secure Administration:** Không công khai cổng quản trị Argo CD trực tiếp ra Internet mà không có bảo vệ lớp mạng hoặc xác thực SSO/MFA.

---

## 2. Thông số đầu vào (Input Parameters)

| Tham số | Giá trị mẫu / Quy ước | Ý nghĩa |
| :--- | :--- | :--- |
| **Cluster Name** | `sre-platform-dev` | EKS Cluster đích tiếp nhận GitOps |
| **Argo CD Namespace** | `argocd` | Namespace dành riêng cho hạ tầng GitOps |
| **Argo CD Version** | `v2.11.3` (hoặc bản stable mới nhất) | Phiên bản được pin cứng (Pinned Version) |
| **Admin Secret Store** | `/sre-platform/dev/argocd/admin` | Đường dẫn lưu mật khẩu admin trên AWS Secrets Manager |
| **Truy cập UI ban đầu** | `kubectl port-forward` (Local) | Kênh kết nối bảo mật cô lập mạng |

---

## 3. Các bước thực hiện chi tiết (Step-by-Step Walkthrough)

### Bước 1: Chuẩn bị Môi trường và Namespace

Từ terminal quản trị đã kết nối tới EKS cluster:

```bash
# 1. Xác nhận đúng context cluster
kubectl config current-context

# 2. Tạo namespace riêng biệt cho Argo CD
kubectl create namespace argocd

# 3. Gắn nhãn quản trị cho namespace
kubectl label namespace argocd environment=dev project=sre-platform
```

---

### Bước 2: Cài đặt Argo CD phiên bản Pin cứng

Sử dụng manifest chính thức từ Argo CD repository với phiên bản được chỉ định rõ ràng:

```bash
# Áp dụng manifest chính thức phiên bản v2.11.3
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/v2.11.3/manifests/install.yaml
```

Chờ các components cốt lõi khởi động thành công:
```bash
# Theo dõi tiến trình khởi tạo của các Deployments
kubectl wait --for=condition=Available deployment/argocd-server -n argocd --timeout=300s
kubectl wait --for=condition=Available deployment/argocd-repo-server -n argocd --timeout=300s
```

---

### Bước 3: Cấu hình Argo CD Server chạy sau ALB Ingress (Insecure Mode)

Vì Application Load Balancer đảm nhận nhiệm vụ chấm dứt TLS (**TLS Termination**) bằng chứng chỉ ACM tại cổng 443 và chuyển tiếp HTTP xuống Pod, ta cần cấu hình `argocd-server` chạy ở chế độ không ép buộc mã hóa nội bộ (`server.insecure: "true"`):

```bash
# Cập nhật ConfigMap tham số lệnh của Argo CD
kubectl patch cm argocd-cmd-params-cm -n argocd --type merge -p '{"data":{"server.insecure":"true"}}'

# Khởi động lại deployment argocd-server để nhận cấu hình mới
kubectl rollout restart deploy argocd-server -n argocd
kubectl rollout status deploy argocd-server -n argocd --timeout=120s
```

---

### Bước 4: Triển khai Ingress cho Argo CD gia nhập Shared ALB (`sre-platform`)

Tạo file manifest Ingress cho Argo CD tại `gitops/platform/ingress/argocd-ingress.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: argocd-server-ingress
  namespace: argocd
  labels:
    app.kubernetes.io/name: argocd-server-ingress
    app.kubernetes.io/part-of: argocd
  annotations:
    kubernetes.io/ingress.class: alb
    # GIA NHẬP NHÓM INGRESS DÙNG CHUNG ALB (FinOps Shared Ingress)
    alb.ingress.kubernetes.io/group.name: sre-platform
    alb.ingress.kubernetes.io/group.order: "20"
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/security-groups: sg-067f16ca5bd986a83
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:ap-southeast-1:620306387033:certificate/6af0c1dd-cbf4-4560-84b7-51e7cda7a69a
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}, {"HTTPS": 443}]'
    alb.ingress.kubernetes.io/ssl-redirect: '443'
    alb.ingress.kubernetes.io/backend-protocol: HTTP
    alb.ingress.kubernetes.io/healthcheck-protocol: HTTP
    alb.ingress.kubernetes.io/healthcheck-path: /healthz
    alb.ingress.kubernetes.io/healthcheck-interval-seconds: '15'
    alb.ingress.kubernetes.io/healthcheck-timeout-seconds: '5'
    alb.ingress.kubernetes.io/healthy-threshold-count: '2'
    alb.ingress.kubernetes.io/unhealthy-threshold-count: '2'
    alb.ingress.kubernetes.io/success-codes: '200'
spec:
  ingressClassName: alb
  rules:
    - host: argocd.dev.devopsss.site
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: argocd-server
                port:
                  number: 80
```

Áp dụng manifest vào cluster:
```bash
kubectl apply -f gitops/platform/ingress/argocd-ingress.yaml
```

---

### Bước 5: Cấu hình Route 53 và Đăng nhập Bảng điều khiển Argo CD Web UI

1. **Tạo Route 53 Alias Record cho `argocd.dev.devopsss.site`:**
   Trỏ tên miền `argocd.dev.devopsss.site` về DNS name của Shared ALB (`k8s-sreplatform-...`).

2. **Lấy mật khẩu đăng nhập ban đầu của tài khoản `admin`:**
   ```bash
   ARGO_PWD=$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d)
   echo "Argo CD Admin Password: $ARGO_PWD"
   ```

3. **Mở trình duyệt truy cập:**
   - **URL:** `https://argocd.dev.devopsss.site`
   - **Username:** `admin`
   - **Password:** `<Chuỗi mật khẩu vừa lấy ở trên>`
4. Giao diện trang chủ Argo CD xuất hiện với chứng chỉ SSL màu xanh hợp lệ.

---

## 4. Xác minh (Verification)

Kiểm tra trạng thái của toàn bộ pods và services trong namespace `argocd`:

```bash
kubectl get pods -n argocd -o wide
```

**Kết quả mong đợi:**
Toàn bộ các pods sau phải ở trạng thái `Running` (1/1 hoặc Ready):
- `argocd-server-...`
- `argocd-repo-server-...`
- `argocd-application-controller-...`
- `argocd-redis-...`
- `argocd-notifications-controller-...`
- `argocd-applicationset-controller-...`

---

## 5. Chuyển giao sang IaC/GitOps Manifest (`gitops/bootstrap/argocd/kustomization.yaml`)

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: argocd

resources:
  - https://raw.githubusercontent.com/argoproj/argo-cd/v2.11.3/manifests/install.yaml

patches:
  - target:
      kind: ConfigMap
      name: argocd-cm
    patch: |-
      - op: add
        path: /data/url
        value: https://argocd.dev.sreplatform.yourdomain.com
```

---

## 6. Điều kiện hoàn thành Gate (Gate Check)

- [ ] Toàn bộ các Deployments trong namespace `argocd` ở trạng thái `Available`.
- [ ] Mật khẩu mặc định trong `argocd-initial-admin-secret` đã bị xóa bỏ hoàn toàn.
- [ ] Mật khẩu mới được bảo vệ trong AWS Secrets Manager `/sre-platform/dev/argocd/admin`.
- [ ] Đăng nhập thành công vào Web UI qua cổng `localhost:8080`.

---

## 7. Dọn dẹp tài nguyên (Cleanup)

- Không xóa namespace `argocd` khi hệ thống đang vận hành vì sẽ làm mất khả năng quản lý GitOps.
- Khi dọn dẹp sạch toàn bộ cluster: `kubectl delete -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/v2.11.3/manifests/install.yaml` và `kubectl delete ns argocd`.
