import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import satori from "satori";
import sharp from "sharp";

const WIDTH = 1200;
const HEIGHT = 630;
const FONT_WEIGHT = 700 as const;
const SITE_NAME = "Portfolio of kojiisd";

interface FontSubset {
  file: string;
  ranges: [number, number][];
}

// Noto Sans JP は unicode-range ごとに分割されているため、使う文字を含むファイルだけを読み込む
const fontDir = path.dirname(createRequire(import.meta.url).resolve(`@fontsource/noto-sans-jp/${FONT_WEIGHT}.css`));
let subsets: Promise<FontSubset[]> | undefined;

function loadSubsets(): Promise<FontSubset[]> {
  subsets ??= readFile(path.join(fontDir, `${FONT_WEIGHT}.css`), "utf8").then((css) =>
    [...css.matchAll(/url\(\.\/(files\/[^)]+\.woff)\)[\s\S]*?unicode-range:\s*([^;]+);/g)].map(([, file, ranges]) => ({
      file,
      ranges: ranges.split(",").map((range) => {
        const [start, end = start] = range.trim().replace("U+", "").split("-");
        return [parseInt(start, 16), parseInt(end, 16)];
      }),
    })),
  );
  return subsets;
}

async function loadFonts(text: string) {
  const codePoints = new Set([...text].map((char) => char.codePointAt(0)!));
  const needed = (await loadSubsets()).filter((subset) =>
    [...codePoints].some((cp) => subset.ranges.some(([start, end]) => cp >= start && cp <= end)),
  );
  // satori は同名フォントを 1 つしか使わないため、サブセットごとに別名を付けて fontFamily で列挙する
  return Promise.all(
    needed.map(async (subset, i) => ({
      name: `Noto Sans JP ${i}`,
      data: await readFile(path.join(fontDir, subset.file)),
      weight: FONT_WEIGHT,
      style: "normal" as const,
    })),
  );
}

const h = (type: string, style: Record<string, unknown>, children?: unknown) => ({ type, props: { style, children } });

// 1200x630 の OGP 画像（PNG）を作る
export async function renderOgImage({ title, subtitle }: { title: string; subtitle?: string }): Promise<Buffer> {
  const site = "www.kojiisd.jp";
  // 100% + padding だと高さがはみ出すため、帯とコンテンツを flex で縦に並べる
  const element = h(
    "div",
    {
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      backgroundColor: "#ffffff",
      color: "#0f172a",
      fontFamily: "__FONTS__",
    },
    [
      h("div", { height: 16, backgroundColor: "#0284c7" }),
      h("div", { flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 80px" }, [
        h("div", { display: "flex", flexDirection: "column", gap: 24 }, [
          h("div", { fontSize: 64, lineHeight: 1.25 }, title),
          ...(subtitle ? [h("div", { fontSize: 32, color: "#475569", lineHeight: 1.5 }, subtitle)] : []),
        ]),
        h("div", { display: "flex", justifyContent: "space-between", fontSize: 28, color: "#0284c7" }, [
          // トップページ（タイトル自体がサイト名）では重複するので出さない
          h("div", {}, title === SITE_NAME ? "" : SITE_NAME),
          h("div", {}, site),
        ]),
      ]),
    ],
  );
  const fonts = await loadFonts(`${title}${subtitle ?? ""}${SITE_NAME}${site}`);
  element.props.style.fontFamily = fonts.map((font) => font.name).join(", ");
  const svg = await satori(element as Parameters<typeof satori>[0], { width: WIDTH, height: HEIGHT, fonts });
  return sharp(Buffer.from(svg)).png().toBuffer();
}
