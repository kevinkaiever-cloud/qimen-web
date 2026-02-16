# -*- coding: utf-8 -*-
"""调用 BibiGPT 字幕 API 获取视频逐字稿"""
import urllib.request
import urllib.parse
import json
import os

API_KEY = '2zFyRWMVczSx'
VIDEO_URL = 'https://www.bilibili.com/video/BV1PC4y1E769'

api_url = f'https://api.bibigpt.co/api/v1/getSubtitle?url={urllib.parse.quote(VIDEO_URL)}&audioLanguage=zh'

req = urllib.request.Request(api_url, headers={'Authorization': f'Bearer {API_KEY}'})
with urllib.request.urlopen(req, timeout=120) as resp:
    data = json.loads(resp.read().decode('utf-8'))

if not data.get('success') or 'detail' not in data or 'subtitlesArray' not in data['detail']:
    print('API 返回异常:', data)
    exit(1)

subs = data['detail']['subtitlesArray']
lines = []
for s in subs:
    t = s['startTime']
    h, m, sec = int(t // 3600), int((t % 3600) // 60), int(t % 60)
    time_str = f'{h:02d}:{m:02d}:{sec:02d}'
    lines.append(f'[{time_str}] {s["text"]}')

out_path = os.path.join(os.path.dirname(__file__), '奇门遁甲课程_逐字稿.txt')
with open(out_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

print('逐字稿已保存到:', out_path)
print('共', len(subs), '条字幕')
