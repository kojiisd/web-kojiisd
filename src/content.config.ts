import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

// トップページの見出しとリンク
const site = defineCollection({
  loader: glob({ pattern: "site.md", base: "./src/content" }),
  schema: z.object({
    title: z.string(),
    // 見出しの下に小さく出す一文（不要なら省略）
    tagline: z.string().optional(),
    links: z.array(
      z.object({
        label: z.string(),
        url: z.url(),
        // simple-icons のスラッグ（github, qiita, x など）
        icon: z.string().optional(),
      }),
    ),
  }),
});

// 成果物（1件 = 1ファイル）
const works = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/works" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      summary: z.string(),
      date: z.coerce.date(),
      tags: z.array(z.string()).default([]),
      // 指定するとタイルから直接このURLへ飛ぶ（詳細ページは作らない）
      url: z.url().optional(),
      // タイルに表示する画像（Markdown ファイルからの相対パス）
      cover: image().optional(),
      draft: z.boolean().default(false),
    }),
});

export const collections = { site, works };
