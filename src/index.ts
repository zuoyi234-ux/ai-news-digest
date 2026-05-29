import "dotenv/config";
import { fetchYesterdayNews } from "./fetch";
import { summarizeNews } from "./summarize";
import { sendDigest } from "./email";

async function main() {
  console.log("=== ai-news-digest starting ===");

  const required = ["ANTHROPIC_API_KEY", "RESEND_API_KEY"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Missing env vars: ${missing.join(", ")}`);

  const grouped = await fetchYesterdayNews();

  if (grouped.size === 0) {
    console.log("No news found for yesterday. Skipping email.");
    return;
  }

  const summaries = await summarizeNews(grouped);
  await sendDigest(summaries);

  console.log("=== Done ===");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
