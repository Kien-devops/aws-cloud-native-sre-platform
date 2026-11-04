# Cổng bảo mật DevSecOps

> **Loại tài liệu:** hướng dẫn thiết kế và thực nghiệm, chưa chứng minh tài nguyên AWS đã triển khai. Tham khảo [mục lục](../README.md) và [README dự án](../../README.md).

## Mục tiêu

Gate chặn artifact không đạt chuẩn trước khi promote. Tài liệu không tự khẳng định pipeline đã chạy thành công.

Trong project, thước đo sau cùng luôn là **trải nghiệm người dùng và khả năng khôi phục dịch vụ**. Việc có công cụ hoặc manifest không thay thế được bằng chứng thực nghiệm.

## Chuỗi kiểm soát

Commit/PR → lint, unit, SAST/SCA, secret scan → build image → SBOM, Trivy, ký/digest → ECR → policy/admission → GitOps PR → Argo CD → rollout/SLI → promote hoặc rollback. Production dùng fail-closed; exception phải có owner và ngày hết hạn. Không dùng tag mutable như `latest`.

| Gate | Chặn khi | Bằng chứng |
| --- | --- | --- |
| Chất lượng mã | Lint/unit/contract lỗi | Test report |
| SAST/SCA | Vi phạm mức nghiêm trọng | SARIF, dependency report |
| Secret scan | Credential hoặc khóa | Output đã redact |
| Image | CVE ngoài ngưỡng hoặc không pin | Trivy/SBOM/ECR |
| IaC/Kubernetes | RBAC rộng, privileged, sai policy | Checkov, kubeconform |
| Phát hành | Thiếu approval, digest/provenance | Environment, attestation |
| Runtime | SLI xấu hoặc rollout không Ready | Prometheus, Argo, Events |

Luồng này mang tính logic; khi dựng phải xác nhận đúng network routes, resource ownership, telemetry paths và IAM.

## Quyền CI và GitOps

GitHub Actions dùng OIDC giới hạn repository, branch và environment. Build role chỉ push ECR; deploy role chỉ cập nhật GitOps/API được cấp. Argo CD đọc desired state, không cấp quyền build. Production cần review, protected environment và audit.

```bash
git diff --check
terraform fmt -check -recursive iac/terraform
kubectl apply --dry-run=server -f <manifest>
kubectl auth can-i --list --as=system:serviceaccount:<namespace>:<serviceaccount>
aws ecr describe-image-scan-findings --repository-name <repo> --image-id imageDigest=<digest>
```

**Expected:** artifact lỗi bị dừng, không tạo GitOps PR production. **Measured Result:** lưu run ID, commit SHA, digest, gate status và timestamp.

## Sự cố và rollback

| Triệu chứng | Nguyên nhân có thể | Kiểm tra |
| --- | --- | --- |
- False positive: kiểm tra scanner/rule; exception phải có hạn sử dụng.
- ECR scan pending: giữ pending, không promote.
- Digest không tồn tại: dừng sync, sửa provenance rồi chạy lại.
- Canary SLI xấu: abort Argo Rollouts, xác minh traffic và mở incident.
- Credential CI lộ: vô hiệu hóa, rotate, kiểm tra CloudTrail và artifact history.

Rollback phải trỏ về digest đã biết tốt, có health check phía client; không rollback bằng tag mutable.

## Yêu cầu production

Pin action theo SHA, branch protection, CODEOWNERS, SBOM/provenance, runner giới hạn và dependency update có kiểm soát. Đồng bộ policy giữa CI, admission và ECR; lớp nghiêm ngặt hơn làm chuẩn.

Ngoài ra phải áp dụng least privilege, tách staging/prod, kiểm soát telemetry cardinality/retention, bảo vệ dữ liệu nhạy cảm, giới hạn blast radius, dự trù chi phí và ghi rõ failure domain.

## Checklist

- [ ] Mỗi gate có owner, ngưỡng và artifact bằng chứng.
- [ ] Fail-closed cho production; exception có ngày hết hạn.
- [ ] Image dùng digest/SHA, không dùng latest.
- [ ] OIDC/IAM không dùng access key tĩnh.
- [ ] Đã diễn tập reject, rollback và thu hồi credential.

## Tham khảo

- [GitHub OpenID Connect](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
- [Amazon ECR image scanning](https://docs.aws.amazon.com/AmazonECR/latest/userguide/image-scanning.html)
- [Trivy](https://aquasecurity.github.io/trivy/)
- [SLSA](https://slsa.dev/)
