# 08.04 Karpenter và capacity

## Handoff

- Console: `EKS > Compute > Nodes` và `Service Quotas` kiểm tra capacity/quota.
- GitOps: NodeClass/NodePool trong `gitops/platform/karpenter/`; controller dùng Pod Identity.

## Checklist

- [ ] Giới hạn instance family, architecture, AZ, capacity type và tổng CPU.
- [ ] Kiểm tra subnet IP, security group, AMI và disruption budget.
- [ ] Đặt taint/label phù hợp workload; không cho node ngoài policy.
- [ ] Tạo workload pending có kiểm soát để xác nhận provisioning.
- [ ] Xác nhận node Ready, Pod schedule và cost estimate.

**Expected:** Karpenter chỉ tạo capacity đáp ứng constraint; node được drain an toàn.  
**Measured:** Chưa thực hiện.  
**Gate:** PDB/topology vẫn đạt; quota và ngân sách không bị vượt.  
**Cleanup:** scale workload về baseline; xóa NodePool test sau khi node đã terminate an toàn.
