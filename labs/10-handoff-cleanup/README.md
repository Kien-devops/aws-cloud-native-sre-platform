# Module 10: Handoff, State Reconciliation & Reverse Cleanup

## 1. Tổng quan Module

Module 10 là chặng về đích của dự án **AWS Cloud-Native SRE Platform**. Sau khi toàn bộ nền tảng và ứng dụng thương mại điện tử mẫu `ReliabilityShop` đã trải qua các bài kiểm định tải (k6), khả năng tự phục hồi (Chaos GameDay), giám sát SLO (Error Budget Burn Rate) và đạt quyết định Go-Live ở Module 09, Module 10 sẽ thực hiện quy trình kỹ thuật chuyển giao:
1. **Kiểm kê tài sản & Định danh quyền sở hữu (Resource Inventory & Ownership Cataloging)**.
2. **Đồng bộ trạng thái thực tế vào mã nguồn hạ tầng (Terraform Import & State Reconciliation)**.
3. **Phân định ranh giới sở hữu giữa IaC và GitOps (Separation of Concerns & Drift Management)**.
4. **Diễn tập phục hồi thảm họa từ con số không (Cold Rebuild & Restore Drill)**.
5. **Dọn dẹp môi trường thử nghiệm theo thứ tự phụ thuộc ngược (Reverse Dependency Teardown Order)**.
6. **Kiểm toán chi phí, xác nhận trạng thái $0.00 và bàn giao vận hành (Cost Audit & Production Handoff)**.

---

## 2. Kiến trúc luồng thực hiện (Module Flow Diagram)

```
+---------------------------------------------------------------------------------------------------------+
|                                  MODULE 10: EXECUTION ARCHITECTURE                                      |
+---------------------------------------------------------------------------------------------------------+
|                                                                                                         |
|   10.01 Resource Inventory         ===>     10.02 GitOps Drift Reconciliation                           |
|   - Quét Tag Editor & Resources            - Cấu hình selfHeal: true / prune: true                      |
|   - Phát hiện tài nguyên mồ côi            - Loại trừ dynamic controller resources                      |
|   - Gắn tag chuẩn hóa 5 trường             - Reconcile đạt 100% Synced & Healthy                        |
|                 |                                          |                                            |
|                 v                                          v                                            |
|   10.03 GitOps Ownership           ===>     10.04 Rebuild & DR Restore                                  |
|   - Phân định Console vs GitOps            - Thử nghiệm phục hồi từ Git & Console                       |
|   - Bật Argo CD selfHeal/prune             - Phục hồi RDS snapshot & invariants                         |
|   - Không chỉnh sửa thủ công               - Đo đạc thực tế RTO (<35m) và RPO (<5m)                     |
|                 |                                          |                                            |
|                 v                                          v                                            |
|   10.05 Reverse Cleanup Order      ===>     10.06 Cost Audit & Handoff                                  |
|   - Ingress -> Apps -> Nodes               - Phân tích AWS Cost Explorer                                |
|   - EKS -> RDS/Redis -> VPC                - Kích hoạt Cost Anomaly Detection                           |
|   - Săn lùng orphan ENI/EIP/EBS            - Xác nhận $0.00 và ký bàn giao                              |
|                                                                                                         |
+---------------------------------------------------------------------------------------------------------+
```

---

## 3. Danh mục các bài Lab chi tiết

| Mã bài Lab | Tiêu đề | Trọng tâm kỹ thuật | Console / CLI Path |
| :--- | :--- | :--- | :--- |
| [**10.01**](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/10-handoff-cleanup/01-resource-inventory.md) | **Resource Inventory & Ownership** | Quét Tag Editor, tạo Resource Group, gắn tag chuẩn hóa, phát hiện tài nguyên mồ côi | `Resource Groups > Tag Editor` |
| [**10.02**](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/10-handoff-cleanup/02-gitops-drift-reconciliation.md) | **GitOps Drift Reconciliation** | Tự động hòa giải trôi lệch cấu hình qua Argo CD selfHeal/prune, loại bỏ dynamic drift | Argo CD UI + Git |
| [**10.03**](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/10-handoff-cleanup/03-gitops-ownership.md) | **GitOps Ownership & Boundaries** | Phân định ranh giới hạ tầng Console và ứng dụng GitOps, cấm chỉnh sửa kubectl trực tiếp | Argo CD UI + `kubectl` |
| [**10.04**](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/10-handoff-cleanup/04-rebuild-restore.md) | **Rebuild & Restore Verification** | Diễn tập Cold Rebuild từ code Git và snapshot DB, bấm giờ đo đạc RTO và RPO thực tế | AWS Console + GitOps |
| [**10.05**](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/10-handoff-cleanup/05-cleanup-order.md) | **Reverse Dependency Teardown** | Hủy tài nguyên theo thứ tự phụ thuộc ngược, chạy script săn lùng leak chi phí | AWS Console + Bash Hunter |
| [**10.06**](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/10-handoff-cleanup/06-cost-audit.md) | **Cost Audit & Production Handoff** | Kiểm toán AWS Billing Cost Explorer, xác nhận $0.00 idle spend, lập biên bản bàn giao | `Billing > Cost Explorer` |

---

## 4. Tiêu chí nghiệm thu hoàn thành Module 10 (Exit Gate)

Trước khi đóng lại dự án, toàn bộ các tiêu chí sau phải được đánh dấu hoàn tất:

- [ ] **Inventory Verified:** Toàn bộ tài nguyên hạ tầng được đối chiếu và khớp 100% với file thiết kế.
- [ ] **IaC Parity:** Mã nguồn Terraform chạy `plan` trả về `0 to add, 0 to change, 0 to destroy`.
- [ ] **DR Verified:** Khả năng phục hồi hệ thống đạt RTO < 35 phút và RPO < 5 phút với dữ liệu nguyên vẹn.
- [ ] **Zero Waste:** Không còn bất kỳ tài nguyên tính phí theo giờ nào lẩn khuất (0 EC2, 0 EKS, 0 RDS, 0 NAT, 0 ALB, 0 Orphan EIP/EBS).
- [ ] **Handoff Signed:** Biên bản bàn giao kỹ thuật được đại diện Platform Engineering và Operations ký duyệt.
