# 05.02 — AWS Certificate Manager (ACM) & Route 53 DNS

> **Phạm vi:** Edge TLS Termination & Public DNS | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **TLS 1.3 / HTTPS Enforcement:** Mọi traffic HTTP (80) tự động redirect sang HTTPS (443) tại tầng ALB (`alb.ingress.kubernetes.io/ssl-redirect: '443'`).
- **Wildcard Certificate:** Dùng 1 chứng chỉ ACM duy nhất cho nhiều subdomain (`shop.dev.*`, `argocd.*`, `grafana.*`) với tự động gia hạn qua DNS validation.

---

## 2. Đặc tả Tài nguyên (Resource Inventory & Config)

| Resource Type | Tên Resource / Domain | Tham số Cấu hình Cốt lõi |
| :--- | :--- | :--- |
| **ACM Certificate** | `*.devopsss.site` / `*.dev.devopsss.site` | Validation: `DNS`, Status: `ISSUED`, Region: `ap-southeast-1` |
| **Route 53 Hosted Zone** | `devopsss.site` | Public Hosted Zone |
| **DNS Records (Alias A)** | `shop.dev.devopsss.site`<br>`shop.staging.devopsss.site`<br>`shop.devopsss.site`<br>`argocd.devopsss.site`<br>`grafana.devopsss.site` | Target: Shared ALB Dual-Stack DNS (`k8s-sreplatform-*`) |

---

## 3. Chiến lược Tagging & Labels

| Tag Key | Tag Value | Mục đích |
| :--- | :--- | :--- |
| `Name` | `sre-platform-dev-acm-cert` | Định danh chứng chỉ TLS |
| `Project` | `sre-platform` | Quản trị tài nguyên edge |
| `Environment` | `shared` | Phục vụ đa môi trường trên Shared ALB |

---

## 4. Tham chiếu IaC / GitOps
- [ingress.yaml](../../gitops/applications/reliability-shop/base/ingress.yaml#L15-L17) — Annotation `certificate-arn` & `ssl-redirect: '443'`.
- [argocd-ingress.yaml](../../gitops/platform/ingress/argocd-ingress.yaml) & [06-grafana-ingress.yaml](../../gitops/platform/monitoring/06-grafana-ingress.yaml).

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
```bash
aws acm list-certificates --region ap-southeast-1 --query "CertificateSummaryList[].{Domain:DomainName,Status:Status}"
```
- **PASS:** Certificate `Status = ISSUED`, DNS records phân giải đúng về Shared ALB.
