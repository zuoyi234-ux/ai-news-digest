import Parser from "rss-parser";
import config from "../config.json";

export interface NewsItem {
  title: string;
  link: string;
  summary: string;
  source: string;
  category: string;
  publishedAt: Date;
}

const parser = new Parser({
  timeout: 10000,
  headers: { "User-Agent": "ai-news-digest/1.0" },
});

function isYesterday(date: Date): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  );
}

function matchesTopics(text: string): string {
  const lower = text.toLowerCase();
  for (const topic of config.topics) {
    if (topic.keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
      return topic.name;
    }
  }
  return "";
}

async function fetchFeed(feed: { name: string; url: string; category: string }): Promise<NewsItem[]> {
  try {
    const parsed = await parser.parseURL(feed.url);
    const items: NewsItem[] = [];

    for (const item of parsed.items) {
      const pubDate = item.pubDate ? new Date(item.pubDate) : null;
      if (!pubDate || !isYesterday(pubDate)) continue;

      const title = item.title ?? "";
      const content = item.contentSnippet ?? item.content ?? "";
      const category = matchesTopics(title + " " + content) || feed.category;

      items.push({
        title,
        link: item.link ?? "",
        summary: content.slice(0, 300),
        source: feed.name,
        category,
        publishedAt: pubDate,
      });
    }

    return items;
  } catch (err) {
    console.warn(`[fetch] Failed to fetch ${feed.name}: ${(err as Error).message}`);
    return [];
  }
}

export async function fetchYesterdayNews(): Promise<Map<string, NewsItem[]>> {
  console.log("[fetch] Fetching news from", config.rssFeeds.length, "feeds...");

  const results = await Promise.allSettled(config.rssFeeds.map(fetchFeed));
  const allItems: NewsItem[] = results
    .filter((r): r is PromiseFulfilledResult<NewsItem[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);

  console.log(`[fetch] Got ${allItems.length} items from yesterday`);

  // Group by category, cap at maxItemsPerTopic per topic
  const grouped = new Map<string, NewsItem[]>();
  const max = config.digest.maxItemsPerTopic;

  for (const item of allItems) {
    const existing = grouped.get(item.category) ?? [];
    if (existing.length < max) {
      grouped.set(item.category, [...existing, item]);
    }
  }

  return grouped;
}
