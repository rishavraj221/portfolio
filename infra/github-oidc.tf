# Lets GitHub Actions assume an AWS role for the length of a workflow run,
# with no long lived access keys stored as repo secrets.
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  # Fingerprint of the root CA at the top of token.actions.githubusercontent.com's
  # current TLS chain (Let's Encrypt / ISRG Root X1). AWS only checks this at
  # provider creation time, but it has to be correct then or every
  # AssumeRoleWithWebIdentity call fails with "Not authorized".
  thumbprint_list = ["ab9d0263244dd0326eb67015705a667e79cfe998"]
}

data "aws_iam_policy_document" "github_trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    effect  = "Allow"

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # Only workflow runs triggered from this exact repo's main branch can
    # assume this role, not PRs, not forks, not other repos.
    #
    # StringLike rather than StringEquals: this account has GitHub's
    # "immutable OIDC subject claims" setting on, so the actual sub is
    # "repo:OWNER@ID/REPO@ID:ref:refs/heads/main", not the plain
    # "repo:OWNER/REPO:..." format most examples assume.
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_owner}*/${var.github_repo}*:ref:refs/heads/main"]
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  name               = "github-deploy-${var.github_repo}"
  assume_role_policy = data.aws_iam_policy_document.github_trust.json
}

data "aws_iam_policy_document" "github_deploy" {
  statement {
    sid     = "SyncBucket"
    actions = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:ListBucket"]
    resources = [
      aws_s3_bucket.site.arn,
      "${aws_s3_bucket.site.arn}/*",
    ]
  }

  statement {
    sid       = "InvalidateCache"
    actions   = ["cloudfront:CreateInvalidation"]
    resources = [aws_cloudfront_distribution.site.arn]
  }
}

resource "aws_iam_role_policy" "github_deploy" {
  name   = "deploy-site"
  role   = aws_iam_role.github_deploy.id
  policy = data.aws_iam_policy_document.github_deploy.json
}
