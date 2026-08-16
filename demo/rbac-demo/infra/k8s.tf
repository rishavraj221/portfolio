resource "kubernetes_namespace" "this" {
  metadata {
    name = var.project
  }
}

resource "kubernetes_secret" "backend" {
  metadata {
    name      = "rbac-demo-backend-secrets"
    namespace = kubernetes_namespace.this.metadata[0].name
  }

  data = {
    DATABASE_URL = "postgres://${var.db_username}:${var.db_password}@${aws_db_instance.postgres.address}:5432/${var.db_name}"
    REDIS_URL    = "redis://${aws_elasticache_cluster.redis.cache_nodes[0].address}:6379"
  }
}

# 3 replicas at 1 vCPU / 1 GiB each mirrors the real system's footprint --
# see the writeup's scale section for where those numbers came from.
resource "kubernetes_deployment" "backend" {
  metadata {
    name      = "rbac-demo-backend"
    namespace = kubernetes_namespace.this.metadata[0].name
    labels    = { app = "rbac-demo-backend" }
  }

  spec {
    replicas = var.backend_replica_count

    selector {
      match_labels = { app = "rbac-demo-backend" }
    }

    template {
      metadata {
        labels = { app = "rbac-demo-backend" }
      }

      spec {
        container {
          name  = "backend"
          image = var.backend_image

          port {
            container_port = 4000
          }

          env_from {
            secret_ref {
              name = kubernetes_secret.backend.metadata[0].name
            }
          }

          resources {
            requests = {
              cpu    = "250m"
              memory = "512Mi"
            }
            limits = {
              cpu    = "1"
              memory = "1Gi"
            }
          }

          liveness_probe {
            http_get {
              path = "/healthz"
              port = 4000
            }
            initial_delay_seconds = 5
            period_seconds         = 10
          }

          readiness_probe {
            http_get {
              path = "/healthz"
              port = 4000
            }
            initial_delay_seconds = 3
            period_seconds         = 5
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "backend" {
  metadata {
    name      = "rbac-demo-backend"
    namespace = kubernetes_namespace.this.metadata[0].name
  }

  spec {
    selector = { app = "rbac-demo-backend" }
    port {
      port        = 80
      target_port = 4000
    }
    type = "ClusterIP"
  }
}

# Requires the AWS Load Balancer Controller to already be installed on the
# cluster (via Helm, outside this Terraform) -- it's what watches Ingress
# resources with this annotation and provisions the actual ALB.
resource "kubernetes_ingress_v1" "backend" {
  metadata {
    name      = "rbac-demo-backend"
    namespace = kubernetes_namespace.this.metadata[0].name
    annotations = {
      "kubernetes.io/ingress.class"           = "alb"
      "alb.ingress.kubernetes.io/scheme"      = "internet-facing"
      "alb.ingress.kubernetes.io/target-type" = "ip"
      "alb.ingress.kubernetes.io/listen-ports" = jsonencode([{ HTTPS = 443 }])
    }
  }

  spec {
    rule {
      host = var.domain
      http {
        path {
          path      = "/"
          path_type = "Prefix"
          backend {
            service {
              name = kubernetes_service.backend.metadata[0].name
              port {
                number = 80
              }
            }
          }
        }
      }
    }
  }
}
