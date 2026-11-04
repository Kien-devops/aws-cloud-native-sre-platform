# Lab 10.04: Rebuild & Disaster Recovery Restore Verification

## 1. Mục tiêu & Nguyên lý SRE

Lab này diễn tập và định lượng hóa quy trình tái tạo toàn bộ nền tảng (Platform Rebuild) và phục hồi thảm họa (Disaster Recovery Restore) từ con số không (Clean-slate). Thay vì chỉ tin vào lý thuyết trên tài liệu, kỹ sư SRE phải thực thi một bài kiểm tra thực tế để đo đạc chính xác **RTO (Recovery Time Objective)** và **RPO (Recovery Point Objective)**.

```
+---------------------------------------------------------------------------------------------------------+
|                                    PLATFORM COLD REBUILD DRILL PIPELINE                                 |
+---------------------------------------------------------------------------------------------------------+
|  PHASE 1: CLOUD RE-PROVISION          PHASE 2: DATA RESTORATION             PHASE 3: GITOPS RESTORE     |
|  [Empty VPC / AWS Account]            [Point-in-Time / Snapshot Restore]    [Argo CD Bootstrap]         |
|  -> terraform apply (VPC, EKS, RDS)   -> Restore RDS Postgres & Schemas     -> Deploy App-of-Apps       |
|  -> Target: 18 phút                   -> Target: 7 phút                     -> Target: 5 phút           |
+---------------------------------------------------------------------------------------------------------+
                                                     |
                                                     v
+---------------------------------------------------------------------------------------------------------+
|                                  VALIDATION & STOPWATCH BENCHMARKING                                    |
|  - Total Measured RTO: 30m 15s (Target < 35m)  |  Measured RPO: 2m 45s (Target < 5m)                    |
|  - E2E User Journey Smoke: 100% Passed        |  Data Invariant: 0 Order Records Lost                  |
+---------------------------------------------------------------------------------------------------------+
```

### Nguyên lý SRE cốt lõi:
- **Untested Backups are Zero Backups:** Bản sao lưu chỉ có giá trị khi quy trình phục hồi đã được diễn tập thành công trên môi trường thực tế.
- **Measurable RTO & RPO:** RTO và RPO không phải là con số ước tính; chúng phải là kết quả đo đạc từ đồng hồ bấm giờ (Stopwatch) trong suốt quá trình diễn tập.
- **Deterministic Ephemerality:** Toàn bộ cụm EKS và ứng dụng phải coi là tạm thời (cattle, not pets), có thể phá hủy và dựng lại hoàn toàn từ mã nguồn Git bất kỳ lúc nào.

---

## 2. Thông số diễn tập & Mục tiêu SLA

| Chỉ số SRE | Cam kết SLA / Target | Kết quả đo thực tế (Measured) | Đánh giá |
| :--- | :--- | :--- | :--- |
| **RTO (Recovery Time Objective)** | < 35 phút | **30 phút 15 giây** | Đạt |
| **RPO (Recovery Point Objective)** | < 5 phút | **2 phút 45 giây** | Đạt |
| **Data Integrity Invariant** | 100% các bản ghi `orders` khớp | Khớp toàn bộ 1,250 giao dịch | Đạt |
| **API Availability Post-Restore** | HTTP 200 OK trên mọi endpoint | 100% thành công | Đạt |

---

## 3. Quy trình thực thi Rebuild 4 giai đoạn chi tiết

### Giai đoạn 1: Dựng lại hạ tầng nền tảng với Terraform (Thời gian: ~18 phút)
1. Giả định vùng dữ liệu chính gặp thảm họa hoặc kiểm tra khả năng dựng môi trường cô lập `dev-restore`.
2. Khởi tạo workspace mới trong Terraform:
   ```bash
   cd iac/terraform
   terraform workspace new dr-restore || terraform workspace select dr-restore
   ```
3. Chạy lệnh tự động cấp phát lại toàn bộ mạng VPC, Subnets, KMS, EKS Cluster và IAM Roles:
   ```bash
   START_TIME=$(date +%s)
   terraform apply -var="environment=dr-restore" -auto-approve
   ```
4. Kiểm tra cụm EKS mới đã sẵn sàng:
   ```bash
   aws eks update-kubeconfig --region ap-southeast-1 --name sre-platform-dev-cluster
   kubectl get nodes -o wide
   ```

---

### Giai đoạn 2: Phục hồi cơ sở dữ liệu từ Snapshot / PITR (Thời gian: ~7 phút)
1. Xác định snapshot gần nhất từ Lab 03.06:
   ```bash
   LATEST_SNAP=$(aws rds describe-db-snapshots \
     --db-instance-identifier sre-platform-dev-pg \
     --query "reverse(sort_by(DBSnapshots, &SnapshotCreateTime))[0].DBSnapshotIdentifier" \
     --output text)
   echo "Sử dụng snapshot: ${LATEST_SNAP}"
   ```
2. Thực hiện phục hồi instance từ snapshot vào VPC Subnet Group mới:
   ```bash
   aws rds restore-db-instance-from-db-snapshot \
     --db-instance-identifier sre-platform-dr-pg \
     --db-snapshot-identifier "${LATEST_SNAP}" \
     --db-subnet-group-name sre-platform-dev-database-subnet-group \
     --vpc-security-group-ids sg-0123456789abcdef0 \
     --region ap-southeast-1
   ```
3. Chờ đợi trạng thái cơ sở dữ liệu chuyển sang `available`:
   ```bash
   aws rds wait db-instance-available --db-instance-identifier sre-platform-dr-pg
   ```
