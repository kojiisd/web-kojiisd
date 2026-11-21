export type ArticleSource = "devto" | "qiita" | "bluesky";

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
  /** このフィードから出す最大件数（省略時は全体の件数まで） */
  limit?: number;
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

interface BlueskyFeedItem {
  post: {
    uri: string;
    record: {
      text: string;
      createdAt: string;
      facets?: { features: { $type: string; tag?: string }[] }[];
    };
    likeCount?: number;
  };
  // リポストなどの場合に付く
  reason?: unknown;
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

async function fetchBluesky(user: string, count: number): Promise<Article[]> {
  const { feed } = await getJson<{ feed: BlueskyFeedItem[] }>(
    `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${user}&filter=posts_no_replies&limit=${Math.min(count * 3, 100)}`,
  );
  return feed
    .filter((item) => !item.reason && item.post.record.text.trim() !== "")
    .slice(0, count)
    .map(({ post }) => ({
      source: "bluesky",
      title: post.record.text,
      url: `https://bsky.app/profile/${user}/post/${post.uri.split("/").pop()}`,
      publishedAt: new Date(post.record.createdAt),
      reactions: post.likeCount ?? 0,
      tags: (post.record.facets ?? []).flatMap((facet) => facet.features.flatMap((feature) => (feature.tag ? [feature.tag] : []))),
    }));
}

const fetchers = { devto: fetchDevto, qiita: fetchQiita, bluesky: fetchBluesky };

// ビルド時に各サービスから記事を取得し、新しい順に count 件を返す。
// 取得に失敗したフィードは警告を出して無視し、ビルドは止めない。
export async function fetchArticles(feeds: Feed[], count: number): Promise<Article[]> {
  const results = await Promise.all(
    feeds.map((feed) =>
      fetchers[feed.source](feed.user, Math.min(feed.limit ?? count, count)).catch((error) => {
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
