# Renamed from www_redirect once the function grew a second job. Without this,
# Terraform would destroy and recreate a function that is live on the edge.
moved {
  from = aws_cloudfront_function.www_redirect
  to   = aws_cloudfront_function.viewer_request
}

resource "aws_cloudfront_origin_access_control" "site" {
  name                              = "${var.domain}-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# Runs at the edge, before origin lookup. Two jobs: send www to the apex, and
# resolve directory paths to their index.html. CloudFront's default_root_object
# only covers "/", so without the rewrite a request for /notes/ looks for an S3
# key called "notes/", which does not exist, and 404s.
resource "aws_cloudfront_function" "viewer_request" {
  name    = "www-to-apex-redirect"
  runtime = "cloudfront-js-2.0"
  comment = "www to apex redirect, and directory index rewrite"
  publish = true
  code    = <<-EOT
    function handler(event) {
      var request = event.request;
      var host = request.headers.host.value;

      if (host === '${var.www_domain}') {
        return {
          statusCode: 301,
          statusDescription: 'Moved Permanently',
          headers: {
            location: { value: 'https://${var.domain}' + request.uri }
          }
        };
      }

      var uri = request.uri;
      if (uri.endsWith('/')) {
        request.uri = uri + 'index.html';
      } else if (uri.lastIndexOf('.') < uri.lastIndexOf('/')) {
        // no file extension in the last path segment, treat it as a directory
        request.uri = uri + '/index.html';
      }

      return request;
    }
  EOT
}

resource "aws_cloudfront_distribution" "site" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  aliases             = [var.domain, var.www_domain]
  price_class         = "PriceClass_100"
  comment             = "rishavraj.info portfolio"

  origin {
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_id                = "s3-${var.domain}"
    origin_access_control_id = aws_cloudfront_origin_access_control.site.id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "s3-${var.domain}"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    cache_policy_id        = "658327ea-f89d-4fab-a63d-7e88639e58f6" # AWS managed: CachingOptimized

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.viewer_request.arn
    }
  }

  # A missing key behind a private OAC bucket comes back from S3 as 403,
  # not 404 (S3 won't reveal whether a forbidden key exists), so both need
  # to map to the actual 404 page rather than CloudFront's XML error page.
  custom_error_response {
    error_code         = 404
    response_code      = 404
    response_page_path = "/404.html"
  }

  custom_error_response {
    error_code         = 403
    response_code      = 404
    response_page_path = "/404.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.site.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}
