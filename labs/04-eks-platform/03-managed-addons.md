# 04.03 - EKS managed add-ons

## Mục tiêu

Cài add-on tương thích: VPC CNI, CoreDNS, kube-proxy, EBS CSI và Pod Identity Agent khi cần.

## Input

- Cluster version, add-on versions tương thích, IAM role cho add-on và conflict policy.
- KMS/Pod Identity policy, maintenance window và rollback version.

## Console steps

1. Vào **EKS > Clusters > <cluster> > Add-ons > Get more add-ons**.
2. Chọn từng add-on, pin phiên bản tương thích và cấu hình role nếu cần.
3. Chọn conflict resolution có chủ đích; không overwrite cấu hình chưa review.
4. Cài lần lượt, chờ trạng thái **Active** trước add-on kế tiếp.
5. Ghi version, health issues và configuration values.

## Verify

- Add-on cần thiết ở `Active`; không có health issue chưa triage.
- CNI có IP capacity, CoreDNS trả lời được, kube-proxy/EBS CSI hoạt động.
- Không cài cùng add-on từ Helm/GitOps nếu Console đang sở hữu object.

## Output

- **Expected:** VPC CNI, CoreDNS, kube-proxy và EBS CSI healthy.
- **Measured Result:** Chưa thực hiện; lưu addon status/version.

Danh sách add-on/version/status, IAM association, conflict policy, health issue và timestamp.

## Gate

Ownership được ghi rõ: managed add-on hoặc GitOps, không đồng thời cả hai.

## Cleanup

Không gỡ add-on nền tảng khi cluster còn workload phụ thuộc. Hạ version/gỡ theo compatibility và rollback plan.

