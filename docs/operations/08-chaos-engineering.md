# Chaos engineering

Chaos engineering kiểm chứng giả thuyết resilience bằng fault có kiểm soát.

~~~text
Steady state -> giả thuyết -> fault nhỏ -> quan sát -> abort/rollback -> học
~~~

## Điều kiện an toàn

- Có owner, người trực, baseline SLI và rollback.
- Không có incident hoặc deploy khác.
- Fault giới hạn namespace, label, thời gian và target.
- Tự dừng khi error rate, latency hoặc data risk vượt ngưỡng.
- Mặc định chạy dev/staging; production cần phê duyệt thay đổi.

## Thí nghiệm Pod failure

**Giả thuyết:** xóa một Pod Order Service không làm availability dưới 99,9%; replica mới Ready trong 120 giây.

~~~yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: PodChaos
metadata:
  name: order-one-pod-failure
  namespace: reliability-shop
spec:
  action: pod-kill
  mode: one
  selector:
    labelSelectors:
      app.kubernetes.io/name: order-service
  duration: 30s
~~~

Quan sát client error, p95/p99, available replicas, scheduling, ALB target health và trace.

## Quy trình game day

1. Review giả thuyết, blast radius, abort và communication.
2. Ghi baseline 15 phút.
3. Chạy đúng một fault.
4. Abort khi vượt stop condition.
5. Xác nhận steady state, cleanup CR và tạo action item.

| Kết quả | Nội dung |
| --- | --- |
| **Expected** | Traffic chuyển sang replica khỏe; Pod mới Ready <= 120 giây; không lỗi dữ liệu. |
| **Measured** | Chưa chạy. Ghi timestamp, target UID, SLI, recovery time, events và cleanup. |

## Troubleshooting và production

- Fault không tác dụng: kiểm tra selector, namespace, controller và RBAC.
- Blast radius lớn: dừng experiment, xóa schedule, xác minh fault đã kết thúc.
- Recovery chậm: kiểm tra image pull, scheduling, PDB, quota và readiness.
- Metric thiếu: hủy test; không kết luận khi không quan sát được steady state.
- Không network partition database nếu chưa hiểu consistency và fencing.
