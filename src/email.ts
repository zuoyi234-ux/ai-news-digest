import { Resend } from "resend";
import { TopicSummary } from "./summarize";
import config from "../config.json";

const resend = new Resend(process.env.RESEND_API_KEY);

function buildHtml(summaries: TopicSummary[], dateStr: string): string {
  const topicBlocks = summaries
    .map(
      ({ topic, items }) => `
    <div style="margin-bottom:32px;">
      <h2 style="font-size:16px;font-weight:700;color:#111827;border-left:4px solid #6366f1;padding-left:12px;margin-bottom:16px;">${topic}</h2>
      ${items
        .map(
          ({ title, summary, source, link }) => `
        <div style="margin-bottom:16px;padding:16px;background:#f9fafb;border-radius:8px;">
          <a href="${link}" style="font-size:14px;font-weight:600;color:#1d4ed8;text-decoration:none;">${title}</a>
          <p style="margin:6px 0 0;font-size:13px;color:#374151;line-height:1.6;">${summary}</p>
          <span style="display:inline-block;margin-top:8px;font-size:11px;color:#6b7280;background:#e5e7eb;padding:2px 8px;border-radius:4px;">${source}</span>
        </div>`
        )
        .join("")}
    </div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="zh">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:640px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px;">
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#fff;">每日新闻速览</h1>
      <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,.8);">${dateStr}</p>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      ${topicBlocks}
    </div>

    <!-- Footer -->
    <div style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">由 Claude AI 自动生成 · ai-news-digest</p>
    </div>
  </div>
</body>
</html>`;
}

function buildText(summaries: TopicSummary[], dateStr: string): string {
  const lines = [`每日新闻速览 — ${dateStr}`, "=".repeat(40), ""];
  for (const { topic, items } of summaries) {
    lines.push(`[${topic}]`);
    for (const { title, summary, source } of items) {
      lines.push(`• ${title} (${source})`);
      lines.push(`  ${summary}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export async function sendDigest(summaries: TopicSummary[]): Promise<void> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });

  const html = buildHtml(summaries, dateStr);
  const text = buildText(summaries, dateStr);
  const subject = `每日新闻速览 · ${dateStr}`;

  const from = process.env.FROM_EMAIL ?? "digest@resend.dev";

  console.log(`[email] Sending to ${config.recipients.length} recipient(s)...`);

  const { error } = await resend.emails.send({
    from,
    to: config.recipients,
    subject,
    html,
    text,
  });

  if (error) throw new Error(`Resend error: ${JSON.stringify(error)}`);
  console.log("[email] Sent successfully");
}
