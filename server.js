require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const { getKnowledgeSystemPrompt } = require('./knowledge/qimen-knowledge');
let getRelevantSubtitleContext, hasSubtitleData;
try {
  const sub = require('./knowledge/subtitle-db');
  getRelevantSubtitleContext = sub.getRelevantSubtitleContext;
  hasSubtitleData = sub.hasSubtitleData;
} catch (e) {
  getRelevantSubtitleContext = () => '';
  hasSubtitleData = () => false;
}

const app = express();
const PORT = process.env.PORT || 3001;

const PAID_SECRET = process.env.PAID_SECRET || 'qimen-paid-secret-change-in-production';
const PAID_UNLOCK_CODES = (process.env.PAID_UNLOCK_CODES || '').split(',').map(s => s.trim()).filter(Boolean);
const PAID_TOKEN_EXPIRY_DAYS = 30;

function createPaidToken() {
  const payload = { paid: true, exp: Date.now() + PAID_TOKEN_EXPIRY_DAYS * 24 * 3600 * 1000 };
  const raw = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', PAID_SECRET).update(raw).digest('base64url');
  return raw + '.' + sig;
}

function verifyPaidToken(token) {
  if (!token || typeof token !== 'string') return false;
  const [raw, sig] = token.split('.');
  if (!raw || !sig) return false;
  try {
    const expected = crypto.createHmac('sha256', PAID_SECRET).update(raw).digest('base64url');
    if (expected !== sig) return false;
    const payload = JSON.parse(Buffer.from(raw, 'base64url').toString());
    return payload.paid === true && payload.exp > Date.now();
  } catch {
    return false;
  }
}

function getPaidToken(req) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  return (req.body && req.body.paidToken) || null;
}

function isValidApiKey(key) {
  if (!key || typeof key !== 'string') return false;
  const k = key.trim();
  return k.length >= 20 && k.startsWith('sk-') && !/[\r\n\u4e00-\u9fff]/.test(k);
}

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// 先注册所有 API，避免被静态路由抢占
// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// 知识库状态（字幕库是否已加载，便于前端或调试）
app.get('/api/knowledge/status', (req, res) => {
  res.json({
    subtitlesLoaded: hasSubtitleData(),
    hint: hasSubtitleData() ? '奇门解读/追问将自动注入相关课程字幕以提升准确性' : '未检测到 knowledge/data/all_subtitles.json，仅使用内置知识库'
  });
});

// 管理员：收到款后获取解锁码（复制发给客户用），需传 adminKey
const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.PAID_SECRET || '';
app.get('/api/admin/unlock-code', (req, res) => {
  const key = (req.query.adminKey || req.headers['x-admin-key'] || '').trim();
  if (!ADMIN_SECRET || key !== ADMIN_SECRET) {
    return res.status(403).json({ error: '需要管理员密钥' });
  }
  const first = PAID_UNLOCK_CODES[0];
  if (!first) return res.status(503).json({ error: '未配置解锁码' });
  res.json({ code: first });
});

// 付费解锁：扫码支付后凭解锁码换取 token，用于获取详细分析
app.post('/api/unlock', (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: '请提供解锁码（code）' });
    }
    const normalized = code.trim();
    if (!PAID_UNLOCK_CODES.length) {
      return res.status(503).json({ error: '服务端未配置解锁码，请联系管理员设置 PAID_UNLOCK_CODES' });
    }
    if (!PAID_UNLOCK_CODES.includes(normalized)) {
      return res.status(403).json({ error: '解锁码无效，请确认后重试或联系客服' });
    }
    const token = createPaidToken();
    res.json({ token, expiresIn: PAID_TOKEN_EXPIRY_DAYS + 'd' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '解锁失败' });
  }
});

