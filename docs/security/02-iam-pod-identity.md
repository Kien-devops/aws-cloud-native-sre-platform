# IAM và EKS Pod Identity

> **Loại tài liệu:** hướng dẫn thiết kế và thực nghiệm, chưa chứng minh tài nguyên AWS đã triển khai. Tham khảo [mục lục](../README.md) và [README dự án](../../README.md).

## Vì sao dùng Pod Identity

Pod cần gọi AWS API mà không nhúng access key vào image. Pod Identity gắn ServiceAccount với IAM role và cấp credential tạm thời qua agent cùng SDK credential chain; quyền node không thay cho quyền workload.

Trong project, thước đo sau cùng luôn là **trải nghiệm người dùng và khả năng khôi phục dịch vụ**. Việc có công cụ hoặc manifest không thay thế được bằng chứng thực nghiệm.

## Luồng cấp quyền

Pod → ServiceAccount → EKS Pod Identity Agent → credential endpoint → AWS SDK → STS/IAM policy → AWS API. Trust policy, association, resource và namespace/service account phải cùng khớp. Pod Identity không thay RBAC hoặc NetworkPolicy.

| Workload | Resource | Quyền tối thiểu |
| --- | --- | --- |
| order-api | SQS queue đặt hàng | SendMessage, GetQueueAttributes |
| payment-worker | SQS queue thanh toán | ReceiveMessage, DeleteMessage, ChangeMessageVisibility |
| secret-sync | Secret ARN cụ thể | GetSecretValue, DescribeSecret |

Luồng này mang tính logic; khi dựng phải xác nhận đúng network routes, resource ownership, telemetry paths và IAM.

## Kiểm chứng

Đối chiếu ServiceAccount, association, CloudTrail và kết quả gọi API. Không in credential hoặc token.

```bash
kubectl get serviceaccount -A
kubectl get pods -A -o custom-columns='NAMESPACE:.metadata.namespace,NAME:.metadata.name,SA:.spec.serviceAccountName'
kubectl -n kube-system get pods -l app.kubernetes.io/name=eks-pod-identity-agent
aws eks list-pod-identity-associations --cluster-name <cluster-name>
aws cloudtrail lookup-events --lookup-attributes AttributeKey=EventName,AttributeValue=AssumeRole
```

**Expected:** Pod lấy được credential tạm thời và chỉ gọi API đã cấp. **Measured Result:** cần CloudTrail event, mã phản hồi và resource.

## Sự cố thường gặp

| Triệu chứng | Nguyên nhân có thể | Kiểm tra |
| --- | --- | --- |
- `AccessDenied`: kiểm tra role ARN, association, trust condition, action/resource và region.
- Credential endpoint timeout: kiểm tra agent DaemonSet, DNS, SG và network path.
- Pod dùng quyền node: kiểm tra SDK chain, biến môi trường credential và admission policy.
- Cross-account thất bại: kiểm tra trust role nguồn và `sts:AssumeRole`.

## Vận hành an toàn

Pin phiên bản add-on/agent. Theo dõi lỗi STS, latency API và CloudTrail; xoay hoặc thu hồi role khi phát hiện lạm quyền. Break-glass role phải có phê duyệt và thời hạn ngắn.

Ngoài ra phải áp dụng least privilege, tách staging/prod, kiểm soát telemetry cardinality/retention, bảo vệ dữ liệu nhạy cảm, giới hạn blast radius, dự trù chi phí và ghi rõ failure domain.

## Checklist

- [ ] Mỗi ServiceAccount production có role mục đích rõ ràng.
- [ ] Policy giới hạn action, resource và điều kiện.
- [ ] Association được kiểm tra sau thay đổi IaC/GitOps.
- [ ] Có test Allow và Deny, kèm CloudTrail evidence.
- [ ] Có quy trình thu hồi role và rollback association.

## Tham khảo

- [EKS Pod Identity](https://docs.aws.amazon.com/eks/latest/userguide/pod-identities.html)
- [IAM best practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
