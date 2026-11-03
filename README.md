# web-kojiisd

[www.kojiisd.jp](https://www.kojiisd.jp/) のソースコードです。

- [Astro](https://astro.build/) + Tailwind CSS
- S3 + CloudFront（AWS CDK で定義、[`infra/`](infra/)）
- GitHub Actions で `main` への push 時と毎日（記事の新着反映のため）デプロイ

## コンテンツ

すべて Markdown で管理しています。

| パス | 内容 |
|---|---|
| `src/content/site.md` | 見出し、リンク、記事フィード（dev.to / Qiita） |
| `src/content/works/*.md` | 成果物（トップのタイルと Works メニュー、詳細ページ。`draft: true` で非公開） |
| `src/pages/*.md` | 追加ページ（`layout: ../layouts/MarkdownLayout.astro`） |

```markdown
---
title: Some tool
summary: 1行の説明
date: 2025-04-01
tags: [AWS]
url: https://some-tool.kojiisd.jp/          # 任意: 詳細ページに「サイトを開く」ボタンを出す
cover: ./images/some-tool.png              # 任意: タイルの画像
---
```

## 開発

```sh
npm install
npm run dev     # http://localhost:4321
npm run build
```
