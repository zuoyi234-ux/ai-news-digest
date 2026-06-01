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

// TZ_OFFSET_HOURS: adjust for your local timezone (e.g. 8 for Asia/Shanghai)
const TZ_OFFSET_HOURS = 8;

function toLocalDateStr(date: Date): string {
  const local = new Date(date.getTime() + TZ_OFFSET_HOURS * 3600 * 1000);
  return local.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function isYesterday(date: Date): boolean {
  const now = new Date(Date.now() + TZ_OFFSET_HOURS * 3600 * 1000);
  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return toLocalDateStr(date) === yesterday.toISOString().slice(0, 10);
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
