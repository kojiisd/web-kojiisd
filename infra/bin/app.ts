import * as cdk from "aws-cdk-lib";
import { SiteStack } from "../lib/site-stack.ts";

const app = new cdk.App();

// web.kojiisd.jp は cdk.json の context に "attachWebDomain": true を追加すると割り当てる
const attachWebDomain = app.node.tryGetContext("attachWebDomain") === "true" || app.node.tryGetContext("attachWebDomain") === true;

new SiteStack(app, "WebKojiisdSite", {
  // CloudFront 用の ACM 証明書は us-east-1 にある必要がある
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: "us-east-1" },
  zoneName: "kojiisd.jp",
  canonicalHost: "www.kojiisd.jp",
  redirectHosts: ["kojiisd.jp", "web.kojiisd.jp"],
  pendingHosts: attachWebDomain ? [] : ["web.kojiisd.jp"],
  githubRepo: "kojiisd/web-kojiisd",
  githubBranch: "main",
  githubInfraEnvironment: "infra",
  useExistingGithubOidcProvider: [true, "true"].includes(app.node.tryGetContext("useExistingGithubOidcProvider")),
});
