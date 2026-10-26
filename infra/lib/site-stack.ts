import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as cdk from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as iam from "aws-cdk-lib/aws-iam";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";

export interface SiteStackProps extends cdk.StackProps {
  /** Route 53 のホストゾーン名（例: kojiisd.jp） */
  zoneName: string;
  /** 正規ホスト（例: www.kojiisd.jp） */
  canonicalHost: string;
  /** 正規ホストへ 301 で転送するホスト */
  redirectHosts: string[];
  /**
   * 他の CloudFront（Amplify など）が使用中のため、まだ割り当てられないホスト。
   * 証明書には含めるが、ディストリビューションと DNS レコードには追加しない。
   */
  pendingHosts: string[];
  /** デプロイを許可する GitHub リポジトリ（owner/repo）とブランチ */
  githubRepo: string;
  githubBranch: string;
  /** 既存の GitHub OIDC プロバイダーの ARN（アカウントに既にある場合） */
  githubOidcProviderArn?: string;
}

export class SiteStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: SiteStackProps) {
    super(scope, id, props);

    const zone = route53.HostedZone.fromLookup(this, "Zone", { domainName: props.zoneName });
    const activeHosts = [props.canonicalHost, ...props.redirectHosts.filter((h) => !props.pendingHosts.includes(h))];

    const bucket = new s3.Bucket(this, "SiteBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // 証明書は将来割り当てるホストも含めて最初から発行しておく（差し替え不要にするため）
    const certificate = new acm.Certificate(this, "Certificate", {
      domainName: props.canonicalHost,
      subjectAlternativeNames: props.redirectHosts,
      validation: acm.CertificateValidation.fromDns(zone),
    });

    const functionPath = fileURLToPath(new URL("../functions/viewer-request.js", import.meta.url));
    const viewerRequest = new cloudfront.Function(this, "ViewerRequest", {
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(
        readFileSync(functionPath, "utf8").replace("__CANONICAL_HOST__", props.canonicalHost),
      ),
      comment: `Redirect to ${props.canonicalHost} and resolve directory indexes`,
    });

    const distribution = new cloudfront.Distribution(this, "Distribution", {
      domainNames: activeHosts,
      certificate,
      defaultRootObject: "index.html",
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
        functionAssociations: [{ function: viewerRequest, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST }],
      },
      // OAC 経由で存在しないキーを読むと S3 は 403 を返すため、404 ページに寄せる
      errorResponses: [403, 404].map((httpStatus) => ({
        httpStatus,
        responseHttpStatus: 404,
        responsePagePath: "/404.html",
        ttl: cdk.Duration.minutes(5),
      })),
    });

    for (const host of activeHosts) {
      const recordName = host === props.zoneName ? undefined : host;
      const target = route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution));
      new route53.ARecord(this, `A-${host}`, { zone, recordName, target });
      new route53.AaaaRecord(this, `AAAA-${host}`, { zone, recordName, target });
    }

    // GitHub Actions からのデプロイ用ロール（OIDC、長期のアクセスキーは使わない）
    const provider = props.githubOidcProviderArn
      ? iam.OidcProviderNative.fromOidcProviderArn(this, "GitHubOidc", props.githubOidcProviderArn)
      : new iam.OidcProviderNative(this, "GitHubOidc", {
          url: "https://token.actions.githubusercontent.com",
          clientIds: ["sts.amazonaws.com"],
        });

    const deployRole = new iam.Role(this, "DeployRole", {
      description: `GitHub Actions deploy role for ${props.githubRepo}`,
      maxSessionDuration: cdk.Duration.hours(1),
      assumedBy: new iam.WebIdentityPrincipal(provider.oidcProviderArn, {
        StringEquals: {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": `repo:${props.githubRepo}:ref:refs/heads/${props.githubBranch}`,
        },
      }),
    });
    bucket.grantReadWrite(deployRole);
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["cloudfront:CreateInvalidation"],
        resources: [
          cdk.Arn.format({ service: "cloudfront", region: "", resource: "distribution", resourceName: distribution.distributionId }, this),
        ],
      }),
    );

    new cdk.CfnOutput(this, "BucketName", { value: bucket.bucketName });
    new cdk.CfnOutput(this, "DistributionId", { value: distribution.distributionId });
    new cdk.CfnOutput(this, "DistributionDomainName", { value: distribution.distributionDomainName });
    new cdk.CfnOutput(this, "DeployRoleArn", { value: deployRole.roleArn });
  }
}
