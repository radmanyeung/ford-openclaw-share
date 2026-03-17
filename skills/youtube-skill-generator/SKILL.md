---
name: youtube-skill-generator
description: Generate an OpenClaw/Claude Code skill from a YouTube tutorial video. Fetches transcript, analyses the tutorial content, extracts actionable steps, and produces a complete skill directory (SKILL.md + scripts + references). Use when user says "make a skill from this video", "turn this tutorial into a skill", "用呢條片生成 skill", or shares a YouTube URL with skill-creation intent.
tools: [Bash, Read, Edit, Write, Glob, Grep]
---

# YouTube Skill Generator

將 YouTube 教學影片自動轉換成可安裝嘅 OpenClaw / Claude Code skill。

## 重要原則

1. **一條片 = 一個 skill** — 每條影片生成一個獨立 skill
2. **忠於原片** — skill 嘅內容要準確反映影片教嘅嘢，唔好自己加料
3. **可執行** — 生成嘅 skill 要可以直接用，唔只係文字摘要
4. **逐步確認** — 每個階段都要用戶確認先繼續
5. **用繁體中文溝通**，skill 內容按影片語言 + 用戶偏好決定

---

## 工作流程

### Phase 1: 擷取同理解影片

**Step 1.1 — 擷取字幕**

用 youtube-video-learner 嘅 `fetch-transcript.py` 攞字幕：

```bash
python3 ~/.openclaw/workspace/skills/youtube-video-learner/scripts/fetch-transcript.py "VIDEO_URL" en
```

如果失敗，嘗試：
- 換語言 fallback
- 用 Jina Reader API：`curl -s "https://r.jina.ai/VIDEO_URL"`
- 提示用戶手動提供字幕/內容

**Step 1.2 — 分析影片類型**

睇完字幕後，判斷影片類型：

| 類型 | 特徵 | Skill 重點 |
|------|------|------------|
| **工具教學** | 安裝/設定某個工具 | 環境檢查 + 安裝步驟 + 設定指引 |
| **程式教學** | 寫 code / 用 API | 程式碼範例 + 依賴安裝 + 執行腳本 |
| **概念講解** | 解釋原理/架構 | 知識摘要 + 實踐建議 + 參考連結 |
| **流程示範** | 操作流程 / workflow | 逐步指引 + 檢查清單 + 自動化腳本 |
| **混合型** | 以上多種 | 綜合以上對應部分 |

**Step 1.3 — 提取關鍵資訊**

從字幕提取：
- **主題**：呢條片教咩
- **目標受眾**：新手 / 進階
- **前置條件**：需要事先裝好咩
- **工具清單**：提到嘅所有工具、平台、服務
- **操作步驟**：按時間順序嘅每個步驟
- **指令同程式碼**：影片入面展示嘅所有 command / code
- **常見問題**：影片有提到嘅 troubleshooting
- **外部連結**：影片提到嘅 repo、文檔、網站

**向用戶展示摘要，確認理解正確：**

```
📺 影片分析結果：

標題：{title}
類型：{type}
主題：{topic}

提取到：
  • {n} 個操作步驟
  • {n} 個工具/依賴
  • {n} 段指令/程式碼

要根據呢啲內容生成 skill 嗎？
```

---

### Phase 2: 設計 Skill 結構

**Step 2.1 — 決定 Skill 基本資料**

問用戶或自動推斷：
- **Skill ID**：英文小寫 + 連字號（如 `docker-compose-setup`）
- **Skill 名稱**：簡短描述
- **觸發條件**：咩情況下 agent 應該自動觸發呢個 skill

**Step 2.2 — 決定輸出結構**

根據影片類型決定要生成咩檔案：

```
{skill-id}/
├── SKILL.md              # 必有：主 skill 定義
├── scripts/              # 可選：如果影片有可執行嘅指令
│   └── setup.sh          #   安裝/設定腳本
│   └── check.sh          #   環境檢查腳本
└── references/           # 可選：如果有額外參考資料
    └── source-video.md   #   原片資訊同連結
```

**向用戶展示計劃，確認：**

```
📁 Skill 結構計劃：

ID：{skill-id}
目錄：~/.openclaw/workspace/skills/{skill-id}/
檔案：
  ✏️  SKILL.md — 主 skill（觸發條件 + 工作流程 + 步驟）
  🔧 scripts/setup.sh — 自動安裝腳本
  🔍 scripts/check.sh — 環境檢查腳本
  📖 references/source-video.md — 原片資訊

確認生成？
```

---

### Phase 3: 生成 Skill

**Step 3.1 — 生成 SKILL.md**

SKILL.md 必須包含以下結構：

