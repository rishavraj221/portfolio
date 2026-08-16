# rbac-demo infra

Terraform for the production shape of the rbac-demo service: EKS, RDS Postgres,
ElastiCache Redis, behind an ALB via the AWS Load Balancer Controller.

This is written to be correct and reviewable, matching the scale the real
Flexday service ran at (a few small pods behind a load balancer, a managed
relational database, a managed cache) -- but it is **not applied**. There is
no remote state backend configured and no CI wiring for it, on purpose, so a
stray `terraform apply` doesn't provision real AWS resources for a portfolio
demo. Treat this directory as a design document written in Terraform rather
than as something to run.

If you did want to run it for real:

```bash
terraform init
terraform plan -var="db_password=..." -var="domain=rbac-demo.example.com"
```

You'd also need a Terraform backend (S3 + DynamoDB lock table) and the AWS
Load Balancer Controller installed on the cluster via Helm before the
`kubernetes_ingress_v1` resource in [k8s.tf](k8s.tf) can provision anything.
