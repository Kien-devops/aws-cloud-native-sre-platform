# Lab 05 - Secret, DNS và Ingress

Nhóm này chuẩn bị secret runtime và đường vào HTTPS. Secrets Manager, ACM và Route 53 là AWS resources; External Secrets, AWS Load Balancer Controller và Ingress manifest thuộc GitOps handoff, không triển khai chồng bằng Console.

## Thứ tự

`01-secrets-manager` → `02-external-secrets-handoff` → `02-acm-route53` → `03-load-balancer-controller-prereqs` → `04-alb-ingress-validation`.

## Prerequisite

EKS healthy, VPC/SG/subnets đúng, Pod Identity role đã có, domain đã kiểm soát DNS và certificate validation method được phê duyệt.

