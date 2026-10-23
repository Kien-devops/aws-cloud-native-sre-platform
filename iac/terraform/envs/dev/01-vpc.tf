# VPC
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "sre-platform-dev-vpc"
    Environment = var.environment
    Project     = "sre-platform"
    ManagedBy   = "Console-to-IaC"
  }
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "sre-platform-dev-igw"
    Environment = var.environment
    Project     = "sre-platform"
  }
}

# Public Subnets
resource "aws_subnet" "public_1a" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.0.0/24"
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = true

  tags = {
    Name                                    = "sre-platform-dev-public-1a"
    Environment                             = var.environment
    Project                                 = "sre-platform"
    "kubernetes.io/role/elb"                = "1"
    "kubernetes.io/cluster/sre-platform-dev" = "shared"
  }
}

resource "aws_subnet" "public_1b" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "${var.aws_region}b"
  map_public_ip_on_launch = true

  tags = {
    Name                                    = "sre-platform-dev-public-1b"
    Environment                             = var.environment
    Project                                 = "sre-platform"
    "kubernetes.io/role/elb"                = "1"
    "kubernetes.io/cluster/sre-platform-dev" = "shared"
  }
}

# Private Application Subnets (EKS Workloads)
resource "aws_subnet" "private_app_1a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.10.0/24"
  availability_zone = "${var.aws_region}a"

  tags = {
    Name                                     = "sre-platform-dev-private-app-1a"
    Environment                              = var.environment
    Project                                  = "sre-platform"
    "kubernetes.io/role/internal-elb"        = "1"
    "kubernetes.io/cluster/sre-platform-dev" = "shared"
    "karpenter.sh/discovery"                 = "sre-platform-dev"
  }
}

resource "aws_subnet" "private_app_1b" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.11.0/24"
  availability_zone = "${var.aws_region}b"

  tags = {
    Name                                     = "sre-platform-dev-private-app-1b"
    Environment                              = var.environment
    Project                                  = "sre-platform"
    "kubernetes.io/role/internal-elb"        = "1"
    "kubernetes.io/cluster/sre-platform-dev" = "shared"
    "karpenter.sh/discovery"                 = "sre-platform-dev"
  }
}

# Private Database Subnets (RDS & Redis)
resource "aws_subnet" "private_db_1a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.20.0/24"
  availability_zone = "${var.aws_region}a"

  tags = {
    Name        = "sre-platform-dev-private-db-1a"
    Environment = var.environment
    Project     = "sre-platform"
    Component   = "database"
  }
}

resource "aws_subnet" "private_db_1b" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.21.0/24"
  availability_zone = "${var.aws_region}b"

  tags = {
    Name        = "sre-platform-dev-private-db-1b"
    Environment = var.environment
    Project     = "sre-platform"
    Component   = "database"
  }
}

# Elastic IP for NAT Gateway
resource "aws_eip" "nat" {
  domain = "vpc"

  tags = {
    Name        = "sre-platform-dev-nat-eip-1a"
    Environment = var.environment
    Project     = "sre-platform"
  }
}

# NAT Gateway (Single AZ for FinOps dev)
resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public_1a.id

  tags = {
    Name        = "sre-platform-dev-nat-1a"
    Environment = var.environment
    Project     = "sre-platform"
  }

  depends_on = [aws_internet_gateway.main]
}

# Public Route Table
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name        = "sre-platform-dev-rt-public"
    Environment = var.environment
    Project     = "sre-platform"
  }
}

# Private App Route Table
resource "aws_route_table" "private_app" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }

  tags = {
    Name        = "sre-platform-dev-rt-private-app"
    Environment = var.environment
    Project     = "sre-platform"
  }
}

# Private DB Route Table
resource "aws_route_table" "private_db" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "sre-platform-dev-rt-private-db"
    Environment = var.environment
    Project     = "sre-platform"
  }
}

# Route Table Associations
resource "aws_route_table_association" "public_1a" {
  subnet_id      = aws_subnet.public_1a.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_1b" {
  subnet_id      = aws_subnet.public_1b.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private_app_1a" {
  subnet_id      = aws_subnet.private_app_1a.id
  route_table_id = aws_route_table.private_app.id
}

resource "aws_route_table_association" "private_app_1b" {
  subnet_id      = aws_subnet.private_app_1b.id
  route_table_id = aws_route_table.private_app.id
}

resource "aws_route_table_association" "private_db_1a" {
  subnet_id      = aws_subnet.private_db_1a.id
  route_table_id = aws_route_table.private_db.id
}

resource "aws_route_table_association" "private_db_1b" {
  subnet_id      = aws_subnet.private_db_1b.id
  route_table_id = aws_route_table.private_db.id
}

# S3 Gateway Endpoint (Zero Data Transfer Cost)
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"

  route_table_ids = [
    aws_route_table.public.id,
    aws_route_table.private_app.id,
    aws_route_table.private_db.id
  ]

  tags = {
    Name        = "sre-platform-dev-vpce-s3"
    Environment = var.environment
    Project     = "sre-platform"
  }
}

