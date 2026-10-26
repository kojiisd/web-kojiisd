import * as cdk from "aws-cdk-lib";
import { SiteStack } from "../lib/site-stack.ts";

const app = new cdk.App();

// web.kojiisd.jp は Amplify から切り離した後、cdk.json の context に "attachWebDomain": true を追加して割り当てる（infra/README.md 参照）
const attachWebDomain = app.node.tryGetContext("attachWebDomain") === "true" || app.node.tryGetContext("attachWebDomain") === true;

new SiteStack(app, "WebKojiisdSite", {
  // CloudFront 用の ACM 証明書は us-east-1 にある必要がある
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: "us-east-1" },
  zoneName: "kojiisd.jp",
  canonicalHost: "www.kojiisd.jp",
  redirectHosts: ["kojiisd.jp", "web.kojiisd.jp"],
  pendingHosts: attachWebDomain ? [] : ["web.kojiisd.jp"],
  githubRepo: "kojiisd/web-kojiisd",
  githubBranch: "master",
  githubOidcProviderArn: app.node.tryGetContext("githubOidcProviderArn"),
});
