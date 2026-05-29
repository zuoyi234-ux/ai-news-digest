import Anthropic from "@anthropic-ai/sdk";
import { NewsItem } from "./fetch";
import config from "../config.json";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface TopicSummary {
  topic: string;
  items: { title: string; summary: string; source: string; link: string }[];
}

export async function summarizeNews(grouped: Map<string, NewsItem[]>): Promise<TopicSummary[]> {
  if (grouped.size === 0) {
    console.log("[summarize] No news items to summarize");
    return [];
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });

  // Build input text for Claude
  const sections: string[] = [];
  for (const [topic, items] of grouped) {
    const lines = items.map((item, i) =>
      `${i + 1}. [${item.source}] ${item.title}\n   原文摘要: ${item.summary}`
    );
    sections.push(`## ${topic}\n${lines.join("\n")}`);
  }

  const prompt = `你是一个新闻编辑助手，请将以下 ${dateStr} 的新闻按话题整理成中文日报摘要。

要求：
- 每条新闻给出一个简洁的中文标题（如原标题是英文，请翻译）
- 每条新闻给出 1-2 句中文摘要，${config.digest.summaryStyle}
- 保持原有话题分组，按话题依次输出
- 输出格式为 JSON，结构如下：
  [{ "topic": "话题名", "items": [{ "title": "标题", "summary": "摘要" }] }]
- 只输出 JSON，不要任何额外说明

新闻原文：
${sections.join("\n\n")}`;

  console.log("[summarize] Calling Claude API...");

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  // Extract JSON from response (strip markdown fences if present)
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("Claude returned unexpected format:\n" + text);

  const parsed: { topic: string; items: { title: string; summary: string }[] }[] = JSON.parse(jsonMatch[0]);

  // Merge back link and source from original data
  return parsed.map(({ topic, items }) => {
    const origItems = grouped.get(topic) ?? [];
    return {
      topic,
      items: items.map((item, i) => ({
        ...item,
        source: origItems[i]?.source ?? "",
        link: origItems[i]?.link ?? "",
      })),
    };
  });
}
