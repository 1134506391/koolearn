/**
 * 采集新东方雅思在线 - Task 2 话题&题型练习全量题目清单
 * 数据来源：https://liuxue.koolearn.com/ielts/write-3-0-0/ （服务端直出 HTML，无需登录）
 *
 * 输出：
 *   data/write-task2-topics.json  结构化 JSON
 *   data/write-task2-topics.csv   带 BOM 的 CSV（Excel 可直接打开）
 *
 * 运行：node scripts/collect-write-task2.js
 */

const fs = require('fs');
const path = require('path');

const SOURCE_URL = 'https://liuxue.koolearn.com/ielts/write-3-0-0/';
const OUT_DIR = path.join(__dirname, '..', 'data');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

function decodeEntities(s) {
  if (!s) return '';
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pick(block, className) {
  const re = new RegExp(className + '[^>]*>([\\s\\S]*?)</(?:div|span)>', 'i');
  const m = block.match(re);
  return m ? decodeEntities(m[1].replace(/<[^>]+>/g, '')) : '';
}

async function main() {
  console.log('Fetching:', SOURCE_URL);
  const res = await fetch(SOURCE_URL, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const html = await res.text();
  console.log('HTML size:', html.length);

  // 每道题的标题锚点：<a ... href="/ielts/write/11846.html" ...>...question-name...</a>
  const anchorRe = /<a[^>]*href="\/ielts\/write\/(\d+)\.html"[^>]*>([\s\S]*?)<\/a>/g;
  const seen = new Set();
  const topics = [];
  let m;

  while ((m = anchorRe.exec(html)) !== null) {
    const id = m[1];
    const block = m[0];
    if (!block.includes('question-name') || seen.has(id)) continue;
    seen.add(id);

    topics.push({
      id: Number(id),
      url: `https://liuxue.koolearn.com/ielts/write/${id}.html?tab=highScore`,
      date: pick(block, 'question-createTime'),
      code: pick(block, 'write-tag-task'),
      type: pick(block, 'write-tag-category'),
      category: pick(block, 'write-tag-subject'),
      title: pick(block, 'question-name'),
    });
  }

  if (topics.length === 0) throw new Error('未解析到题目，页面结构可能已变化');

  // 统计
  const groupBy = (key) =>
    topics.reduce((acc, t) => {
      acc[t[key]] = (acc[t[key]] || 0) + 1;
      return acc;
    }, {});
  const stats = {
    total: topics.length,
    uniqueIds: seen.size,
    byCategory: groupBy('category'),
    byType: groupBy('type'),
    dateRange: [topics[topics.length - 1].date, topics[0].date],
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const jsonPath = path.join(OUT_DIR, 'write-task2-topics.json');
  fs.writeFileSync(
    jsonPath,
    JSON.stringify({ source: SOURCE_URL, fetchedAt: new Date().toISOString(), stats, topics }, null, 2),
    'utf8',
  );

  const csvHeader = 'id,date,code,type,category,title,url';
  const csvLine = (t) =>
    [t.id, t.date, t.code, t.type, t.category, t.title, t.url]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(',');
  const csvPath = path.join(OUT_DIR, 'write-task2-topics.csv');
  fs.writeFileSync(csvPath, '﻿' + [csvHeader, ...topics.map(csvLine)].join('\r\n'), 'utf8');

  console.log('\n=== 采集完成 ===');
  console.log('题目总数:', stats.total, '| 唯一ID:', stats.uniqueIds);
  console.log('时间跨度:', stats.dateRange.join(' ~ '));
  console.log('\n按话题分类:');
  Object.entries(stats.byCategory).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  console.log('\n按题型:');
  Object.entries(stats.byType).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  console.log('\n输出文件:');
  console.log(' ', jsonPath);
  console.log(' ', csvPath);
}

main().catch((e) => {
  console.error('采集失败:', e);
  process.exit(1);
});
