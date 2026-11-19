/**
 * 探针：验证 chuguoapi 的 validation 签名算法
 * 算法来源：_app chunk 中的 asciiSort 函数
 *   validation = md5(sortedQuery + 'key=DFGHJKDJAGHHJFFKBJKBFAFAFAFAFBJBJfbhabvfa' + ts).toUpperCase()
 */
const crypto = require('crypto');

const SALT = 'DFGHJKDJAGHHJFFKBJKBFAFAFAFAFBJBJfbhabvfa';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

function buildValidation(params, ts) {
  const qs = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k] ?? ''}&`)
    .join('');
  const signStr = qs + 'key=' + SALT + ts;
  return crypto.createHash('md5').update(signStr, 'utf8').digest('hex').toUpperCase();
}

async function callApi(path, params) {
  const ts = Date.now();
  const validation = buildValidation(params, ts);
  const query = new URLSearchParams({ ...params, validation }).toString();
  const url = 'https://liuxue.koolearn.com' + path + '?' + query;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, websiteCheckTime: String(ts), Accept: 'application/json' },
  });
  const body = await res.text();
  return { status: res.status, body: body.slice(0, 600) };
}

(async () => {
  // 1) 配置接口（无需登录）
  console.log('--- getQuestionConfig ---');
  const r1 = await callApi('/chuguoapi/ielts/config/getQuestionConfig', {});
  console.log(r1);

  // 2) 范文接口（VIP 内容，先不带登录态）
  console.log('\n--- getTeacherModelEssay (no cookie) ---');
  const r2 = await callApi('/chuguoapi/ielts/writeModelEssay/getTeacherModelEssay', {
    questionCode: 'ielts--xz_jj_20260930_t2_01',
  });
  console.log(r2);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
