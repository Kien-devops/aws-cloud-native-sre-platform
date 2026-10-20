# 04.05 - Kiểm tra sức khỏe nền tảng EKS

## Mục tiêu

Chốt baseline trước khi bàn giao cluster cho GitOps.

## Input

- Cluster/add-on/node group outputs từ các lab trước.
- Quyền đọc EKS, EC2, CloudWatch và Kubernetes context đã phê duyệt.

## Console steps

1. Kiểm tra **EKS > Cluster > Overview, Compute, Add-ons, Logging**.
2. Kiểm tra **EC2 > Auto Scaling Groups/Instances**, subnet và security group.
3. Kiểm tra **CloudWatch > Log groups/Container insights** nếu đã bật.
4. Ghi mọi warning/health issue trước khi mở GitOps handoff.

## Verify

```bash
aws eks describe-cluster --name <cluster> --query 'cluster.status'
kubectl get nodes -o wide
kubectl get pods -n kube-system
```

**Expected:** cluster `Active`, node `Ready`, add-on healthy và topology đúng thiết kế. **Measured Result:** điền output thật kèm timestamp.

## Output

Baseline health report, unresolved issues, version matrix, AZ/node capacity và quyết định `Pass`/`Hold`.

## Gate

Chỉ chuyển sang ingress/GitOps khi không còn lỗi nền tảng P0/P1 và ownership matrix đã ghi rõ.

## Cleanup

Giữ baseline làm evidence; không xóa log cần cho troubleshooting hoặc audit.

