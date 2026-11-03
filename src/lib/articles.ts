export type ArticleSource = "devto" | "qiita";

export interface Article {
  source: ArticleSource;
  title: string;
  url: string;
  publishedAt: Date;
  reactions: number;
  tags: string[];
}

export interface Feed {
  source: ArticleSource;
  user: string;
}

interface DevtoItem {
  title: string;
  url: string;
  published_at: string;
  public_reactions_count: number;
  tag_list: string[];
}

interface QiitaItem {
  title: string;
  url: string;
  created_at: string;
  likes_count: number;
  tags: { name: string }[];
}

async function getJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function fetchDevto(user: string, count: number): Promise<Article[]> {
  const items = await getJson<DevtoItem[]>(`https://dev.to/api/articles?username=${user}&per_page=${count}`, {
    accept: "application/vnd.forem.api-v1+json",
  });
  return items.map((item) => ({
    source: "devto",
    title: item.title,
    url: item.url,
    publishedAt: new Date(item.published_at),
    reactions: item.public_reactions_count,
    tags: item.tag_list,
  }));
}

async function fetchQiita(user: string, count: number): Promise<Article[]> {
  const token = import.meta.env.QIITA_TOKEN;
  const items = await getJson<QiitaItem[]>(
    `https://qiita.com/api/v2/users/${user}/items?per_page=${count}`,
    token ? { Authorization: `Bearer ${token}` } : {},
  );
  return items.map((item) => ({
    source: "qiita",
    title: item.title,
    url: item.url,
    publishedAt: new Date(item.created_at),
    reactions: item.likes_count,
    tags: item.tags.map((tag) => tag.name),
  }));
}

const fetchers = { devto: fetchDevto, qiita: fetchQiita };

// ビルド時に各サービスから記事を取得し、新しい順に count 件を返す。
// 取得に失敗したフィードは警告を出して無視し、ビルドは止めない。
export async function fetchArticles(feeds: Feed[], count: number): Promise<Article[]> {
  const results = await Promise.all(
    feeds.map((feed) =>
      fetchers[feed.source](feed.user, count).catch((error) => {
        console.warn(`[${feed.source}] 記事を取得できませんでした: ${error}`);
        return [];
      }),
    ),
  );
  return results
    .flat()
    .sort((a, b) => b.publishedAt.valueOf() - a.publishedAt.valueOf())
    .slice(0, count);
}
