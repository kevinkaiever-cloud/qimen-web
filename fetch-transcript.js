/**
 * 调用 BibiGPT 字幕 API 获取视频逐字稿并保存为 UTF-8 文本
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = '2zFyRWMVczSx';
const VIDEO_URL = 'https://www.bilibili.com/video/BV1PC4y1E769';

const apiUrl = `https://api.bibigpt.co/api/v1/getSubtitle?url=${encodeURIComponent(VIDEO_URL)}&audioLanguage=zh`;

https.get(apiUrl, {
  headers: { 'Authorization': `Bearer ${API_KEY}` }
}, (res) => {
  let data = '';
  res.setEncoding('utf8');
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      if (!json.success || !json.detail?.subtitlesArray) {
        console.error('API 返回异常:', json);
        return;
      }
      const subs = json.detail.subtitlesArray;
      const lines = subs.map(s => {
        const h = Math.floor(s.startTime / 3600);
        const m = Math.floor((s.startTime % 3600) / 60);
        const sec = Math.floor(s.startTime % 60);
        const timeStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
        return `[${timeStr}] ${s.text}`;
      });
      const output = lines.join('\n');
      const outPath = path.join(__dirname, '奇门遁甲课程_逐字稿.txt');
      fs.writeFileSync(outPath, output, 'utf8');
      console.log('逐字稿已保存到:', outPath);
      console.log('共', subs.length, '条字幕');
    } catch (e) {
      console.error('解析失败:', e.message);
    }
  });
}).on('error', e => console.error('请求失败:', e.message));