// 奇门 AI 解读代理（经奇门知识训练，转发到 DeepSeek）
app.post('/api/qimen/interpret', async (req, res) => {
  try {
    const { panData, userQuestion, apiKey } = req.body || {};
    const paid = verifyPaidToken(getPaidToken(req));

    if (!apiKey || typeof apiKey !== 'string') {
      return res.status(400).json({ error: '缺少 DeepSeek API Key（apiKey）' });
    }
    if (!isValidApiKey(apiKey)) {
      return res.status(400).json({ error: 'API Key 格式无效，请填写正确的 DeepSeek API Key（以 sk- 开头）' });
    }
    if (!panData || !panData.grid) {
      return res.status(400).json({ error: '缺少盘面数据（panData）' });
    }

    const d = panData;
    const QM = {
      GUA: { 1: '坎', 2: '坤', 3: '震', 4: '巽', 5: '中', 6: '乾', 7: '兑', 8: '艮', 9: '离' }
    };

    // 构造九宫描述，逻辑与前端版本保持一致
    let desc = '';
    [1, 8, 3, 4, 9, 2, 7, 6].forEach(i => {
      const g = d.grid[i];
      desc += `${QM.GUA[i]}宫: ${g.door}门 ${g.star} 上${g.sky}下${g.earth} 神${g.god}\n`;
    });

    const qContext = userQuestion
      ? `用户求测事项：【${userQuestion}】`
      : '用户未填写具体事项（请警告用户一盘只测一事，并简述整体运势）';

    let systemPrompt = getKnowledgeSystemPrompt();
    const subtitleContext = getRelevantSubtitleContext(userQuestion || '');
    if (subtitleContext) systemPrompt += subtitleContext;
    const userPrompt = `【盘面解读任务】请针对以下盘面与用户问题进行奇门解读。

${qContext}

盘面信息：
时间：${d.dateStr} (${d.bazi})
局数：${d.info} ${d.xun}
值符：${d.zhifu} 值使：${d.zhishi}

九宫格局：
${desc}

要求：
1. 按断事逻辑步骤执行：先定人（日干等）、再定事（时干/开门等）、再看两宫生克、再看门星神与旺衰。
2. 严格针对用户的问题进行分析（问什么取什么用神，不发散）。
3. 如果用户未提供具体问题，请礼貌提醒“奇门重在有疑而测，一盘一事”，然后简单分析整体盘面。
4. 先给结论倾向（成/不成、顺/逆），再分层简述理由，最后用 1～2 句简洁总结。`;

    let finalUserPrompt = userPrompt;
    let maxTokens = undefined;
    if (!paid) {
      finalUserPrompt += '\n\n【重要】当前为免费简要模式：只输出约 300 字的分析过程（可谈用神落宫、门星神、生克等），不要给出最终结论或结果（不要明确说成/不成、顺/逆、利/不利、能/不能等断语）。仅做盘面分析，不说结果。';
      maxTokens = 500;
    }

    const dsRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: finalUserPrompt }
        ]
      })
    });

    if (!dsRes.ok) {
      const text = await dsRes.text();
      return res.status(500).json({ error: '调用 DeepSeek 失败', detail: text });
    }

    const json = await dsRes.json();
    const content = json.choices?.[0]?.message?.content || '';
    res.json({ content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 奇门 AI 追问接口（经奇门知识训练）：基于同一盘面对细节进行追加问答
app.post('/api/qimen/chat', async (req, res) => {
  try {
    const { panData, followQuestion, apiKey } = req.body || {};
    const paid = verifyPaidToken(getPaidToken(req));

    if (!apiKey || typeof apiKey !== 'string') {
      return res.status(400).json({ error: '缺少 DeepSeek API Key（apiKey）' });
    }
    if (!isValidApiKey(apiKey)) {
      return res.status(400).json({ error: 'API Key 格式无效，请填写正确的 DeepSeek API Key（以 sk- 开头）' });
    }
    if (!panData || !panData.grid) {
      return res.status(400).json({ error: '缺少盘面数据（panData）' });
    }
    if (!followQuestion || typeof followQuestion !== 'string') {
      return res.status(400).json({ error: '缺少追问内容（followQuestion）' });
    }

    const d = panData;
    const QM = {
      GUA: { 1: '坎', 2: '坤', 3: '震', 4: '巽', 5: '中', 6: '乾', 7: '兑', 8: '艮', 9: '离' }
    };

    let desc = '';
    [1, 8, 3, 4, 9, 2, 7, 6].forEach(i => {
      const g = d.grid[i];
      desc += `${QM.GUA[i]}宫: ${g.door}门 ${g.star} 上${g.sky}下${g.earth} 神${g.god}\n`;
    });

    let systemPrompt = getKnowledgeSystemPrompt();
    const subtitleContext = getRelevantSubtitleContext(followQuestion || '');
    if (subtitleContext) systemPrompt += subtitleContext;
    const userPrompt = `【追问任务】用户在同一张奇门盘的基础上进行追问，请基于奇门知识严谨作答。

当前盘面：
时间：${d.dateStr} (${d.bazi})
局数：${d.info} ${d.xun}
值符：${d.zhifu} 值使：${d.zhishi}

九宫格局：
${desc}

用户本次追问内容：
【${followQuestion}】

请你：
1. 先简要指出：在本盘原有象义下，这个追问是否仍然属于“同一件事”的延伸，如果偏离太多要礼貌提醒。
2. 在不违背本盘原判断的前提下，从细节上补充、放大或者修正对这件事的理解。
3. 给出 1~2 条可操作的建议（例如：应该更注意什么、哪些选择更顺势、哪些做法容易逆势）。
4. 最后用 1～2 句简洁易懂的话总结结论。
5. 结尾再强调：以上为奇门象义启发，不构成任何现实决策的保证。`;

    let finalUserPrompt = userPrompt;
    let chatMaxTokens = undefined;
    if (!paid) {
      finalUserPrompt += '\n\n【重要】当前为免费简要模式：只输出 2～4 行简要结论，不要展开详细分析。';
      chatMaxTokens = 300;
    }

    const dsRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: chatMaxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: finalUserPrompt }
        ]
      })
    });

    if (!dsRes.ok) {
      const text = await dsRes.text();
      return res.status(500).json({ error: '调用 DeepSeek 失败', detail: text });
    }

    const json = await dsRes.json();
    const content = json.choices?.[0]?.message?.content || '';
    res.json({ content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '奇门追问接口内部错误' });
  }
});

