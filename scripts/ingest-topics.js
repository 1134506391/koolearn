/**
 * 将 data/write-task2-topics.json 导入 SQLite 的 write_topic 表
 * 运行：node scripts/ingest-topics.js
 */
const fs = require('fs');
const path = require('path');
const { run, all, initSchema, DB_PATH } = require('./db');

async function main() {
  await initSchema();
  const jsonPath = path.join(__dirname, '..', 'data', 'write-task2-topics.json');
  const payload = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const now = new Date().toISOString();

  let inserted = 0;
  for (const t of payload.topics) {
    await run(
      `INSERT OR REPLACE INTO write_topic (id, date, code, type, category, title, url, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [t.id, t.date, t.code, t.type, t.category, t.title, t.url, now],
    );
    inserted++;
  }

  const count = await all(`SELECT COUNT(*) AS n FROM write_topic`);
  console.log(`已写入 write_topic: ${inserted} 条，表内总数: ${count[0].n}`);
  console.log('数据库:', DB_PATH);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
