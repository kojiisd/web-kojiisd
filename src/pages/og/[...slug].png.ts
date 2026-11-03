import type { APIRoute, GetStaticPaths } from "astro";
import { getCollection, getEntry } from "astro:content";
import { renderOgImage } from "../../lib/og";

// /og/index.png（トップ・その他のページ）と /og/works/<id>.png（成果物）を生成する
export const getStaticPaths = (async () => {
  const site = await getEntry("site", "site");
  const works = await getCollection("works", ({ data }) => !data.draft);
  return [
    { params: { slug: "index" }, props: { title: site?.data.title ?? "kojiisd", subtitle: site?.data.tagline } },
    ...works.map((work) => ({
      params: { slug: `works/${work.id}` },
      props: { title: work.data.title, subtitle: work.data.summary },
    })),
  ];
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const png = await renderOgImage(props as { title: string; subtitle?: string });
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png" } });
};