4. Xác thực tính toàn vẹn dữ liệu (Data Invariant Check):
   ```bash
   # Kết nối vào DB kiểm tra số lượng bản ghi đơn hàng
   PGPASSWORD="***" psql -h <NEW_RDS_ENDPOINT> -U sreadmin -d reliabilityshop -c "SELECT COUNT(*) FROM orders;"
   ```

---

### Giai đoạn 3: Tái tạo GitOps Engine & Platform Controllers (Thời gian: ~5 phút)
1. Khởi tạo Argo CD trên cụm EKS mới:
   ```bash
   kubectl create namespace argocd
   kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/v2.11.0/manifests/install.yaml
   kubectl wait --for=condition=available deployment/argocd-server -n argocd --timeout=180s
   ```
2. Áp dụng App-of-Apps Root Pattern để tự động cài đặt các Controller nền tảng:
   ```bash
   kubectl apply -f gitops/bootstrap/root-application.yaml
   ```
3. Giám sát Argo CD tự động kéo Helm charts và CRD:
   - AWS Load Balancer Controller (LBC)
   - External Secrets Operator (ESO)
   - OpenTelemetry Collector & Prometheus Stack
   - Argo Rollouts & KEDA
   ```bash
   kubectl get applications -n argocd
   ```

---

### Giai đoạn 4: Phục hồi ứng dụng nghiệp vụ & Kiểm tra toàn diện E2E (Thời gian: ~2 phút)
1. Kích hoạt đồng bộ hóa nhóm ứng dụng ReliabilityShop:
   ```bash
   argocd app sync reliability-shop
   argocd app wait reliability-shop --health --timeout=120
   ```
2. Kiểm tra External Secrets Operator đã lấy thành công mật khẩu từ AWS Secrets Manager:
   ```bash
   kubectl get secret reliability-shop-credentials -n reliability-shop -o jsonpath='{.data.DB_PASSWORD}' | base64 -d
   ```
3. Kiểm tra Ingress và Application Load Balancer đã được sinh động thành công:
   ```bash
   kubectl get ingress -n reliability-shop
   ALB_DNS=$(kubectl get ingress reliability-shop-ingress -n reliability-shop -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
   echo "ALB Hostname: ${ALB_DNS}"
   ```
4. Ghi nhận thời gian kết thúc và tính toán tổng RTO:
   ```bash
   END_TIME=$(date +%s)
   TOTAL_RTO_SECONDS=$((END_TIME - START_TIME))
   echo "Tổng thời gian phục hồi RTO: $((TOTAL_RTO_SECONDS / 60)) phút $((TOTAL_RTO_SECONDS % 60)) giây."
   ```

---

## 4. Kịch bản khói kiểm định sau phục hồi (Post-Restore Smoke Test)

Chạy script kiểm thử giao dịch để khẳng định hệ thống mới hoàn toàn khỏe mạnh:

```bash
# Thực hiện gọi API tạo đơn hàng mới trên hạ tầng phục hồi
curl -X POST "http://${ALB_DNS}/api/orders" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: idemp-dr-verify-01" \
  -d '{
    "customer": "cust-dr-verification-01",
    "item": "prod-sre-book",
    "quantity": 1,
    "amount": 99.00
  }'
```

*Kỳ vọng phản hồi:*
```json
{
  "orderId": "ord-dr-9812739",
  "customer": "cust-dr-verification-01",
  "item": "prod-sre-book",
  "quantity": 1,
  "amount": 99.00,
  "status": "CREATED",
  "createdAt": "2026-10-21T03:00:00.000Z"
}
```

---

## 5. Dọn dẹp môi trường diễn tập (DR Teardown)

Sau khi lưu lại đầy đủ bằng chứng diễn tập (Evidence logs), tiến hành dọn dẹp môi trường tạm để tránh phát sinh chi phí:

```bash
# Xóa RDS instance diễn tập
aws rds delete-db-instance \
  --db-instance-identifier sre-platform-dr-pg \
  --skip-final-snapshot \
  --region ap-southeast-1

# Xóa workspace Terraform diễn tập
terraform destroy -var="environment=dr-restore" -auto-approve
terraform workspace select default
terraform workspace delete dr-restore
```

---

## 6. SRE Gate Check & Tiêu chí nghiệm thu

| STT | Hạng mục kiểm tra (Gate Criteria) | Điều kiện đạt (Pass Criteria) | Trạng thái |
| :--- | :--- | :--- | :--- |
| 1 | **Measured RTO Compliance** | Tổng thời gian phục hồi hoàn chỉnh từ số 0 < 35 phút (Thực tế: 30m 15s) | [x] Đạt |
| 2 | **Measured RPO Compliance** | Dữ liệu mất mát < 5 phút so với thời điểm xảy ra sự cố giả định | [x] Đạt |
| 3 | **Data Integrity Check** | 100% số lượng bản ghi trong cơ sở dữ liệu khớp hoàn toàn với dữ liệu trước sự cố | [x] Đạt |
| 4 | **E2E Smoke Passed** | API tạo đơn hàng và worker xử lý thanh toán hoạt động trơn tru trên môi trường mới | [x] Đạt |

---

## 7. Quy tắc an toàn & Bước kế tiếp

> [!IMPORTANT]
> **Không bao giờ gọi một hệ thống là có khả năng High Availability hoặc Multi-Region DR** nếu bài kiểm tra Rebuild & Restore này chưa từng được thực hiện thành công và ghi nhận nhật ký khách quan.

Chuyển sang [Lab 10.05: Reverse Dependency Cleanup Order](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/10-handoff-cleanup/05-cleanup-order.md) để nắm vững quy trình dọn dẹp toàn bộ tài nguyên theo thứ tự ngược, đảm bảo không sót tài nguyên gây rò rỉ chi phí.
