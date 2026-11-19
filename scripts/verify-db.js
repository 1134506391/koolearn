/**
 * 数据库全量质检：行数、关联完整性、空字段、内容长度、分类覆盖
 * 运行：node scripts/verify-db.js
 */
const { all, initSchema, DB_PATH } = require('./db');

async function main() {
  await initSchema();

  const counts = await all(`
    SELECT
      (SELECT COUNT(*) FROM write_topic) AS topics,
      (SELECT COUNT(*) FROM write_detail) AS details,
      (SELECT COUNT(*) FROM write_detail WHERE status='ok') AS ok,
      (SELECT COUNT(*) FROM write_detail WHERE p_count=3) AS p3,
      (SELECT COUNT(*) FROM write_detail WHERE length(trim(analysis))=0) AS empty_analysis,
      (SELECT COUNT(*) FROM write_detail WHERE length(trim(essay))=0) AS empty_essay,
      (SELECT COUNT(*) FROM write_detail WHERE length(trim(vocabulary))=0) AS empty_vocab,
      (SELECT COUNT(*) FROM write_topic t LEFT JOIN write_detail d ON d.question_id=t.id
        WHERE d.question_id IS NULL) AS missing_details
  `);
  console.log('=== 完整性 ===');
  console.log(counts[0]);

  const lens = await all(`
    SELECT
      MIN(length(analysis)) AS a_min, MAX(length(analysis)) AS a_max, AVG(length(analysis)) AS a_avg,
      MIN(length(essay)) AS e_min, MAX(length(essay)) AS e_max, AVG(length(essay)) AS e_avg,
      MIN(length(vocabulary)) AS v_min, MAX(length(vocabulary)) AS v_max, AVG(length(vocabulary)) AS v_avg
    FROM write_detail
  `);
  console.log('\n=== 内容长度（字符）===');
  const r = lens[0];
  for (const [k, v] of Object.entries(r)) console.log(`  ${k}: ${Math.round(v)}`);

  const coverage = await all(`
    SELECT t.category, t.type, COUNT(*) AS n,
           SUM(CASE WHEN d.question_id IS NOT NULL THEN 1 ELSE 0 END) AS has_detail
    FROM write_topic t LEFT JOIN write_detail d ON d.question_id = t.id
    GROUP BY t.category, t.type ORDER BY t.category, t.type
  `);
  console.log('\n=== 分类 × 题型覆盖 ===');
  coverage.forEach((c) =>
    console.log(`  ${c.category} / ${c.type}: ${c.n} 题, 详情 ${c.has_detail}`),
  );

  const sample = await all(`
    SELECT t.id, t.category, t.type, t.code,
           substr(d.analysis,1,60) AS analysis_head,
           substr(d.essay,1,60) AS essay_head,
           substr(d.vocabulary,1,60) AS vocab_head
    FROM write_topic t JOIN write_detail d ON d.question_id=t.id
    WHERE t.id IN (377, 12441) ORDER BY t.id
  `);
  console.log('\n=== 抽检（最旧 377 / 最新 12441）===');
  sample.forEach((s) => console.log(JSON.stringify(s, null, 1)));

  console.log('\nDB:', DB_PATH);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