```markdown
---
name: {skill-id}
description: {一句描述，要包含觸發關鍵字}
tools: [{需要嘅工具}]
---

# {Skill 名稱}

{簡短描述，1-2 句}

> 來源：[{影片標題}]({YouTube URL})

## 前置條件

- {condition_1}
- {condition_2}

## 環境檢查

喺開始之前，檢查以下依賴：
{用 bash 指令檢查每個工具是否已安裝}

## 工作流程

### Step 1: {step_title}
{描述}
```bash
{command}
```

### Step 2: {step_title}
...

## 常見問題

| 問題 | 解決方法 |
|------|----------|
| {issue} | {fix} |

## 參考

- 原片：{YouTube URL}
- 官方文檔：{doc_url}
```

**SKILL.md 撰寫原則：**
- `description` 要寫清楚觸發條件，等 agent 知幾時用
- 步驟要具體到可以直接執行
- 所有 command 要用 code block
- 影片入面嘅 placeholder（如 `YOUR_API_KEY`）保留原樣
- 加入環境檢查步驟，確保用戶環境就緒

**Step 3.2 — 生成腳本（如果適用）**

如果影片有多個安裝步驟，生成 `scripts/setup.sh`：

```bash
#!/usr/bin/env bash
# Auto-generated from: {YouTube URL}
# {影片標題}
set -euo pipefail

echo "=== {Skill Name} Setup ==="

# Step 1: {description}
echo "[1/N] {step}..."
{command}

# Step 2: {description}
echo "[2/N] {step}..."
{command}

echo "✅ Setup complete!"
```

如果有需要檢查環境，生成 `scripts/check.sh`：

```bash
#!/usr/bin/env bash
# Environment check for {skill-name}
set -euo pipefail

PASS=0; FAIL=0

check() {
  if command -v "$1" &>/dev/null; then
    echo "  ✅ $1 ($(command -v $1))"
    PASS=$((PASS+1))
  else
    echo "  ❌ $1 — 未安裝"
    FAIL=$((FAIL+1))
  fi
}

echo "環境檢查："
check {tool_1}
check {tool_2}

echo ""
echo "結果：✅ $PASS 通過  ❌ $FAIL 缺少"
```

**Step 3.3 — 生成 references/source-video.md**

```markdown
# 來源影片

- **標題**：{title}
- **URL**：{YouTube URL}
- **長度**：{duration}
- **語言**：{language}
- **生成日期**：{date}

## 影片重點時間戳

- [00:00] {topic_1}
- [02:30] {topic_2}
- [05:15] {topic_3}

## 影片提到嘅外部連結

- {url_1} — {description}
- {url_2} — {description}
```

---

### Phase 4: 安裝同驗證

**Step 4.1 — 寫入檔案**

```bash
mkdir -p ~/.openclaw/workspace/skills/{skill-id}/scripts
mkdir -p ~/.openclaw/workspace/skills/{skill-id}/references
```

將生成嘅檔案寫入。

**Step 4.2 — 同步到 Claude Code**

```bash
# 如果有 skill-sync.sh
~/.openclaw/scripts/skill-sync.sh 2>/dev/null || true

# 手動建 symlink（如果冇 sync script）
ln -sf ~/.openclaw/workspace/skills/{skill-id} ~/.claude/skills/{skill-id} 2>/dev/null || true
```

**Step 4.3 — 驗證 SKILL.md 格式**

檢查：
- frontmatter 有 `name` 同 `description`
- `name` 同目錄名一致
- `description` 包含觸發關鍵字
- 腳本有 `#!/usr/bin/env bash` 同 `set -euo pipefail`
- 腳本有執行權限

**Step 4.4 — 向用戶展示結果**

```
✅ Skill 生成完成！

📁 ~/.openclaw/workspace/skills/{skill-id}/
├── SKILL.md (XXX 行)
├── scripts/setup.sh
├── scripts/check.sh
└── references/source-video.md

觸發方式：
  • 話 agent「{trigger phrase}」
  • 或者 /{skill-id}

來源：{YouTube URL}
```

---

## 品質檢查清單

生成完 skill 後，自我檢查：

- [ ] SKILL.md frontmatter 格式正確（name, description, tools）
- [ ] description 有足夠嘅觸發關鍵字
- [ ] 步驟按影片順序排列
- [ ] 所有 command 都喺 code block 入面
- [ ] 冇硬編碼嘅路徑（用 `~` 或 `$HOME`）
- [ ] 冇洩漏 API key 或 secret
- [ ] 腳本有正確嘅 shebang 同 error handling
- [ ] 有返原片連結做參考
- [ ] 環境檢查涵蓋所有依賴

---

## 限制

- 字幕質素差嘅片可能影響提取準確度
- 純視覺操作（冇口述步驟）嘅片會缺失資訊
- 生成嘅 skill 需要用戶 review，唔好盲目信任
- 影片入面嘅版本號可能過時，提醒用戶檢查
