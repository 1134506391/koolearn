/**
 * 从 SQLite 导出网页浏览所需数据 → data/app-data.js
 * 以 window.APP_DATA 全局变量输出，index.html 通过普通 <script src> 加载，
 * 不受 file:// 的 fetch/CORS 限制，双击 HTML 即可使用。
 *
 * 运行：node scripts/export-web-data.js
 */
const fs = require('fs');
const path = require('path');
const { all, initSchema } = require('./db');

async function main() {
  await initSchema();

  const rows = await all(
    `SELECT t.id, t.date, t.code, t.type, t.category, t.title, t.url,
            d.analysis, d.essay, d.vocabulary
     FROM write_topic t
     JOIN write_detail d ON d.question_id = t.id
     ORDER BY t.id DESC`,
  );

  const topics = rows.map((r) => ({
    id: r.id,
    date: r.date,
    code: r.code,
    type: r.type,
    category: r.category,
    title: r.title,
    url: r.url,
    analysis: r.analysis,
    essay: r.essay,
    vocabulary: r.vocabulary,
  }));

  const categories = [...new Set(topics.map((t) => t.category))];
  const types = [...new Set(topics.map((t) => t.type))];
  const payload = {
    exportedAt: new Date().toISOString(),
    total: topics.length,
    categories,
    types,
    topics,
  };

  const outPath = path.join(__dirname, '..', 'data', 'app-data.js');
  const content =
    '// 由 scripts/export-web-data.js 自动生成，请勿手工编辑\n' +
    'window.APP_DATA = ' +
    JSON.stringify(payload) +
    ';\n';
  fs.writeFileSync(outPath, content, 'utf8');

  const kb = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log(`已导出 ${topics.length} 题 → ${outPath} (${kb} KB)`);
  console.log('话题分类:', categories.join('、'));
  console.log('题型:', types.join('、'));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