// 简易股市预测接口（支持 A 股 / 美股，示例逻辑，可后续接入真实行情 API）
app.post('/api/stocks/predict', (req, res) => {
  try {
    const { symbol, market = 'A', horizon = 'day' } = req.body || {};

    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({ error: '缺少股票代码（symbol）' });
    }

    // 简单哈希，保证同一代码预测结果基本稳定（示例用途）
    const seedStr = `${symbol.toUpperCase()}_${market}_${horizon}`;
    let h = 0;
    for (let i = 0; i < seedStr.length; i++) {
      h = (h * 31 + seedStr.charCodeAt(i)) >>> 0;
    }
    const rand = (min, max) => {
      h = (h * 1664525 + 1013904223) >>> 0;
      const r = h / 0xffffffff;
      return +(min + (max - min) * r).toFixed(2);
    };

    // 模拟一个“当前点位”和预测区间（不是真实行情，仅供体验）
    const base = market === 'US' ? rand(10, 500) : rand(1000, 5000);
    const vol = rand(0.8, 3.5);
    const up = +(base * (1 + vol / 100)).toFixed(2);
    const down = +(base * (1 - vol / 100)).toFixed(2);

    const bias = rand(-2.5, 2.5);
    const tendency = bias > 0.8 ? '偏强上行'
      : bias < -0.8 ? '偏弱下探'
      : '震荡整理';

    const confidence = +(60 + Math.abs(bias) * 15 + rand(-5, 5)).toFixed(1);

    const marketName = market === 'US' ? '美股' : 'A股';
    const horizonText =
      horizon === 'week' ? '未来一周'
      : horizon === 'month' ? '未来一月'
      : '当日/次日';

    const summary = [
      `${marketName} ${symbol}，以技术面与情绪因子为基础的模拟预测：`,
      `· 参考基准点位约：${base}`,
      `· 预测支撑区间：${down} 附近`,
      `· 预测压力区间：${up} 附近`,
      `· 预期走势：${tendency}（置信度约 ${confidence}%）`,
      '',
      `以上结果为示例级“盘位推演”，不构成任何投资建议，请务必结合真实行情与自身风险承受能力理性决策。`
    ].join('\n');

    res.json({
      symbol: symbol.toUpperCase(),
      market,
      horizon,
      basePoint: base,
      support: down,
      resistance: up,
      tendency,
      confidence,
      summary
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '股市预测接口内部错误' });
  }
});

