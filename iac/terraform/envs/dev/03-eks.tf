data "aws_caller_identity" "current" {}

resource "aws_eks_cluster" "main" {
  name                          = "sre-platform-dev"
  role_arn                      = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/sre-platform-dev-eks-cluster-role"
  version                       = "1.37"
  bootstrap_self_managed_addons = false
  enabled_cluster_log_types     = ["api", "audit", "authenticator", "controllerManager", "scheduler"]

  vpc_config {
    subnet_ids              = [aws_subnet.private_app_1a.id, aws_subnet.private_app_1b.id]
    endpoint_private_access = true
    endpoint_public_access  = true
  }

  access_config {
    authentication_mode                         = "API_AND_CONFIG_MAP"
    bootstrap_cluster_creator_admin_permissions = true
  }

  tags = {
    Name        = "sre-platform-dev"
    Environment = var.environment
    Project     = "sre-platform"
  }
}

resource "aws_eks_node_group" "system" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "sre-platform-dev-system-nodes"
  node_role_arn   = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/sre-platform-dev-node-role"
  subnet_ids      = [aws_subnet.private_app_1a.id, aws_subnet.private_app_1b.id]
  instance_types  = ["t3.medium"]

  scaling_config {
    desired_size = 2
    max_size     = 15
    min_size     = 2
  }

  tags = {
    Name        = "sre-platform-dev-system-nodes"
    Environment = var.environment
    Project     = "sre-platform"
  }
}
