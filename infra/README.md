# infra

サイトのインフラを定義した AWS CDK アプリです（us-east-1）。
非公開の S3 + CloudFront（OAC）、ACM 証明書、Route 53 のエイリアスレコード、GitHub Actions 用の OIDC ロールを作成します。

CloudFront Function で、`www.kojiisd.jp` 以外のホストを 301 で転送し、`/path/` を `/path/index.html` に解決しています。

## デプロイ

変更は GitHub Actions の「Deploy infra」（`main` から手動実行）で反映します。

初回のみ、管理者権限の環境（CloudShell など）で実行します。

```sh
npm ci
npm run bootstrap   # 修飾子 kojiweb（cdk.json で設定）
npm run deploy
```

スタックの出力を、リポジトリの Variables に登録します。

| Variable | 出力 |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | `DeployRoleArn` |
| `AWS_INFRA_ROLE_ARN` | `InfraDeployRoleArn` |
| `S3_BUCKET` | `BucketName` |
| `CLOUDFRONT_DISTRIBUTION_ID` | `DistributionId` |

任意: `PUBLIC_GA_ID`（Variable）、`QIITA_TOKEN`（Secret）

## コンテキスト（`cdk.json`）

- `useExistingGithubOidcProvider`: アカウントにある GitHub OIDC プロバイダーを使う
- `attachWebDomain`: `web.kojiisd.jp` も受けて転送する

## チェック

```sh
npm run build   # 型チェック
npm test        # CloudFront Function のテスト
```
