export interface QiitaArticle {
  title: string;
  url: string;
  createdAt: Date;
  likes: number;
  tags: string[];
}

interface QiitaItem {
  title: string;
  url: string;
  created_at: string;
  likes_count: number;
  tags: { name: string }[];
}

// ビルド時に Qiita API から最新記事を取得する。
// 取得に失敗してもビルドは止めず、記事一覧を非表示にする。
export async function fetchQiitaArticles(user: string, count = 6): Promise<QiitaArticle[]> {
  const token = import.meta.env.QIITA_TOKEN;
  try {
    const res = await fetch(`https://qiita.com/api/v2/users/${user}/items?per_page=${count}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = (await res.json()) as QiitaItem[];
    return items.map((item) => ({
      title: item.title,
      url: item.url,
      createdAt: new Date(item.created_at),
      likes: item.likes_count,
      tags: item.tags.map((tag) => tag.name),
    }));
  } catch (error) {
    console.warn(`[qiita] 記事を取得できませんでした: ${error}`);
    return [];
  }
}
