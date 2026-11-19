/**
 * SQLite 连接与表结构初始化（零额外依赖，使用项目已装的 sqlite3）
 */
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'koolearn.db');

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new sqlite3.Database(DB_PATH);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

async function initSchema() {
  await run(`CREATE TABLE IF NOT EXISTS write_topic (
    id         INTEGER PRIMARY KEY,
    date       TEXT,
    code       TEXT,
    type       TEXT,
    category   TEXT,
    title      TEXT,
    url        TEXT,
    fetched_at TEXT
  )`);

  await run(`CREATE TABLE IF NOT EXISTS write_detail (
    question_id INTEGER PRIMARY KEY,
    code        TEXT,
    analysis    TEXT,
    essay       TEXT,
    vocabulary  TEXT,
    p_count     INTEGER,
    status      TEXT,
    error       TEXT,
    fetched_at  TEXT,
    FOREIGN KEY (question_id) REFERENCES write_topic(id)
  )`);

  await run(`CREATE INDEX IF NOT EXISTS idx_topic_category ON write_topic(category)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_topic_type ON write_topic(type)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_detail_status ON write_detail(status)`);
}

module.exports = { db, run, all, initSchema, DB_PATH };
