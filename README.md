# OpenClaw Setup Guide

從零開始設定 [OpenClaw](https://docs.openclaw.ai/) 多 Agent AI 系統嘅完整教學。

**OpenClaw 係乜？** 一個開源嘅 AI Agent 平台，可以喺你自己嘅伺服器（VPS）上面行多個 AI agent，每個 agent 有唔同嘅角色同能力，仲可以透過 Telegram / WhatsApp / 微信同佢哋對話。

呢個 Guide 包含：
- 一步步教你安裝同設定
- 34 個預建 Skills（等於 agent 嘅技能包）
- 環境檢查工具（自動幫你睇缺咩）
- 互動式 agent 引導（裝好之後可以用 AI 幫你設定）

---

## 目錄

**Part 1 — 安裝 + 上手**
- [Step 1：安裝 OpenClaw + 進入儀表板](#step-1安裝-openclaw--進入儀表板)
- [Step 2：連接 Messaging 平台](#step-2連接-messaging-平台)
- [Step 3：設定 API Keys](#step-3設定-api-keys)
- [Step 4：安裝 Skills](#step-4安裝-skills)
- [Step 5：用 OpenClaw Prompt 完成設定](#step-5用-openclaw-prompt-完成設定)

**Part 2 — 進階設定 + 參考**
- [設定模組（進階）](#設定模組進階)
- [Skills 分類](#skills-分類)
- [API Key 申請教學](#api-key-申請教學)
- [從 Windows 連入 VPS](#從-windows-連入-vps)
- [參考文檔](#參考文檔)

**Part 3 — 常見問題 + 排查手冊**
- [常見問題排查](#常見問題排查)

---

# Part 1 — 安裝 + 上手

---

### Step 1：安裝 OpenClaw + 進入儀表板

#### 1a. 安裝 Node.js + OpenClaw

用 SSH 連入你嘅 Ubuntu 伺服器，然後逐行貼入：

```bash
# 安裝 Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安裝 OpenClaw
sudo npm install -g openclaw

# 驗證
openclaw --version    # 應顯示 2026.3.13 或更高
```

#### 1b. 初始化

```bash
openclaw onboard
```

精靈會問你幾個問題（名稱、Gateway 密碼等），跟住答就得。完成後會建立 `~/.openclaw/` 目錄同基礎設定。

> **記住你設嘅 Gateway 密碼（`OPENCLAW_GATEWAY_TOKEN`）**，下一步要用。

#### 1c. 啟動 + 進入閘道儀表板

```bash
openclaw start
```

**本機存取（SSH 直連嘅情況）：**

打開瀏覽器去 `http://localhost:18789/`，用你喺 onboard 設嘅 Gateway token 登入。

**遠端存取（從 Windows/Mac 連 VPS）：**

先開 SSH tunnel，再用瀏覽器打開 `http://127.0.0.1:18789/`：

```bash
# 喺你嘅本地電腦（唔係 VPS）執行
ssh -L 18789:localhost:18789 你的用戶名@你的VPS_IP
```

Windows 用 PowerShell 打同一條指令，或者用 `setup/openclaw-tunnel.ps1` 腳本。

登入後你會見到 OpenClaw 閘道儀表板，可以：
- 睇所有 agent 嘅狀態
- 直接用 WebChat 同 agent 對話
- 管理 sessions 同設定

> 日後更新：`sudo npm update -g openclaw && openclaw gateway restart`

---

### Step 2：連接 Messaging 平台

#### 2a. 連接 Telegram

**方法 A — 手動設定：**

1. 喺 Telegram 搵 **@BotFather** → `/newbot` → 攞到 token
2. 將 token 填入 `~/.openclaw/.env` 嘅 `TELEGRAM_BOT_TOKEN=`
3. 編輯 `~/.openclaw/openclaw.json`，加入：

```jsonc
"channels": {
  "telegram": {
    "enabled": true,
    "dmPolicy": "pairing",
    "groupPolicy": "open",
    "streaming": "partial"
  }
}
```

4. `openclaw start` → 喺 Telegram DM bot → 輸入配對碼

**方法 B — 用 OpenClaw prompt：**

```
幫我設定 Telegram bot，我個 bot token 係 123456789:ABCdef...
啟用之後幫我配對
```

**搵你嘅 User ID：** 喺 Telegram 搵 **@userinfobot**，send 任何訊息就會回覆你嘅 ID。

**建立 Group 綁定（可選）：**

1. 建立 Telegram group → 加入 bot → 喺 group send 訊息
2. 攞 Group ID：
   ```bash
   curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getUpdates" | python3 -m json.tool | grep '"id"'
   ```
3. 加入 binding：
   ```jsonc
   "bindings": [
     {
       "agentId": "你的agent_id",
       "match": {
         "channel": "telegram",
         "peer": { "kind": "group", "id": "-你的group_id" }
       }
     }
   ]
   ```

**或者用 OpenClaw prompt：**

```
幫我將 gpt agent 綁去 Telegram group -5278907100
```

**安全設定：**

```jsonc
"channels": {
  "telegram": {
    "groupPolicy": "open",
    "groups": {
      "-你的group_id": {
        "requireMention": false,
        "allowFrom": [你的user_id]   // 只有你可以觸發
      }
    }
  }
}
```

**或者用 OpenClaw prompt：**

```
幫我設定 Telegram 安全，只有 user ID 1318441952 可以觸發 agent
```

---

#### 2b. 連接 WhatsApp

**方法 A — 手動設定：**

1. 編輯 `openclaw.json`，喺 `channels` 加入：
   ```jsonc
   "whatsapp": {
     "enabled": true,
     "dmPolicy": "pairing",
     "groupPolicy": "open"
   }
   ```
2. 登入：
   ```bash
   openclaw channels login --channel whatsapp
   ```
3. 手機 WhatsApp → Settings → Linked Devices → 掃 QR code
4. `openclaw start`

**方法 B — 用 OpenClaw prompt：**

```
幫我啟用 WhatsApp channel，然後幫我登入
```

**WhatsApp 支援：** 文字、圖片、影片、音頻、文件、已讀回條、Reaction、多帳號、Group 綁定。

**WhatsApp Group 綁定：**

```jsonc
{
  "agentId": "你的agent_id",
  "match": {
    "channel": "whatsapp",
    "peer": { "kind": "group", "id": "120363012345678901@g.us" }
  }
}
```

> Group JID 可以喺 `openclaw logs` 搵到。手機長時間離線需重新掃 QR：`openclaw channels login --channel whatsapp`

---

#### 2c. 連接 WeChat（微信）

WeChat 用社區 plugin 連接，透過 iPad 協議連接微信個人帳號。

**方法 A — 手動設定：**

```bash
openclaw plugins install @icesword760/openclaw-wechat
```

喺 `openclaw.json` 嘅 `plugins` 加入：

```jsonc
"plugins": {
  "allow": ["@icesword760/openclaw-wechat"],
  "entries": {
    "@icesword760/openclaw-wechat": {
      "enabled": true,
      "config": {
        "keywords": ["bot", "助手"],
        "replyAll": false
      }
    }
  }
}
```

```bash
openclaw plugins run @icesword760/openclaw-wechat login
# 用微信掃一掃 → 確認登入
openclaw start
```

**方法 B — 用 OpenClaw prompt：**

```
幫我安裝 WeChat plugin 同設定微信連接
```

> **注意：**
> - 用嘅係微信個人帳號（唔係公眾號），有被封號風險，建議用小號
> - Plugin 詳情：https://github.com/icesword0760/openclaw-wechat

---

### Step 3：設定 API Keys

**方法 A — 手動編輯（傳統）：**

```bash
cp .env.example ~/.openclaw/.env
chmod 600 ~/.openclaw/.env
nano ~/.openclaw/.env
```

> `nano` 編輯完按 `Ctrl+O` 儲存，`Ctrl+X` 離開。

**方法 B — 用 OpenClaw prompt（推薦唔熟 CLI 嘅人）：**

```
幫我設定 API keys。
我有以下 key：
- NVIDIA: nvapi-xxxxxxxx
- Telegram Bot: 7123456789:AAHxxxxx
- Gateway 密碼我想用: my-secret-123
幫我寫入 .env
```

**你需要填邊啲 Key？**

| Key 名稱 | 點樣攞 | 用途 | 一定要？ |
|-----------|---------|------|----------|
| `OPENCLAW_GATEWAY_TOKEN` | **自己揀一個密碼**（任意字串） | 用嚟登入 OpenClaw 網頁介面 | ✅ 必要 |
| `TELEGRAM_BOT_TOKEN` | 喺 Telegram 搵 [@BotFather](https://t.me/BotFather)，輸入 `/newbot` | 用嚟連接 Telegram bot | ✅ 如果要用 Telegram |
| `NVIDIA_..._API_KEY` | 去 [build.nvidia.com](https://build.nvidia.com) 註冊（免費） | 用嚟接入多款免費 AI 模型 | ✅ 推薦（免費） |
| `JINA_API_KEY` | 去 [jina.ai](https://jina.ai) 註冊（免費） | 用嚟做長期記憶嘅向量搜尋 | 可選 |
| `TAVILY_API_KEY` | 去 [tavily.com](https://tavily.com) 註冊 | 用嚟做網頁搜尋 | 可選 |

**填完之後嘅 `.env` 大概長咁：**

```
OPENCLAW_GATEWAY_TOKEN=my-secret-password-123
TELEGRAM_BOT_TOKEN=7123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NVIDIA_INTEGRATE_API_KEY=nvapi-xxxxxxxxxxxxxxxxxxxxxxxx
JINA_API_KEY=jina_xxxxxxxxxxxxxxxx
```

> 注意：`=` 後面直接貼 key，唔好加空格或引號。

---

### Step 4：安裝 Skills

Skills 就好似 App 咁，每個 skill 教識 agent 做一樣嘢。呢個 repo 包含 34 個預建 skill。

#### 4a. 從 GitHub 下載 Skills

```bash
# Clone 呢個 repo（包含所有 skill 檔案）
git clone https://github.com/radmanyeung/ford-openclaw-share.git ~/openclaw-setup-guide

# 入去睇下有咩
ls ~/openclaw-setup-guide/skills/
```

下載完之後，`skills/` 目錄結構：

```
~/openclaw-setup-guide/
├── README.md                  ← 你而家睇緊嘅呢份
├── skills-manifest.json       ← Skills 清單（分類 + 描述）
├── setup/                     ← 安裝腳本 + 設定範例
│   ├── install-skills.sh      ← 一鍵安裝腳本
│   ├── .env.example           ← API key 範例檔
│   └── openclaw-tunnel.ps1    ← Windows SSH tunnel 腳本
└── skills/                    ← 34 個 skill 目錄
    ├── tavily-search/
    │   └── SKILL.md           ← Skill 定義檔
    ├── memory-lancedb-pro/
    │   ├── SKILL.md
    │   └── refs/              ← 參考資料（部分 skill 有）
    ├── workflow-orchestrator/
    │   ├── SKILL.md
    │   └── scripts/           ← 腳本（部分 skill 有）
    └── ...
```

#### 4b. 安裝 Skills 到 OpenClaw

**方法 A — 用腳本（推薦）：**

```bash
cd ~/openclaw-setup-guide
bash setup/install-skills.sh --all      # 安裝全部 34 個
bash setup/install-skills.sh --check    # 檢查安裝結果
```

**方法 B — 手動安裝單個 skill：**

```bash
# 將 skill 複製到 OpenClaw workspace
cp -r ~/openclaw-setup-guide/skills/tavily-search ~/.openclaw/workspace/skills/

# 或者用 symlink（方便日後 git pull 更新）
ln -s ~/openclaw-setup-guide/skills/tavily-search ~/.openclaw/workspace/skills/tavily-search
```

**方法 C — 用 OpenClaw prompt：**

```
幫我安裝所有 skills
```

> **日後更新 Skills：** `cd ~/openclaw-setup-guide && git pull` 就會攞到最新版本。如果用咗 symlink，OpenClaw 會自動用到新版。

---

### Step 5：用 OpenClaw Prompt 完成設定

如果你唔熟 CLI，可以直接喺 OpenClaw WebChat / Telegram 用自然語言叫 agent 幫你完成設定。

> 前提：Step 1-4 已完成（OpenClaw 已安裝、至少連咗一個 messaging 平台或可以用 WebChat）。

**設定 Agents：**

```
幫我建立一個叫 gpt 嘅 agent，用 nvidia 嘅 deepseek-r1 模型，角色係萬能通才
```

**設定 Model Providers：**

```
幫我加入 NVIDIA 做 model provider，API key 係 nvapi-xxxxxxxx
```

**設定 Memory Plugin：**

```
幫我安裝 memory-lancedb-pro plugin，啟用長期記憶功能
```

**設定 Cron Jobs（定時任務）：**

```
幫我設定一個每日早上 9 點嘅 cron job，用 main agent 生成日報，deliver 去 Telegram
```

**設定 Compaction（長對話壓縮）：**

```
幫我設定 compaction，128k model 用 30% reserve tokens
```

**一次過設定（進階）：**

```
幫我做完整 OpenClaw setup：
- 加入 NVIDIA provider (key: nvapi-xxx)
- 建立 3 個 agent: gpt (通才), gemini (創意), claude (coder)
- 啟用 Telegram + WhatsApp
- 安裝 memory plugin
- 設定每日日報 cron job
```

> **提示：** Agent 嘅理解能力視乎你用嘅模型。用較強嘅模型（如 GPT-5、Gemini Pro、Claude Opus）會更準確咁完成設定。

---

# Part 2 — 進階設定 + 參考

## 設定模組（進階）

Setup Skill 包含 16 個獨立模組，你可以揀需要嘅跟：

| # | 模組 | 說明 | 新手需要？ |
|---|------|------|-----------|
| 1 | 環境變數 (.env) | API keys 集中管理 | ✅ |
| 2 | Model Providers | AI 模型來源（NVIDIA/Qwen/Jina） | ✅ |
| 3 | Agents | 建立 AI agents（角色、模型、權限） | ✅ |
| 4 | 工具權限與 Hooks | 控制 agent 可以用咩工具 | 進階 |
| 5 | Telegram 整合 | 連接 Telegram Bot | 如果要用 Telegram |
| 6 | Group 綁定 | Agent ↔ Telegram group 對應 | 如果要用 Telegram |
| 7 | Telegram 安全 | 邊個可以用你嘅 bot | 如果要用 Telegram |
| 8 | Compaction | 長對話自動壓縮摘要（慳 token） | 進階 |
| 9 | Memory Plugin | 長期記憶（agent 記得之前講過咩） | 推薦 |
| 10 | Cron Jobs | 定時自動任務（例如每日報告） | 進階 |
| 11 | Gateway | 網關設定（port/密碼/安全） | 進階 |
| 12 | Skills 安裝 | 34 個 skill 分 10 類 | ✅ |
| 13 | OpenClaw CLI 基礎 | 常用指令教學 | ✅ |
| 14 | Windows SSH 隧道 | 從 Windows 連去 VPS | 如果用 Windows |
| 15 | 遠端 Web UI | 用瀏覽器操作 OpenClaw | 推薦 |
| 16 | 驗證與啟動 | 最終檢查 + 啟動 | ✅ |

每個模組嘅詳細內容喺 [`setup/SKILL.md`](setup/SKILL.md)。

> **用 OpenClaw prompt：** `幫我 setup openclaw 嘅 [模組名稱]`（例如 `幫我 setup compaction`）

---

## Skills 分類

34 個 Skills 分為 10 類：

| 分類 | 數量 | 做咩用 | 需要 API Key？ |
|------|------|--------|----------------|
| **core** | 7 | OpenClaw 系統管理同設定 | 唔需要 |
| **memory** | 3 | AI 長期記憶（記得之前講過咩） | 需要 `JINA_API_KEY` |
| **monitoring** | 4 | 自動監控、日報週報、log 管理 | 唔需要 |
| **skills-mgmt** | 6 | Skill 搜尋、審計、版本管理 | 唔需要 |
| **workflow** | 3 | 多步驟任務自動化 | 唔需要 |
| **research** | 3 | AI 網頁搜尋同深度研究 | 需要 `TAVILY_API_KEY` |
| **data** | 2 | JSON/YAML 檔案驗證同修復 | 唔需要 |
| **integration** | 2 | 多個 API 整合 + 自動報告 | 唔需要 |
| **learning** | 3 | 自我學習 + YouTube 影片學習 + 影片轉 Skill | 唔需要 |
| **utility** | 1 | 天氣查詢 | 唔需要 |

完整清單見 [`skills-manifest.json`](skills-manifest.json)。

---

## API Key 申請教學

| Provider | 點樣申請 | 備註 |
|----------|----------|------|
| NVIDIA NIM | 去 [build.nvidia.com](https://build.nvidia.com) 註冊 → Dashboard → Create API Key | 免費 tier，推薦新手 |
| Jina | 去 [jina.ai](https://jina.ai) 註冊 → API Key 頁面 | 免費 tier，memory plugin 用 |
| Telegram Bot | 喺 Telegram app 搵 [@BotFather](https://t.me/BotFather) → 輸入 `/newbot` → 跟指示做 | 即時拎到 token |
| Tavily | 去 [tavily.com](https://tavily.com) 註冊 | 可選，網頁搜尋用 |
| Qwen Portal | 去 [portal.qwen.ai](https://portal.qwen.ai) 註冊 | OAuth 認證，需定期刷新 |

---

## 從 Windows 連入 VPS

如果你嘅 OpenClaw 行喺遠端 VPS，而你用 Windows 電腦，可以用 SSH 隧道連入：

1. 打開 `setup/openclaw-tunnel.ps1`，改入面嘅 VPS IP 同 SSH key 路徑
2. 右鍵 → 用 PowerShell 執行（首次可能要跑 `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`）
3. 連上之後喺瀏覽器打開 `http://127.0.0.1:18789/`
4. 輸入你設定嘅 `OPENCLAW_GATEWAY_TOKEN` 登入

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

# Part 3 — 常見問題排查

實際運維中遇過嘅問題同解決方法。每個都附 OpenClaw prompt，可以直接 copy 去叫 agent 幫你修。

---

### Agent 完全無回應

| 可能原因 | 點樣檢查 | 解決方法 |
|----------|----------|----------|
| OpenClaw 未啟動 | `openclaw status` | `openclaw start` |
| 設定檔格式錯誤 | `openclaw config validate` | 修正 JSON 語法錯誤 |
| `auth.json` 空或無效 | 檢查 `~/.openclaw/agents/<id>/agent/auth.json` | 從 `auth-profiles.json` 同步 token |
| Agent 冇指定 model | 檢查 `openclaw.json` → `agents.defaults.model` | 確保有 `primary` model |
| Bot token 錯 | 檢查 `~/.openclaw/.env` 嘅 token | 重新從 BotFather 攞 token |

> **OpenClaw prompt：** `我個 agent 冇回應，幫我 debug`

---

### OAuth Token 過期（Provider 認證失敗）

**症狀：** Agent 回覆 401/403 錯誤，或者直接冇回應。

**受影響 Provider：** Qwen Portal、OpenAI Codex 等用 OAuth 嘅 provider。

```bash
openclaw models auth login --provider qwen-portal
openclaw models auth login --provider openai-codex
```

> OAuth token 通常 2-4 週過期，需要手動刷新。
>
> **OpenClaw prompt：** `幫我檢查所有 provider 嘅認證狀態`

---

### Gateway 行緊但 CLI 命令 Hang 住

**症狀：** `openclaw` 命令 hang 超過 30 秒冇反應。

```bash
openclaw gateway restart
```

> **OpenClaw prompt：** `gateway 好似 hang 咗，幫我重啟`

---

### Cron Job 冇執行 / Delivery 失敗

| 問題 | 原因 | 解決 |
|------|------|------|
| Delivery 失敗 | 用咗 `"channel": "last"` | 改為 `"channel": "telegram", "to": "你的user_id"` |
| Job 一直顯示 error | Gateway 之前出過事，狀態冇 reset | 等下次正常執行會自動清除 |
| `announce` mode 唔 deliver | 已知 bug | 暫時改用 `log` mode + 手動檢查 |
| SIGTERM 終止 | 執行時間太長被 kill | 簡化 job 內容或加大 timeout |

```bash
openclaw cron status
openclaw cron run --id <job_id>    # 手動觸發測試
```

> **OpenClaw prompt：** `幫我檢查所有 cron job 嘅狀態，有冇 failed 嘅`

---

### Session Context 爆滿（Token Overflow）

**症狀：** Agent 回覆越嚟越慢，或者突然中斷。

```bash
openclaw sessions list --agent main    # 檢查
openclaw sessions reset --agent main   # 重置
```

**預防 — 正確設定 compaction：**
```jsonc
// openclaw.json → agents.defaults.compaction
"compaction": {
  "mode": "safeguard",
  "reserveTokens": 38400,       // context × 30%
  "reserveTokensFloor": 20000   // 最低保留（唔好設成大過 model context！）
}
```

> **踩過嘅坑：** `reserveTokensFloor` 設成 200000（大過 128k model context），compaction 永遠唔觸發，session 膨脹到 500%+。
>
> **OpenClaw prompt：** `幫我檢查所有 agent 嘅 session token 用量`

---

### Gateway 版本不一致

**症狀：** Dashboard 顯示嘅版本同 `openclaw --version` 唔同。

**原因：** 同時存在全域安裝（`/usr/lib/`）同用戶級安裝（`~/.local/`）。

```bash
which openclaw
ls ~/.local/lib/node_modules/openclaw/package.json 2>/dev/null

# 如果有兩份，刪除用戶級
rm -rf ~/.local/lib/node_modules/openclaw ~/.local/bin/openclaw
sudo npm update -g openclaw
openclaw gateway restart
```

> **OpenClaw prompt：** `幫我檢查 openclaw 安裝路徑有冇衝突`

---

### openclaw.json 啟動失敗（Unknown Key）

**症狀：** `openclaw start` 報 schema validation error。

```bash
openclaw config validate
# 對照 https://docs.openclaw.ai/gateway/configuration-reference
```

> **常見錯誤：** 打錯 key 名、用咗舊版本嘅 key、加咗 comment 但唔係 JSON5 格式。

---

### WhatsApp / WeChat 斷線

| 平台 | 原因 | 解決 |
|------|------|------|
| WhatsApp | 手機長時間離線 | `openclaw channels login --channel whatsapp` 重新掃 QR |
| WeChat | Session 過期 / 被踢 | `openclaw plugins run @icesword760/openclaw-wechat login` 重新掃碼 |

---

### Plugin 代碼改完冇生效

```bash
# 清 jiti 緩存（改完 .ts 檔案後必做）
rm -rf /tmp/jiti/
openclaw gateway restart
```

> 只改 config 唔使清 cache，只有改 `.ts` 源碼先要。

---

### API Key 明文洩漏

所有 key 應統一放 `~/.openclaw/.env`，設定檔用 `${ENV_VAR}` 引用。

```bash
# 掃描有冇明文 key
grep -r "nvapi-\|jina_\|sk-\|bot[0-9]" ~/.openclaw/agents/*/agent/models.json

# 設嚴權限
chmod 600 ~/.openclaw/.env
```

> **OpenClaw prompt：** `幫我掃描所有設定檔有冇明文 API key`

---

## License

MIT
