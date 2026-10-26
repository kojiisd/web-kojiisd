# infra

`www.kojiisd.jp` を配信するインフラを定義した AWS CDK（TypeScript）アプリです。

## 構成

| リソース | 内容 |
|---|---|
| S3 バケット | サイトの静的ファイル。パブリックアクセスはすべてブロックし、CloudFront（OAC）からのみ読み取る |
| CloudFront | `www.kojiisd.jp` / `kojiisd.jp` / `web.kojiisd.jp` を受ける。HTTP/2・HTTP/3、TLS 1.2 以上、セキュリティヘッダー付き |
| CloudFront Function | 正規ホスト以外を `https://www.kojiisd.jp` へ 301 で転送し、`/path/` を `/path/index.html` に解決する |
| ACM 証明書 | 上記 3 ホストを 1 枚でカバー（us-east-1、Route 53 で DNS 検証） |
| Route 53 | 各ホストの A / AAAA エイリアスレコード |
| IAM（OIDC） | GitHub Actions 用のデプロイロール。`kojiisd/web-kojiisd` の `master` からのみ引き受け可能で、S3 への同期と CloudFront のキャッシュ削除だけを許可する |

スタックはすべて us-east-1 に作成します（CloudFront 用の証明書は us-east-1 にある必要があるため）。

```
infra/
├── bin/app.ts                    # ドメイン名などの設定値
├── lib/site-stack.ts             # スタック本体
├── functions/viewer-request.js   # CloudFront Function
└── test/                         # CloudFront Function のテスト
```

## 開発

```sh
npm ci
npm run build   # 型チェック
npm test        # CloudFront Function のテスト
npx cdk diff    # 変更差分の確認（AWS の認証情報が必要）
```

## 初回構築

AWS CloudShell（バージニア北部）か、管理者権限の認証情報があるローカル環境で実行します。

1. **GitHub 用 OIDC プロバイダーの有無を確認する**

   ```sh
   aws iam list-open-id-connect-providers
   ```

   `token.actions.githubusercontent.com` が既にある場合は、以降の `cdk deploy` に `-c githubOidcProviderArn=<その ARN>` を付けてください（同じプロバイダーは 1 アカウントに 1 つしか作れません）。

2. **CDK のブートストラップ**（us-east-1 で未実施、または古い場合）

   ```sh
   cd infra
   npm ci
   npx cdk bootstrap aws://<アカウントID>/us-east-1
   ```

3. **デプロイ**

   ```sh
   npx cdk deploy
   ```

   証明書の DNS 検証に数分かかります。この時点で `www.kojiisd.jp` と `kojiisd.jp` のレコードが作成されます。
   `kojiisd.jp` はエイリアスレコードなので、既存の MX（Zoho）や TXT には影響しません。

4. **`cdk.context.json` をコミットする**

   ホストゾーンの検索結果がキャッシュされます。CDK の推奨どおりリポジトリに含めてください。

5. **GitHub に変数を設定する**

   リポジトリの Settings → Secrets and variables → Actions → Variables に、`cdk deploy` の出力を登録します。

   | Variable | CDK の出力 |
   |---|---|
   | `AWS_DEPLOY_ROLE_ARN` | `DeployRoleArn` |
   | `S3_BUCKET` | `BucketName` |
   | `CLOUDFRONT_DISTRIBUTION_ID` | `DistributionId` |

   あわせて `PUBLIC_GA_ID`（GA4 の測定 ID）も設定します。

6. **初回デプロイ**

   Actions → 「Build and deploy」→ Run workflow で実行し、`https://www.kojiisd.jp/` と `https://kojiisd.jp/`（→ www へ転送）を確認します。

## Amplify Hosting からの切り替え（web.kojiisd.jp）

`web.kojiisd.jp` は Amplify Hosting の CloudFront に割り当てられており、同じホスト名を 2 つの CloudFront に同時には登録できません。
そのため初回構築では証明書にだけ含め、Amplify から外した後に割り当てます。

1. Amplify コンソール → `hugo-web-kojiisd` → ホスティング → カスタムドメイン で、`kojiisd.jp` のドメイン設定を削除する
2. Route 53 で `web.kojiisd.jp` の CNAME（`d22piiy8eayfot.cloudfront.net`）が消えたことを確認する（残っていれば削除する）
3. `cdk.json` の `context` に `"attachWebDomain": true` を追加してデプロイする

   ```sh
   npx cdk deploy
   ```

4. `https://web.kojiisd.jp/` が `https://www.kojiisd.jp/` へ転送されることを確認し、`cdk.json` の変更をコミットする
5. Amplify のアプリ `hugo-web-kojiisd` を削除する

手順 1〜3 の間（数分）だけ `web.kojiisd.jp` にアクセスできなくなります。

Route 53 に残っている `_` で始まる CNAME（証明書の検証用）のうち、Amplify の証明書用だったものは手順 5 の後に削除できます。
`learn.kojiisd.jp` など他のサービスの検証用レコードと取り違えないよう、ACM コンソールで照合してから削除してください。
