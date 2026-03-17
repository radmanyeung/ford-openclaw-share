# OpenClaw Setup Guide

從零開始設定 [OpenClaw](https://docs.openclaw.ai/) 多 Agent AI 系統。包含完整嘅互動式設定教學 + 32 個預建 Skills。

## 呢個 Repo 有咩

```
├── setup/                    # 設定工具
│   ├── SKILL.md              # 互動式 setup skill（OpenClaw/Claude Code agent 用）
│   ├── env-check.sh          # 環境檢查腳本（對比你嘅環境同參考設定）
│   └── install-skills.sh     # Skills 安裝腳本
├── skills/                   # 32 個 OpenClaw Skills（10 分類）
├── skills-manifest.json      # Skills 清單 + 分類索引
├── .env.example              # API key 模板
└── README.md
```

## 快速開始

### 1. 環境檢查

```bash
git clone https://github.com/YOUR_USERNAME/openclaw-setup-guide.git
cd openclaw-setup-guide
bash setup/env-check.sh
```

腳本會顯示你嘅環境同參考設定嘅差異，並列出需要安裝嘅依賴。

### 2. 安裝 OpenClaw

```bash
# Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# OpenClaw
sudo npm install -g openclaw

# 初始設定
openclaw onboard
```

### 3. 設定 API Keys

```bash
cp .env.example ~/.openclaw/.env
chmod 600 ~/.openclaw/.env
# 編輯 ~/.openclaw/.env 填入你嘅 API keys
```

### 4. 安裝 Skills

```bash
# 睇所有分類
bash setup/install-skills.sh --list

# 安裝全部（32 個）
bash setup/install-skills.sh --all

# 或者揀分類
bash setup/install-skills.sh --category core,monitoring,data

# 或者互動選擇
bash setup/install-skills.sh --pick

# 檢查已安裝
bash setup/install-skills.sh --check
```

### 5. 用 Agent 引導設定（可選）

如果你已經裝好 OpenClaw 或 Claude Code，可以直接用 skill 互動引導：

```
你：幫我 setup openclaw
Agent：（自動觸發 openclaw-setup-guide skill，由環境檢查開始逐步引導）
```

---

## 設定模組

Setup Skill 包含 13 個獨立模組，可以揀需要嘅跟：

| # | 模組 | 說明 |
|---|------|------|
| 1 | 環境變數 (.env) | API keys 集中管理 |
| 2 | Model Providers | AI 模型來源（NVIDIA/Qwen/Jina） |
| 3 | Agents | 建立 AI agents（角色、模型、權限） |
| 4 | 工具權限與 Hooks | Tool profiles + 內建 hooks |
| 5 | Telegram 整合 | Bot 建立 + channel 啟用 |
| 6 | Group 綁定 | Agent ↔ Telegram group 對應 |
| 7 | Telegram 安全 | 存取控制 + 公開 agent 加固 |
| 8 | Compaction | 上下文壓縮（長對話自動摘要） |
| 9 | Memory Plugin | memory-lancedb-pro 長期記憶 |
| 10 | Cron Jobs | 定時任務排程 |
| 11 | Gateway | 網關設定（port/auth/安全） |
| 12 | Skills 安裝 | 32 個 skill 分 10 類 |
| 13 | OpenClaw CLI 基礎 | onboard / start / tui 常用指令 |
| 14 | Windows SSH 隧道 | 建立 .ps1 腳本連接 VPS |
| 15 | 遠端 Web UI 存取 | 透過 SSH tunnel 用瀏覽器操作 |
| 16 | 驗證與啟動 | 設定檢查 + 啟動 |

每個模組嘅詳細內容喺 [`setup/SKILL.md`](setup/SKILL.md)。

---

## Skills 分類

32 個 Skills 分為 10 個分類：

| 分類 | 數量 | 說明 | 需要嘅 API Key |
|------|------|------|----------------|
| **core** | 6 | OpenClaw 設定、gateway、provider 檢查 | — |
| **memory** | 3 | LanceDB 長期記憶、清理、context 管理 | `JINA_API_KEY` |
| **monitoring** | 4 | Cron 監控、日報週報、研究追蹤、log 復原 | — |
| **skills-mgmt** | 6 | Skill 搜尋、審計、版本控制、依賴追蹤 | — |
| **workflow** | 3 | 任務編排、事件驅動、模板庫 | — |
| **research** | 3 | Tavily web search、深度研究、情報收集 | `TAVILY_API_KEY` |
| **data** | 2 | JSON/YAML 驗證同自動修復 | — |
| **integration** | 2 | API 聚合器、自動報告管線 | — |
| **learning** | 2 | 自我學習、YouTube 影片學習 | — |
| **utility** | 1 | 天氣查詢（免 API key） | — |

完整清單見 [`skills-manifest.json`](skills-manifest.json)。

---

## API Key 取得方式

| Provider | 申請地址 | 備註 |
|----------|----------|------|
| NVIDIA NIM | https://build.nvidia.com | 免費 tier，推薦新手 |
| Jina | https://jina.ai | 免費 tier，memory plugin 用 |
| Telegram Bot | https://t.me/BotFather | `/newbot` 建立 |
| Tavily | https://tavily.com | 可選，web search 用 |
| Qwen Portal | https://portal.qwen.ai | OAuth 認證，需定期刷新 |

---

## 參考文檔

### OpenClaw 官方

| 資源 | 說明 |
|------|------|
| [官方文檔](https://docs.openclaw.ai/) | 完整設定同使用文檔 |
| [Features 總覽](https://docs.openclaw.ai/concepts/features) | 功能清單同概念介紹 |
| [設定參考](https://docs.openclaw.ai/gateway/configuration-reference) | openclaw.json 所有欄位說明 |
| [設定範例](https://docs.openclaw.ai/gateway/configuration-examples) | 常見設定範例 |
| [Troubleshooting](https://docs.openclaw.ai/troubleshooting) | 常見問題排查 |
| [GitHub Repo](https://github.com/openclaw/openclaw) | 源碼同 issue tracker |
| [v2026.3.13 Release Notes](https://github.com/openclaw/openclaw/releases/tag/v2026.3.13-1) | 最新版本 changelog |
| [Discord 社群](https://discord.gg/clawd) | 官方 Discord |

### Skills 同 Plugin 資源

| 資源 | 說明 |
|------|------|
| [ClawHub](https://clawhub.ai) | 官方 Skill 市場 |
| [skills.sh](https://skills.sh/) | Skills 瀏覽同搜尋 |
| [ClawHub Skill Schema](https://clawhub.com/schemas/skill/v1) | Skill 檔案格式定義 |
| [Anthropic Skill Creator](https://github.com/anthropics/Skills/tree/main/Skills/skill-creator) | 官方 skill 建立工具 |
| [obra/superpowers](https://github.com/obra/superpowers) | 開發流程 agentic skills（TDD、debug、parallel） |
| [composiohq/awesome-claude-Skills](https://github.com/composiohq/awesome-claude-Skills) | 78+ SaaS 整合 skills |
| [heilcheng/awesome-agent-Skills](https://github.com/heilcheng/awesome-agent-Skills) | Agent skills 目錄 |
| [gotalab/skillport](https://github.com/gotalab/skillport) | Skill 分享平台 |
| [muratcankoylan/Context-Engineering](https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering) | Context 管理 skills |

### Memory Plugin (LanceDB)

| 資源 | 說明 |
|------|------|
| [memory-lancedb-pro](https://github.com/CortexReach/memory-lancedb-pro) | Plugin 源碼 |
| [Setup 教學影片 (YouTube)](https://youtu.be/MtukF1C8epQ) | memory-lancedb-pro 安裝同設定教學 |
| [Setup Tools](https://github.com/CortexReach/toolbox/tree/main/memory-lancedb-pro-setup) | 設定輔助工具 |
| [LanceDB](https://lancedb.com) | 向量資料庫官網 |
| [xdylanbaker/memory-hygiene](https://github.com/xdylanbaker/memory-hygiene) | 記憶清理工具 |

### AI Model Providers

| Provider | 申請 Key | 文檔 |
|----------|----------|------|
| NVIDIA NIM | [build.nvidia.com](https://build.nvidia.com) | 免費 tier，多款模型 |
| Jina AI | [jina.ai](https://jina.ai/api-key) | Embedding + Reranker |
| Qwen Portal | [portal.qwen.ai](https://portal.qwen.ai) | OAuth 認證 |
| OpenAI | [platform.openai.com](https://platform.openai.com/api-keys) | GPT 系列 |
| Google Gemini | [ai.google.dev](https://ai.google.dev/) | Gemini 系列 |
| SiliconFlow | [cloud.siliconflow.cn](https://cloud.siliconflow.cn/account/ak) | 國產模型聚合 |
| DashScope | [dashscope.aliyuncs.com](https://dashscope.aliyuncs.com/) | 阿里雲 AI |
| Ollama | [ollama.com](https://ollama.com/download) | 本地模型運行 |
| Tavily | [tavily.com](https://tavily.com) | AI 搜尋 API |

### 社群教學同文章

| 資源 | 說明 |
|------|------|
| [OpenClaw Explained (Medium)](https://medium.com/@hasanmcse/openclaw-explained-features-real-world-use-cases-1ad115dd6578) | 功能同實際用例介紹 |
| [Ultimate Guide (Reddit)](https://www.reddit.com/r/ThinkingDeeplyAI/comments/1qsoq4h/the_ultimate_guide_to_openclaw_formerly_clawdbot/) | 從安裝到安全管理嘅完整指南 |
| [aivi.fyi](https://www.aivi.fyi) | Agent prompt engineering 指南 |
| [win4r/AISuperDomain](https://github.com/win4r/AISuperDomain) | AI domain skill 整合 |

---

## License

MIT
