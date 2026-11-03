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
| IAM（OIDC）: サイト用 | `DeployRole`。`kojiisd/web-kojiisd` の `main` からのみ引き受け可能で、S3 への同期と CloudFront のキャッシュ削除だけを許可する |
| IAM（OIDC）: インフラ用 | `InfraDeployRole`。GitHub Actions の environment `infra` からのみ引き受け可能で、CDK のブートストラップロール（`cdk-kojiweb-*`）を引き受けることだけを許可する |

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
npm run diff    # 変更差分の確認（AWS の認証情報が必要）
```

## 初回構築

AWS CloudShell（バージニア北部）か、管理者権限の認証情報があるローカル環境で実行します。

1. **GitHub 用 OIDC プロバイダーの有無を確認する**

   ```sh
   aws iam list-open-id-connect-providers
   ```

   このアカウントには既にあるため、`cdk.json` の `context` で `"useExistingGithubOidcProvider": true` として既存のものを使っています。
   別のアカウントで新しく作る場合は `false` にしてください（同じプロバイダーは 1 アカウントに 1 つしか作れず、既にあると `AWS::EarlyValidation::ResourceExistenceCheck` で失敗します）。

2. **CDK のブートストラップ**

   ```sh
   git clone https://github.com/kojiisd/web-kojiisd.git
   cd web-kojiisd/infra
   npm ci
   npm run bootstrap
   ```

   このプロジェクトは専用の修飾子 `kojiweb`（スタック名 `CDKToolkitWebKojiisd`）でブートストラップします（`cdk.json` で設定）。
   アカウントに過去の CDK ブートストラップ（既定の修飾子 `hnb659fds`）の残骸があっても衝突しません。

3. **デプロイ**

   ```sh
   npm run diff     # 作成されるリソースを確認する（任意）
   npm run deploy
   ```

   承認の確認（y/n）は省略しています。CloudShell の接続が切れても止まらないよう、`nohup npm run deploy > ~/deploy.log 2>&1 &` のようにバックグラウンドで実行しても構いません。
   証明書の DNS 検証に数分かかります。この時点で `www.kojiisd.jp` と `kojiisd.jp` のレコードが作成されます。
   `kojiisd.jp` はエイリアスレコードなので、既存の MX（Zoho）や TXT には影響しません。

4. **GitHub に変数を設定する**

   リポジトリの Settings → Secrets and variables → Actions → Variables に、`cdk deploy` の出力を登録します。

   | Variable | CDK の出力 |
   |---|---|
   | `AWS_DEPLOY_ROLE_ARN` | `DeployRoleArn` |
   | `S3_BUCKET` | `BucketName` |
   | `CLOUDFRONT_DISTRIBUTION_ID` | `DistributionId` |
   | `AWS_INFRA_ROLE_ARN` | `InfraDeployRoleArn` |

   あわせて `PUBLIC_GA_ID`（GA4 の測定 ID）も設定します。
   出力は CloudFormation コンソール → `WebKojiisdSite` →「出力」タブでも確認できます。

5. **初回デプロイ**

   Actions → 「Build and deploy」→ Run workflow で実行し、`https://www.kojiisd.jp/` と `https://kojiisd.jp/`（→ www へ転送）を確認します。

## 2 回目以降のインフラ変更（GitHub Actions）

初回構築の後は、CloudShell を使わずに GitHub Actions から反映できます。

1. `infra/` の変更を `main` にマージする
2. Actions →「Deploy infra」→ Run workflow を開き、`mode` を選んで実行する
   - `diff`：差分の確認だけ（ログに出力される）
   - `deploy`：AWS に反映する

ワークフローは environment `infra` で動き、`InfraDeployRole` 経由で CDK のブートストラップロールを引き受けます。
Settings → Environments → `infra` で「Deployment branches」を `main` に限定したり、承認者を設定したりすると、さらに安全です。

## Amplify Hosting からの切り替え（web.kojiisd.jp）

`web.kojiisd.jp` は Amplify Hosting の CloudFront に割り当てられており、同じホスト名を 2 つの CloudFront に同時には登録できません。
そのため初回構築では証明書にだけ含め、Amplify から外した後に割り当てます。

1. Amplify コンソール → `hugo-web-kojiisd` → ホスティング → カスタムドメイン で、`kojiisd.jp` のドメイン設定を削除する
2. Route 53 で `web.kojiisd.jp` の CNAME（`d22piiy8eayfot.cloudfront.net`）が消えたことを確認する（残っていれば削除する）
3. `cdk.json` の `context` に `"attachWebDomain": true` を追加した変更を `main` にマージし、「Deploy infra」を `deploy` で実行する（CloudShell なら `npm run deploy`）
4. `https://web.kojiisd.jp/` が `https://www.kojiisd.jp/` へ転送されることを確認する
5. Amplify のアプリ `hugo-web-kojiisd` を削除する

手順 1〜3 の間（数分）だけ `web.kojiisd.jp` にアクセスできなくなります。

Route 53 に残っている `_` で始まる CNAME（証明書の検証用）のうち、Amplify の証明書用だったものは手順 5 の後に削除できます。
`learn.kojiisd.jp` など他のサービスの検証用レコードと取り違えないよう、ACM コンソールで照合してから削除してください。