// 示例 K 线数据接口（生成模拟 K 线，前端用于画图）
app.post('/api/stocks/kline', (req, res) => {
  try {
    const { symbol, market = 'A', points = 30 } = req.body || {};
    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({ error: '缺少股票代码（symbol）' });
    }

    const n = Math.max(10, Math.min(120, Number(points) || 30));
    const seedStr = `kline_${symbol.toUpperCase()}_${market}`;
    let h = 0;
    for (let i = 0; i < seedStr.length; i++) {
      h = (h * 31 + seedStr.charCodeAt(i)) >>> 0;
    }
    const rand = (min, max) => {
      h = (h * 1664525 + 1013904223) >>> 0;
      const r = h / 0xffffffff;
      return min + (max - min) * r;
    };

    const base = market === 'US' ? rand(10, 400) : rand(1000, 4000);
    const result = [];
    let lastClose = base;
    const today = new Date();

    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;

      const changePct = rand(-0.03, 0.03);
      const close = +(lastClose * (1 + changePct)).toFixed(2);
      const high = +(Math.max(close, lastClose) * (1 + rand(0, 0.01))).toFixed(2);
      const low = +(Math.min(close, lastClose) * (1 - rand(0, 0.01))).toFixed(2);
      const open = +(lastClose + (close - lastClose) * rand(0.2, 0.8)).toFixed(2);

      result.push({
        date: dateStr,
        open,
        close,
        low,
        high
      });

      lastClose = close;
    }

    res.json({
      symbol: symbol.toUpperCase(),
      market,
      candles: result
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'K 线数据接口内部错误' });
  }
});

