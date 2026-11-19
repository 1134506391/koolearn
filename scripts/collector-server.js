/**
 * 本地收集器服务（仅监听 127.0.0.1）
 *
 * 浏览器端批量提取详情后 POST 到本服务，直接 upsert 进 SQLite，
 * 避免大数据经过对话上下文，并支持断点续抓。
 *
 * 接口：
 *   GET  /stats                采集进度统计
 *   GET  /pending?limit=N      尚未采集详情的题目 ID 列表
 *   POST /detail/batch         批量写入详情 [{questionId, code, analysis, essay, vocabulary, pCount, status, error}]
 *   OPTIONS *                  CORS 预检
 *
 * 运行：node scripts/collector-server.js
 */
const http = require('http');
const { run, all, initSchema, DB_PATH } = require('./db');

const PORT = 3977;
const HOST = '127.0.0.1';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', (c) => {
      buf += c;
      if (buf.length > 10 * 1024 * 1024) reject(new Error('body too large'));
    });
    req.on('end', () => resolve(buf));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.writeHead(204).end();

  try {
    const url = new URL(req.url, `http://${HOST}`);

    if (req.method === 'GET' && url.pathname === '/stats') {
      const topics = await all(`SELECT COUNT(*) AS n FROM write_topic`);
      const details = await all(`SELECT COUNT(*) AS n FROM write_detail`);
      const byStatus = await all(
        `SELECT status, COUNT(*) AS n FROM write_detail GROUP BY status`,
      );
      return json(res, 200, {
        topics: topics[0].n,
        details: details[0].n,
        remaining: topics[0].n - details[0].n,
        byStatus,
      });
    }

    if (req.method === 'GET' && url.pathname === '/pending') {
      const limit = Math.min(Number(url.searchParams.get('limit') || 20), 100);
      const rows = await all(
        `SELECT t.id, t.code, t.url FROM write_topic t
         LEFT JOIN write_detail d ON d.question_id = t.id
         WHERE d.question_id IS NULL
         ORDER BY t.id DESC
         LIMIT ?`,
        [limit],
      );
      return json(res, 200, rows);
    }

    // essay 中不含换行符（char(10)）的题目，即需要重抓段落的队列
    if (req.method === 'GET' && url.pathname === '/essay-pending') {
      const limit = Math.min(Number(url.searchParams.get('limit') || 20), 100);
      const rows = await all(
        `SELECT t.id, t.url FROM write_topic t
         JOIN write_detail d ON d.question_id = t.id
         WHERE instr(d.essay, char(10)) = 0
         ORDER BY t.id DESC
         LIMIT ?`,
        [limit],
      );
      return json(res, 200, rows);
    }

    // 只更新 essay 字段（保留 analysis / vocabulary 等其他字段）
    if (req.method === 'POST' && url.pathname === '/essay/batch') {
      let body = await readBody(req);
      if (body.startsWith('%')) body = decodeURIComponent(body);
      const items = JSON.parse(body);
      if (!Array.isArray(items)) return json(res, 400, { error: 'expected array' });

      const now = new Date().toISOString();
      let ok = 0;
      for (const it of items) {
        if (!it || !it.questionId || !it.essay) continue;
        await run(
          `UPDATE write_detail SET essay = ?, fetched_at = ? WHERE question_id = ?`,
          [it.essay, now, it.questionId],
        );
        ok++;
      }
      const left = await all(
        `SELECT COUNT(*) AS n FROM write_detail WHERE instr(essay, char(10)) = 0`,
      );
      return json(res, 200, { received: ok, noNewlineLeft: left[0].n });
    }

    if (req.method === 'POST' && url.pathname === '/detail/batch') {
      let body = await readBody(req);
      // 浏览器端通过 encodeURIComponent 包裹时先解码
      if (body.startsWith('%')) body = decodeURIComponent(body);
      const items = JSON.parse(body);
      if (!Array.isArray(items)) return json(res, 400, { error: 'expected array' });

      const now = new Date().toISOString();
      let ok = 0;
      for (const it of items) {
        if (!it || !it.questionId) continue;
        await run(
          `INSERT OR REPLACE INTO write_detail
             (question_id, code, analysis, essay, vocabulary, p_count, status, error, fetched_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            it.questionId,
            it.code || '',
            it.analysis || '',
            it.essay || '',
            it.vocabulary || '',
            it.pCount ?? 0,
            it.status || 'ok',
            it.error || '',
            now,
          ],
        );
        ok++;
      }
      const stats = await all(
        `SELECT (SELECT COUNT(*) FROM write_topic) AS topics,
                (SELECT COUNT(*) FROM write_detail) AS details`,
      );
      return json(res, 200, { received: ok, ...stats[0] });
    }

    return json(res, 404, { error: 'not found' });
  } catch (e) {
    return json(res, 500, { error: String(e && e.message ? e.message : e) });
  }
});

initSchema().then(() => {
  server.listen(PORT, HOST, () => {
    console.log(`Collector listening on http://${HOST}:${PORT}`);
    console.log('DB:', DB_PATH);
  });
});
