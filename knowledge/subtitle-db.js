/**
 * 奇门字幕知识库 - 基于 52 集雨霖奇门遁甲字幕的检索
 * 供 /api/qimen/interpret 与 /api/qimen/chat 按用户问题注入相关片段，提升解读准确性
 */
const path = require('path');
const fs = require('fs');

const DEFAULT_MAX_CHARS = 4200; // 控制注入长度，避免超出模型上下文
const DATA_PATH = path.join(__dirname, 'data', 'all_subtitles.json');

// 奇门常用关键词（用于与用户问题一起匹配）
const QIMEN_KEYWORDS = [
  '八门', '九星', '八神', '用神', '值符', '值使', '开门', '休门', '生门', '死门', '伤门', '杜门', '景门', '惊门',
  '天蓬', '天任', '天冲', '天辅', '天英', '天芮', '天柱', '天心', '天禽',
  '值符', '腾蛇', '太阴', '六合', '勾陈', '白虎', '朱雀', '玄武', '九地', '九天',
  '感情', '婚姻', '财运', '工作', '事业', '升职', '疾病', '案例', '五行', '生克', '九宫', '天干', '地支',
  '排盘', '解卦', '单宫', '落宫', '旺相', '休囚', '吉凶', '宫位', '坎', '坤', '震', '巽', '乾', '兑', '艮', '离',
  '奇门', '遁甲', '用神取法', '断事', '应期', '格局'
];

let _segments = null;
let _loadError = null;

function loadSegments() {
  if (_segments !== null) return _segments;
  if (_loadError) throw _loadError;
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    const data = JSON.parse(raw);
    _segments = Array.isArray(data.segments) ? data.segments : [];
    return _segments;
  } catch (e) {
    _loadError = e;
    _segments = [];
    return _segments;
  }
}

/**
 * 从用户问题中提取可能的关键词（2~6 字连续子串 + 已知术语）
 */
function extractQueryTerms(question) {
  const terms = new Set();
  if (!question || typeof question !== 'string') return terms;
  const s = question.replace(/\s/g, '');
  for (const kw of QIMEN_KEYWORDS) {
    if (s.includes(kw)) terms.add(kw);
  }
  for (let len = 2; len <= 6; len++) {
    for (let i = 0; i <= s.length - len; i++) {
      terms.add(s.slice(i, i + len));
    }
  }
  return terms;
}

/**
 * 计算一段文字与关键词集合的匹配得分（命中词数）
 */
function scoreSegment(text, terms) {
  if (!text || !terms.size) return 0;
  let score = 0;
  for (const t of terms) {
    if (t.length < 2) continue;
    if (text.includes(t)) score += t.length;
  }
  return score;
}

/**
 * 根据用户问题检索相关字幕片段，返回拼接后的文本（供注入 system prompt）
 * @param {string} userQuestion - 用户问题或求测事项
 * @param {number} maxChars - 最大字符数
 * @returns {string} 相关字幕内容，若无数据或出错则返回空字符串
 */
function getRelevantSubtitleContext(userQuestion, maxChars = DEFAULT_MAX_CHARS) {
  try {
    const segments = loadSegments();
    if (!segments.length) return '';

    const terms = extractQueryTerms(userQuestion);
    const scored = segments.map(seg => ({
      ...seg,
      score: scoreSegment(seg.text, terms)
    }));
    scored.sort((a, b) => b.score - a.score);

    const lines = [];
    let total = 0;
    const seen = new Set();
    for (const seg of scored) {
      if (total >= maxChars) break;
      if (!seg.text || seg.text.length < 4) continue;
      const key = seg.episode + '|' + seg.start + '|' + seg.text.slice(0, 30);
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(`[第${seg.episode}集] ${seg.text}`);
      total += seg.text.length + 20;
    }

    if (lines.length === 0) return '';
    return `\n\n## 参考：雨霖奇门课程字幕（与当前问题相关片段）\n${lines.join('\n')}\n`;
  } catch (e) {
    return '';
  }
}

/**
 * 是否已成功加载字幕数据
 */
function hasSubtitleData() {
  try {
    const segs = loadSegments();
    return segs.length > 0;
  } catch {
    return false;
  }
}

module.exports = {
  getRelevantSubtitleContext,
  hasSubtitleData,
  loadSegments
};
