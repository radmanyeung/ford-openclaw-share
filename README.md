# OpenClaw Setup Guide

從零開始設定 [OpenClaw](https://docs.openclaw.ai/) 多 Agent AI 系統嘅完整教學。

**OpenClaw 係乜？** 一個開源嘅 AI Agent 平台，可以喺你自己嘅伺服器（VPS）上面行多個 AI agent，每個 agent 有唔同嘅角色同能力，仲可以透過 Telegram 同佢哋對話。

呢個 Guide 包含：
- 一步步教你安裝同設定
- 34 個預建 Skills（等於 agent 嘅技能包）
- 環境檢查工具（自動幫你睇缺咩）
- 互動式 agent 引導（裝好之後可以用 AI 幫你設定）

---

## 你需要準備咩

| 項目 | 說明 |
|------|------|
| **一部 Ubuntu 伺服器** | 可以係 VPS（雲端虛擬機）或本地 Linux 機。推薦 Ubuntu 22.04 或 24.04 |
| **SSH 連線** | 你要識用終端機（Terminal）連入伺服器，Windows 可以用 PowerShell 或 PuTTY |
| **基本終端機知識** | 識打指令、識 `cd`（進入資料夾）同 `ls`（列出檔案）就夠 |

---

## 呢個 Repo 有咩

```
├── setup/                    # 設定工具
│   ├── SKILL.md              # 互動式 setup skill（OpenClaw/Claude Code agent 用）
│   ├── env-check.sh          # 環境檢查腳本（對比你嘅環境同參考設定）
│   ├── install-skills.sh     # Skills 安裝腳本
│   └── openclaw-tunnel.ps1   # Windows SSH 隧道腳本（從 Windows 連入 VPS）
├── skills/                   # 34 個 OpenClaw Skills（10 分類）
├── skills-manifest.json      # Skills 清單 + 分類索引
├── .env.example              # API key 模板
└── README.md
```

---

## 快速開始（逐步跟住做）

### Step 1：下載呢個 Guide 到你嘅伺服器

首先用 SSH 連入你嘅 Ubuntu 伺服器，然後喺終端機輸入：

```bash
# 下載呢個 repo（需要裝咗 git，Ubuntu 通常已經有）
git clone https://github.com/radmanyeung/ford-openclaw-share.git

# 進入下載咗嘅資料夾
cd ford-openclaw-share

# 檢查你嘅環境（呢個腳本會話你缺咩嘢要裝）
bash setup/env-check.sh
```

**你會見到咩？** 腳本會逐項檢查：
- Node.js 裝咗未？版本夠唔夠？
- npm（Node.js 嘅套件管理器）有冇？
- OpenClaw 裝咗未？
- 設定檔存唔存在？

每項會顯示 ✅（OK）、⚠️（版本唔啱）或 ❌（未裝），仲會喺最底話你要跑咩指令去修正。

---

### Step 2：安裝 Node.js 同 OpenClaw

OpenClaw 係用 Node.js 寫嘅，所以要先裝 Node.js。

**2a. 裝 Node.js（如果 Step 1 顯示未裝或版本太舊）：**

```bash
# 加入 Node.js 20 嘅安裝來源
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# 安裝 Node.js（會順便裝埋 npm）
sudo apt-get install -y nodejs
```

裝完之後驗證：

```bash
node --version    # 應該顯示 v20.x.x 或更高
npm --version     # 應該顯示 10.x.x 或更高
```

**2b. 裝 OpenClaw：**

```bash
# 用 npm 全域安裝 OpenClaw
sudo npm install -g openclaw
```

裝完驗證：

```bash
openclaw --version    # 應該顯示 2026.3.13 或更高
```

**2c. 初始化 OpenClaw：**

```bash
# 呢個指令會建立 ~/.openclaw/ 資料夾同基本設定
openclaw onboard
```

`openclaw onboard` 會互動式問你幾個問題（例如名稱），跟住指示答就得。完成後你嘅 home 目錄會多咗一個 `~/.openclaw/` 資料夾。

---

### Step 3：設定 API Keys

**API Key 係乜？** 就好似密碼一樣，用嚟驗證你嘅身份，等第三方服務（例如 AI 模型）知道係你喺用。每個服務都要分別申請自己嘅 Key。

**3a. 建立 `.env` 檔案：**

```bash
# 將模板複製到 OpenClaw 嘅設定資料夾
cp .env.example ~/.openclaw/.env

# 設定權限（只有你自己可以讀寫，保護你嘅 key）
chmod 600 ~/.openclaw/.env
```

**3b. 用文字編輯器打開 `.env` 填入你嘅 keys：**

```bash
nano ~/.openclaw/.env
```

> `nano` 係 Ubuntu 內建嘅文字編輯器。編輯完按 `Ctrl+O` 儲存，再按 `Ctrl+X` 離開。

**3c. 你需要填邊啲 Key？**

以下係每個 Key 嘅用途同申請方法：

| Key 名稱 | 點樣攞 | 用途 | 一定要？ |
|-----------|---------|------|----------|
| `OPENCLAW_GATEWAY_TOKEN` | **自己揀一個密碼**（任意字串） | 用嚟登入 OpenClaw 網頁介面 | ✅ 必要 |
| `TELEGRAM_BOT_TOKEN` | 喺 Telegram 搵 [@BotFather](https://t.me/BotFather)，輸入 `/newbot`，跟指示建立 bot，佢會俾你一串 token | 用嚟連接 Telegram bot | ✅ 如果要用 Telegram |
| `NVIDIA_..._API_KEY` | 去 [build.nvidia.com](https://build.nvidia.com) 註冊（免費），喺 Dashboard 建立 API Key | 用嚟接入多款免費 AI 模型 | ✅ 推薦（免費） |
| `JINA_API_KEY` | 去 [jina.ai](https://jina.ai) 註冊（免費），去 API Key 頁面建立 | 用嚟做長期記憶嘅向量搜尋 | 可選 |
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

### Step 4：安裝 Skills（AI agent 嘅技能包）

Skills 就好似 App 咁，每個 skill 教識 agent 做一樣嘢（例如搜尋網頁、監控系統、生成報告）。

```bash
# 睇所有分類同 skill 清單
bash setup/install-skills.sh --list

# 安裝全部 34 個（推薦新手用呢個）
bash setup/install-skills.sh --all

# 或者只裝某幾個分類（用逗號分隔）
bash setup/install-skills.sh --category core,monitoring

# 或者互動選擇（一個個問你裝唔裝）
bash setup/install-skills.sh --pick

# 裝完之後檢查
bash setup/install-skills.sh --check
```

---

### Step 5：連接 Messaging 平台

OpenClaw 支援多個聊天平台。以下係三個最常用嘅連接方法。

#### 5a. 連接 Telegram

**建立 Bot：**

1. 打開 Telegram，搵 **@BotFather**
2. Send `/newbot`
3. 輸入 bot 名稱（如 `My OpenClaw Bot`）
4. 輸入 bot username（如 `my_openclaw_bot`，必須以 `_bot` 結尾）
5. BotFather 會回覆一個 **token**，樣子似 `123456789:ABCdef...`
6. 將 token 填入 `~/.openclaw/.env` 嘅 `TELEGRAM_BOT_TOKEN=`

**啟用 Telegram channel：**

編輯 `~/.openclaw/openclaw.json`，加入：

```jsonc
"channels": {
  "telegram": {
    "enabled": true,
    "dmPolicy": "pairing",     // DM 需要配對先可以用
    "groupPolicy": "open",     // Group 預設開放
    "streaming": "partial"     // 打字時即時串流回覆
  }
}
```

**啟動 + 配對：**

```bash
openclaw start
```

打開 Telegram，DM 你嘅 bot，佢會回覆一個 **配對碼**。喺 terminal 入面輸入配對碼完成綁定。

**搵你嘅 User ID（安全設定需要）：**

1. 喺 Telegram 搵 **@userinfobot**，send 任何訊息
2. 佢會回覆你嘅 user ID（一串數字如 `1318441952`）
3. 記低呢個 ID，之後設定 group 存取控制會用到

**建立 Group 綁定（可選）：**

如果你想每個 agent 有自己嘅 Telegram group：

1. 喺 Telegram 建立一個新 group
2. 將你嘅 bot 加入 group（搜尋 bot username → Add to Group）
3. 喺 group 入面 send 任何訊息
4. 攞 Group ID：
   ```bash
   curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getUpdates" | python3 -m json.tool | grep '"id"'
   ```
   Group ID 係負數，例如 `-5278907100`
5. 喺 `openclaw.json` 嘅 `bindings` 加入：
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

**Telegram 安全設定：**

喺 `channels.telegram.groups` 為每個 group 設定邊個可以觸發 agent：

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

> 冇 `allowFrom` 嘅 group = 任何人都可以觸發。公開 group 建議配合 `tools.profile: "messaging"` 限制 agent 權限。

---

#### 5b. 連接 WhatsApp

OpenClaw 用 Baileys（WhatsApp Web 協議）連接 WhatsApp，透過 QR code 配對。

**啟用 WhatsApp channel：**

編輯 `~/.openclaw/openclaw.json`，喺 `channels` 加入：

```jsonc
"channels": {
  "telegram": { ... },     // 保留之前嘅 Telegram 設定
  "whatsapp": {
    "enabled": true,
    "dmPolicy": "pairing",
    "groupPolicy": "open"
  }
}
```

**登入 WhatsApp：**

```bash
openclaw channels login --channel whatsapp
```

Terminal 會顯示一個 **QR code**。用你嘅手機：

1. 打開 WhatsApp → **Settings** → **Linked Devices**
2. 點 **Link a Device**
3. 掃描 terminal 上嘅 QR code

成功後 terminal 會顯示已連接。Credential 會儲存喺 `~/.openclaw/credentials/whatsapp/`。

**重啟 OpenClaw：**

```bash
openclaw start
```

而家你可以透過 WhatsApp DM 同 agent 對話。

**WhatsApp 支援功能：** 文字、圖片、影片、音頻、文件、已讀回條、Reaction、多帳號、Group 綁定。

**WhatsApp Group 綁定：**

```jsonc
// 加入 bindings 陣列
{
  "agentId": "你的agent_id",
  "match": {
    "channel": "whatsapp",
    "peer": {
      "kind": "group",
      "id": "120363012345678901@g.us"   // WhatsApp Group JID
    }
  }
}
```

> WhatsApp Group JID 可以喺 `openclaw logs` 入面搵到（當有人喺 group send 訊息時會顯示）。

**WhatsApp 安全設定：**

```jsonc
"channels": {
  "whatsapp": {
    "dmPolicy": "pairing",
    "groupPolicy": "open",
    "groups": {
      "120363012345678901@g.us": {
        "allowFrom": ["85291234567@s.whatsapp.net"]  // 只允許特定號碼
      }
    }
  }
}
```

> **注意：** WhatsApp 連接基於 WhatsApp Web，你嘅手機需要保持連網。長時間離線可能需要重新掃 QR code：`openclaw channels login --channel whatsapp`。

---

#### 5c. 連接 WeChat（微信）

WeChat 整合係透過社區 plugin 實現，用 WeChatPadPro（iPad 協議）連接微信個人帳號。

**安裝 WeChat plugin：**

```bash
openclaw plugins install @icesword760/openclaw-wechat
```

**設定 plugin：**

編輯 `~/.openclaw/openclaw.json`，喺 `plugins` 區塊加入：

```jsonc
"plugins": {
  "allow": ["@icesword760/openclaw-wechat"],
  "entries": {
    "@icesword760/openclaw-wechat": {
      "enabled": true,
      "config": {
        "keywords": ["bot", "助手"],   // 觸發關鍵詞（可選）
        "replyAll": false              // true = 所有訊息都觸發
      }
    }
  }
}
```

**登入微信：**

```bash
openclaw plugins run @icesword760/openclaw-wechat login
```

Terminal 會顯示 QR code。用你嘅手機微信：

1. 打開微信 → **掃一掃**
2. 掃描 terminal 上嘅 QR code
3. 喺手機上確認登入

**重啟 OpenClaw：**

```bash
openclaw start
```

**WeChat 支援功能：** 文字、圖片、文件、關鍵詞觸發、全訊息觸發、群聊。

> **注意：**
> - WeChat 係社區 plugin，唔係 OpenClaw 內建 channel，設定方式同 Telegram/WhatsApp 唔同
> - 用嘅係微信個人帳號（唔係公眾號），有被封號風險，建議用小號
> - Plugin 詳情：https://github.com/icesword0760/openclaw-wechat

---

### Step 6：啟動 OpenClaw

```bash
# 啟動 OpenClaw（會喺背景運行）
openclaw start

# 打開終端介面（TUI）睇 agent 狀態
openclaw tui
```

啟動後你可以：
- 用 Telegram / WhatsApp / 微信 同你嘅 AI agent 對話
- 用瀏覽器打開 `http://你嘅VPS_IP:18789/` 進入 Web UI（需要輸入 `OPENCLAW_GATEWAY_TOKEN`）

**如果 bot 冇回應？**

| 檢查 | 命令 |
|------|------|
| OpenClaw 有冇行緊？ | `openclaw status` |
| 設定有冇錯？ | `openclaw config validate` |
| Bot token 啱唔啱？ | 檢查 `~/.openclaw/.env` 入面嘅 token |
| Agent 有冇 model？ | 檢查 `openclaw.json` 入面 `agents.defaults.model` |
| 睇 log | `openclaw logs --tail 50` |
| WhatsApp 斷線 | `openclaw channels login --channel whatsapp` 重新掃 QR |

---

### Step 7：用 Agent 引導進階設定（可選）

如果你已經裝好 OpenClaw 或 Claude Code，可以直接用 skill 互動引導：

```
你：幫我 setup openclaw
Agent：（自動觸發 openclaw-setup-guide skill，由環境檢查開始逐步引導）
```

---

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
| 12 | Skills 安裝 | 33 個 skill 分 10 類 | ✅ |
| 13 | OpenClaw CLI 基礎 | 常用指令教學 | ✅ |
| 14 | Windows SSH 隧道 | 從 Windows 連去 VPS | 如果用 Windows |
| 15 | 遠端 Web UI | 用瀏覽器操作 OpenClaw | 推薦 |
| 16 | 驗證與啟動 | 最終檢查 + 啟動 | ✅ |

每個模組嘅詳細內容喺 [`setup/SKILL.md`](setup/SKILL.md)。

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

## 常見問題

**Q: 我可以用自己嘅電腦（唔用 VPS）嗎？**
A: 可以，只要係 Ubuntu Linux 就得。但如果要 24 小時運行（例如 Telegram bot 隨時回覆），建議用 VPS。

**Q: 完全免費嗎？**
A: OpenClaw 本身免費。AI 模型 API 有部分免費 tier（例如 NVIDIA NIM），用完免費額度先需要付費。VPS 需要租用費。

**Q: 我唔識 Linux，可以用嗎？**
A: 呢個 Guide 已經盡量寫到 copy-paste 就用得，但基本嘅終端機操作（打指令、編輯文字檔）係需要嘅。

**Q: 設定搞到一半可以停嗎？**
A: 可以。每個步驟都係獨立嘅，你可以隨時停，下次繼續。

---

## License

MIT
