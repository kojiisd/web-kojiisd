import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const profile = defineCollection({
  loader: glob({ pattern: "profile.md", base: "./src/content" }),
  schema: z.object({
    name: z.string(),
    title: z.string(),
    links: z.array(
      z.object({
        label: z.string(),
        url: z.url(),
        // simple-icons のスラッグ（github, qiita, x など）
        icon: z.string().optional(),
      }),
    ),
    certifications: z.array(z.string()).default([]),
    skills: z.array(z.string()).default([]),
  }),
});

const works = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/works" }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    url: z.url().optional(),
    draft: z.boolean().default(false),
  }),
});

const career = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/career" }),
  schema: z.object({
    role: z.string(),
    organization: z.string(),
    start: z.coerce.date(),
    // 未指定なら「現在」
    end: z.coerce.date().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { profile, works, career };