// 奇门 + 股市 AI 综合解读接口：用当前盘面 + 股票信息去分析，并给出模拟点位区间
app.post('/api/stocks/qimen-interpret', async (req, res) => {
  try {
    const { panData, symbol, market = 'A', apiKey } = req.body || {};
    const paid = verifyPaidToken(getPaidToken(req));

    if (!apiKey || typeof apiKey !== 'string') {
      return res.status(400).json({ error: '缺少 DeepSeek API Key（apiKey）' });
    }
    if (!isValidApiKey(apiKey)) {
      return res.status(400).json({ error: 'API Key 格式无效，请填写正确的 DeepSeek API Key（以 sk- 开头）' });
    }
    if (!panData || !panData.grid) {
      return res.status(400).json({ error: '缺少盘面数据（panData）' });
    }
    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({ error: '缺少股票代码（symbol）' });
    }

    const d = panData;
    const QM = {
      GUA: { 1: '坎', 2: '坤', 3: '震', 4: '巽', 5: '中', 6: '乾', 7: '兑', 8: '艮', 9: '离' }
    };

    let desc = '';
    [1, 8, 3, 4, 9, 2, 7, 6].forEach(i => {
      const g = d.grid[i];
      desc += `${QM.GUA[i]}宫: ${g.door}门 ${g.star} 上${g.sky}下${g.earth} 神${g.god}\n`;
    });

    const marketName = market === 'US' ? '美股' : 'A股';

    // 基于盘面和股票信息生成一个“奇门视角”的点位和涨跌区间（示例算法）
    const seedStr = `${symbol.toUpperCase()}_${market}_${d.dateStr}_${d.zhifu}_${d.zhishi}`;
    let h = 0;
    for (let i = 0; i < seedStr.length; i++) {
      h = (h * 31 + seedStr.charCodeAt(i)) >>> 0;
    }
    const rand = (min, max) => {
      h = (h * 1664525 + 1013904223) >>> 0;
      const r = h / 0xffffffff;
      return min + (max - min) * r;
    };

    // 以市场不同给出一个基础点位
    const qmBase = market === 'US' ? rand(10, 400) : rand(1000, 4000);
    // 根据“气数强弱”模拟涨跌幅度
    const qiBias = rand(-0.04, 0.04); // -4% ~ +4%
    const upPct = Math.max(0.5, 3 + qiBias * 50);   // 大致 0.5% ~ 5% 区间
    const downPct = Math.max(0.5, 3 - qiBias * 50); // 与上方对冲

    const qmUp = +(qmBase * (1 + upPct / 100)).toFixed(2);
    const qmDown = +(qmBase * (1 - downPct / 100)).toFixed(2);
    const qiTendency =
      qiBias > 0.015 ? '奇门气数偏强，整体更偏向上攻或高位震荡'
      : qiBias < -0.015 ? '奇门气数偏弱，整体更偏向回落或低位震荡'
      : '奇门气数中性，更多是区间整理、上下反复';

    let systemPrompt = getKnowledgeSystemPrompt();
    const subtitleContext = getRelevantSubtitleContext(`奇门 财运 趋势 投资 ${symbol}`);
    if (subtitleContext) systemPrompt += subtitleContext;
    const userPrompt = `【奇门股市分析任务】你既精通奇门遁甲又熟悉现代金融市场。现有一张奇门盘面，请结合盘中信息，对【${marketName} ${symbol.toUpperCase()}】后续一段时间的趋势给出“象义层面”的分析与提示。

注意：
1. 你的分析重点在于奇门盘面与股票走势的类比与启发，不能给出具体买卖价格、涨跌幅承诺，也不能构成投资建议。
2. 可以从用神落宫、门星神组合、生克制化、旺衰、时空背景等角度来谈“此时介入该股票的大致风险收益格局”。
3. 允许适当提到“短线/中线/长线”的不同节奏，但不要给出具体日期和点位。
4. 系统已根据当前奇门盘面推演出的日/月走势，给出一个“奇门视角”的参考点位与涨跌区间（仅为象义演示）：基准点位约 ${qmBase.toFixed(
      2
    )}，上方参考区 ${qmUp.toFixed(2)}，下方参考区 ${qmDown.toFixed(
      2
    )}。请从奇门图预测天时、月令/日令的角度简要说明该区间的象义依据，但不要承诺收益。

奇门盘面：
时间：${d.dateStr} (${d.bazi})
局数：${d.info} ${d.xun}
值符：${d.zhifu} 值使：${d.zhishi}

九宫格局：
${desc}

请按以下顺序输出：
1. 对该股票当前“气数”的总体判断（偏顺/偏逆，顺势而为还是容易逆势而行）——保持专业分析。
2. 对短线参与风险点的提示（容易踩坑的地方）。
3. 对中长期布局的象义启发（适不适合耐心持有，还是更像快进快出）。
4. 结合上文依据奇门图预测日/月走势给出的点位区间，从风险/机会角度做简要归纳。
5. 最后必须用 1～2 句简洁易懂的话总结结论，方便用户一眼看懂。
6. 结尾再次强调：以上为奇门象义启发，不构成任何投资建议。`;

    let finalUserPrompt = userPrompt;
    let stockMaxTokens = undefined;
    if (!paid) {
      finalUserPrompt += '\n\n【重要】当前为免费简要模式：只输出 2～4 行简要结论（气数判断 + 一两句提示），不要展开用神、门星神、生克等详细分析。';
      stockMaxTokens = 350;
    }

    const dsRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: stockMaxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: finalUserPrompt }
        ]
      })
    });

    if (!dsRes.ok) {
      const text = await dsRes.text();
      return res.status(500).json({ error: '调用 DeepSeek 失败', detail: text });
    }

    const json = await dsRes.json();
    const content = json.choices?.[0]?.message?.content || '';
    res.json({
      content,
      qmBasePoint: +qmBase.toFixed(2),
      qmSupport: qmDown,
      qmResistance: qmUp,
      qiComment: qiTendency
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '奇门股市综合解读接口内部错误' });
  }
});

// 静态前端（放在 API 之后，避免 /api/* 被当成静态文件）
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

app.listen(PORT, () => {
  console.log(`奇门遁甲网站已启动：http://localhost:${PORT}`);
  if (hasSubtitleData()) console.log('已加载字幕知识库，解读 API 将按问题注入相关课程片段');
});

