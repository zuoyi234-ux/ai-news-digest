/**
 * 本地测试脚本：只测试 RSS 抓取，不调用 Claude 或 Resend
 * 运行：npx ts-node src/test-fetch.ts
 */
import { fetchYesterdayNews } from "./fetch";

async function main() {
  console.log("=== 测试 RSS 抓取（不消耗 API 额度）===\n");

  const grouped = await fetchYesterdayNews();

  if (grouped.size === 0) {
    console.log("⚠️  昨日没有抓取到新闻。");
    console.log("   可能原因：");
    console.log("   1. 今天是周末，部分 RSS 源没有更新");
    console.log("   2. RSS 源返回格式变化，日期解析失败");
    console.log("   3. 网络超时（10s 内无响应会跳过该源）");
    console.log("\n💡 临时验证：修改 src/fetch.ts 中 isYesterday() 改为 isRecent()，");
    console.log("   让它接受最近 3 天的文章，确认抓取本身是通的。");
    return;
  }

  let total = 0;
  for (const [topic, items] of grouped) {
    console.log(`📌 ${topic}（${items.length} 条）`);
    for (const item of items) {
      console.log(`   • [${item.source}] ${item.title}`);
      console.log(`     ${item.link}`);
    }
    console.log();
    total += items.length;
  }

  console.log(`✅ 共抓取 ${total} 条新闻，分 ${grouped.size} 个话题`);
  console.log("   RSS 抓取正常，可以继续测试 Claude 摘要和邮件发送。");
}

main().catch((err) => {
  console.error("❌ 错误：", err.message);
  process.exit(1);
});
