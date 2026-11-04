# Module 00: Chuẩn bị môi trường & Nguyên tắc SRE

## 1. Tổng quan Module

Module 00 thiết lập nền tảng quản trị tài khoản, định danh khu vực vận hành, quy ước đặt tên & gắn thẻ (Naming & Tagging Standards), kiểm soát ngân sách đám mây (AWS Budgets), và quy tắc bảo vệ bằng chứng (Evidence Management & Redaction Invariant) trước khi khởi tạo bất kỳ tài nguyên điện toán nào.

---

## 2. Danh mục bài Lab chi tiết

| Bài Lab | Tiêu đề | Trọng tâm kỹ thuật | Console / CLI Path |
| :--- | :--- | :--- | :--- |
| [**00.01**](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/00-chuan-bi/01-account-region-identity.md) | **Tài khoản, Region & Identity** | Khóa Root Account MFA, cô lập Region `ap-southeast-1`, kiểm tra Service Quotas đa AZ | AWS Console > IAM / Service Quotas |
| [**00.02**](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/00-chuan-bi/02-naming-tagging-budget.md) | **Naming, Tagging & AWS Budget** | Chuẩn hóa tiền tố `sre-platform-dev-*`, cấu hình AWS Budgets $50/tháng (50%, 80%, 100%) | AWS Billing > Budgets |
| [**00.03**](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/00-chuan-bi/03-evidence-approval.md) | **Evidence & Redaction Invariant** | Quy chuẩn thu thập nhật ký CloudTrail, che giấu 100% Account ID, private tokens, keys | CloudTrail > Event history |

---

## 3. Tiêu chí hoàn thành Module (Exit Gate)

- [ ] Tài khoản AWS sử dụng IAM Identity Center hoặc IAM User đặc quyền tối thiểu; Root Account đã kích hoạt Hardware/Virtual MFA và khóa Access Key.
- [ ] Vùng hoạt động cố định tại Singapore `ap-southeast-1`; xác nhận khả năng cấp phát tối thiểu 3 Availability Zones (AZs).
- [ ] AWS Budgets cảnh báo $50.00/tháng được kích hoạt và gửi email thử nghiệm thành công.
- [ ] Bộ quy chuẩn Redaction được phổ biến, cam kết không lộ Account ID trong các pull request evidence.
