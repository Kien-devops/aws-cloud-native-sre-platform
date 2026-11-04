# Kiến trúc bảo mật nền tảng

> Phạm vi: thiết kế mục tiêu cho ReliabilityShop trên AWS/EKS. Chưa có bằng chứng triển khai; xem [mục lục](../README.md) và [README dự án](../../README.md).

## Mục tiêu và ranh giới tin cậy

Bảo vệ chuỗi từ mã nguồn đến workload và dữ liệu. GitHub Actions dùng OIDC, Pod dùng EKS Pod Identity, dữ liệu bí mật không đi qua image, Git hoặc log. Ingress công khai chỉ mở đường dẫn cần thiết; dịch vụ nội bộ dùng ClusterIP và NetworkPolicy.

## Lớp kiểm soát

| Lớp | Kiểm soát | Bằng chứng |
| --- | --- | --- |
| Danh tính | IAM least privilege, OIDC, Pod Identity, RBAC | CloudTrail, audit log |
| Chuỗi cung ứng | Pin SHA, SAST/SCA, secret scan, Trivy | Workflow, ECR scan |
| Mạng | VPC private subnet, SG, WAF, NetworkPolicy | Flow Logs, ALB/WAF logs |
| Runtime | Pod Security, admission, non-root | Events, audit log |
| Dữ liệu | KMS, TLS, Secrets Manager, backup | KMS/CloudTrail |

## Luồng kiểm chứng

1. Gửi request qua ALB; lưu latency, mã phản hồi và trace ID.
2. Đối chiếu dependency với NetworkPolicy và service config.
3. Gọi AWS API bằng Pod Identity; kiểm tra role/resource trong CloudTrail.
4. Thử request bị WAF hoặc NetworkPolicy chặn từ môi trường cô lập.
5. Quét log/trace để bảo đảm không có token, mật khẩu, PII hoặc Secret.

## Xác minh chỉ đọc

Các lệnh **chỉ đọc** để khảo sát trạng thái Kubernetes:

```bash
kubectl get nodes -o wide
kubectl get pods -A -o wide
kubectl get events -A --sort-by=.lastTimestamp
kubectl get networkpolicy -A
kubectl get rolebindings,clusterrolebindings -A
aws cloudtrail lookup-events --lookup-attributes AttributeKey=EventName,AttributeValue=AssumeRoleWithWebIdentity
```

Lưu output cùng timestamp, account, region và phiên bản manifest. Đây là trạng thái quan sát được, chưa phải bằng chứng kiểm thử đầu cuối.

## Xử lý sự cố

| Triệu chứng | Nguyên nhân có thể | Kiểm tra |
| --- | --- | --- |
| 403 từ AWS API | Sai trust policy hoặc IAM action | ServiceAccount, association, CloudTrail |
| Request public bị từ chối | WAF, SG, target health hoặc ingress | ALB/WAF log, target group |
| Pod gọi dependency ngoài ý muốn | NetworkPolicy thiếu hoặc selector sai | Describe policy, Flow Logs |
| Secret lọt vào log | Debug log hoặc telemetry attribute | Tìm pattern, xoay Secret, chặn field |

## Yêu cầu production

Tách account hoặc role/state giữa staging và production. Break-glass role cần MFA, thời hạn ngắn, phê duyệt và CloudTrail. Bật CloudTrail, Config, GuardDuty; giới hạn retention/cardinality telemetry; kiểm thử backup/restore, thu hồi credential và rollback policy.

## Tiêu chí nghiệm thu

- [ ] Có threat model và ranh giới tin cậy
- [ ] Workload dùng role tối thiểu, không credential tĩnh
- [ ] Có bằng chứng đường đi hợp lệ và bị chặn
- [ ] Có runbook xoay Secret, cô lập và rollback
- [ ] Tách Expected với Measured Result

## Tài liệu tham khảo

- [AWS Well-Architected Security Pillar](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/welcome.html)
- [Amazon EKS security](https://docs.aws.amazon.com/eks/latest/best-practices/security.html)
- [Kubernetes Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
