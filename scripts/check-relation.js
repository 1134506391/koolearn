/**
 * 验证 write_topic 与 write_detail 的一一对应关系
 * 运行：node scripts/check-relation.js
 */
const { all } = require('./db');

async function main() {
  const rows = await all(
    `SELECT
       (SELECT COUNT(*) FROM write_topic) AS topic_rows,
       (SELECT COUNT(*) FROM write_detail) AS detail_rows,
       (SELECT COUNT(DISTINCT id) FROM write_topic) AS distinct_topic_id,
       (SELECT COUNT(DISTINCT question_id) FROM write_detail) AS distinct_detail_id,
       (SELECT COUNT(*) FROM write_topic t
          LEFT JOIN write_detail d ON d.question_id = t.id
        WHERE d.question_id IS NULL) AS topic_without_detail,
       (SELECT COUNT(*) FROM write_detail d
          LEFT JOIN write_topic t ON t.id = d.question_id
        WHERE t.id IS NULL) AS detail_without_topic,
       (SELECT COUNT(*) FROM
          (SELECT question_id FROM write_detail GROUP BY question_id HAVING COUNT(*) > 1)) AS duplicated_detail_keys`,
  );
  console.log('=== 全表对应关系验证 ===');
  console.log(rows[0]);

  const joinSample = await all(
    `SELECT t.id, t.code, t.category, t.type,
            d.status, d.p_count,
            length(d.analysis) AS a_len, length(d.essay) AS e_len, length(d.vocabulary) AS v_len
     FROM write_topic t JOIN write_detail d ON d.question_id = t.id
     WHERE t.id = 11846`,
  );
  console.log('\n=== 11846 两表 JOIN 结果（一条 SQL 同时取题目+详情）===');
  console.log(joinSample[0]);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
