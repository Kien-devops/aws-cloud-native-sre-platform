Set-Location $PSScriptRoot

$ACCOUNT_ID = aws sts get-caller-identity --query Account --output text
Write-Host "Discovered AWS Account ID: $ACCOUNT_ID"

$resources = @(
    @{ Address = "aws_internet_gateway.main"; Id = "igw-07427296746759fb9" },
    @{ Address = "aws_subnet.public_1a"; Id = "subnet-074e082bf2a86ea47" },
    @{ Address = "aws_subnet.public_1b"; Id = "subnet-0bbfb35d15f293475" },
    @{ Address = "aws_subnet.private_app_1a"; Id = "subnet-0838b9e2aa7233726" },
    @{ Address = "aws_subnet.private_app_1b"; Id = "subnet-02d8bb33c2d7d3d74" },
    @{ Address = "aws_subnet.private_db_1a"; Id = "subnet-0dc80c45c6c682ee0" },
    @{ Address = "aws_subnet.private_db_1b"; Id = "subnet-06a61debfb4609ba4" },
    @{ Address = "aws_eip.nat"; Id = "eipalloc-0c54f5666d4b600ad" },
    @{ Address = "aws_nat_gateway.main"; Id = "nat-0bc6ebf38ab2006ef" },
    @{ Address = "aws_route_table.public"; Id = "rtb-01cf3a9176b9ddcf7" },
    @{ Address = "aws_route_table.private_app"; Id = "rtb-04b0e83977ae4c478" },
    @{ Address = "aws_route_table.private_db"; Id = "rtb-01a899c1f44dc9baa" },
    @{ Address = "aws_route_table_association.public_1a"; Id = "subnet-074e082bf2a86ea47/rtb-01cf3a9176b9ddcf7" },
    @{ Address = "aws_route_table_association.public_1b"; Id = "subnet-0bbfb35d15f293475/rtb-01cf3a9176b9ddcf7" },
    @{ Address = "aws_route_table_association.private_app_1a"; Id = "subnet-0838b9e2aa7233726/rtb-04b0e83977ae4c478" },
    @{ Address = "aws_route_table_association.private_app_1b"; Id = "subnet-02d8bb33c2d7d3d74/rtb-04b0e83977ae4c478" },
    @{ Address = "aws_route_table_association.private_db_1a"; Id = "subnet-0dc80c45c6c682ee0/rtb-01a899c1f44dc9baa" },
    @{ Address = "aws_route_table_association.private_db_1b"; Id = "subnet-06a61debfb4609ba4/rtb-01a899c1f44dc9baa" },
    @{ Address = "aws_vpc_endpoint.s3"; Id = "vpce-02e65d55815cd4ce7" },
    @{ Address = "aws_kms_key.main"; Id = "e5164492-8e17-4d65-b1c5-66b7b9601800" },
    @{ Address = "aws_kms_alias.main"; Id = "alias/sre-platform-dev-main" },
    @{ Address = "aws_eks_cluster.main"; Id = "sre-platform-dev" },
    @{ Address = "aws_eks_node_group.system"; Id = "sre-platform-dev:sre-platform-dev-system-nodes" },
    @{ Address = "aws_db_subnet_group.main"; Id = "sre-platform-dev-rds-subnet-group" },
    @{ Address = "aws_db_instance.postgres"; Id = "sre-platform-dev-pg" },
    @{ Address = "aws_sqs_queue.order_dlq"; Id = "https://sqs.ap-southeast-1.amazonaws.com/$ACCOUNT_ID/reliability-shop-dev-order-dlq" },
    @{ Address = "aws_sqs_queue.order_queue"; Id = "https://sqs.ap-southeast-1.amazonaws.com/$ACCOUNT_ID/reliability-shop-dev-order-queue" }
)

foreach ($r in $resources) {
    Write-Host "Importing $($r.Address) with ID $($r.Id)..."
    terraform import $r.Address $r.Id
}
