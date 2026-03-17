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

**Part 1 — 常見問題排查（Debug 手冊）**
- [常見問題排查](#常見問題排查debug-手冊)

**Part 2 — 用 OpenClaw Prompt 完成設定（唔使打指令）**
- [Prompt 設定法](#用-openclaw-prompt-完成設定)

**Part 3 — 完整安裝教學**
- [你需要準備咩](#你需要準備咩)
- [Step 1：下載 + 環境檢查](#step-1下載--環境檢查)
- [Step 2：設定 API Keys](#step-2設定-api-keys)
- [Step 3：安裝 Skills](#step-3安裝-skills)
- [Step 4：連接 Messaging 平台](#step-4連接-messaging-平台)
- [Step 5：驗證 + 測試](#step-5驗證--測試)

**Part 4 — 進階設定 + 參考**
- [設定模組（進階）](#設定模組進階)
- [Skills 分類](#skills-分類)
- [API Key 申請教學](#api-key-申請教學)
- [從 Windows 連入 VPS](#從-windows-連入-vps)
- [參考文檔](#參考文檔)

---

# Part 1 — 常見問題排查（Debug 手冊）

遇到問題先睇呢度。以下係實際運維中遇過嘅問題同解決方法。

## Agent 完全無回應

| 可能原因 | 點樣檢查 | 解決方法 |
|----------|----------|----------|
| OpenClaw 未啟動 | `openclaw status` | `openclaw start` |
| 設定檔格式錯誤 | `openclaw config validate` | 修正 JSON 語法錯誤 |
| `auth.json` 空或無效 | 檢查 `~/.openclaw/agents/<id>/agent/auth.json` | 從 `auth-profiles.json` 同步 token |
| Agent 冇指定 model | 檢查 `openclaw.json` → `agents.defaults.model` | 確保有 `primary` model |
| Bot token 錯 | 檢查 `~/.openclaw/.env` 嘅 token | 重新從 BotFather 攞 token |

> **OpenClaw prompt：** `我個 agent 冇回應，幫我 debug`

## OAuth Token 過期（Provider 認證失敗）

**症狀：** Agent 回覆 401/403 錯誤，或者直接冇回應。

**受影響 Provider：** Qwen Portal、OpenAI Codex 等用 OAuth 嘅 provider。

```bash
# 重新登入指定 provider
openclaw models auth login --provider qwen-portal
openclaw models auth login --provider openai-codex
```

> OAuth token 會定期過期（通常 2-4 週），需要手動刷新。建議設 cron job 提醒。
>
> **OpenClaw prompt：** `幫我檢查所有 provider 嘅認證狀態`

## Gateway 行緊但 CLI 命令 Hang 住

**症狀：** `openclaw` 命令打咗之後冇反應（hang 超過 30 秒）。

**原因：** Gateway 內部 RPC 通訊卡住。

```bash
# 重啟 gateway
openclaw gateway restart
```

> **OpenClaw prompt：** `gateway 好似 hang 咗，幫我重啟`

## Cron Job 冇執行 / Delivery 失敗

| 問題 | 原因 | 解決 |
|------|------|------|
| Delivery 失敗 | 用咗 `"channel": "last"` | 改為 `"channel": "telegram", "to": "你的user_id"` |
| Job 一直顯示 error | Gateway 之前出過事，狀態冇 reset | 等下次正常執行會自動清除 |
| `announce` mode 唔 deliver | 已知 bug | 暫時改用 `log` mode + 手動檢查 |
| SIGTERM 終止 | 執行時間太長被 kill | 簡化 job 內容或加大 timeout |

```bash
# 檢查 cron 健康狀態
openclaw cron status

# 手動觸發單個 job 測試
openclaw cron run --id <job_id>
```

> **OpenClaw prompt：** `幫我檢查所有 cron job 嘅狀態，有冇 failed 嘅`

## Session Context 爆滿（Token Overflow）

**症狀：** Agent 回覆越嚟越慢，或者突然中斷。

**原因：** Session token 用量超過 model 嘅 context window。

**檢查：**
```bash
# 睇 session 大小
openclaw sessions list --agent main
```

**解決：**
```bash
# Reset 指定 agent 嘅 session
openclaw sessions reset --agent main
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

> **踩過嘅坑：** `reserveTokensFloor` 設成 200000（大過 128k model context），導致 compaction 永遠唔觸發，session 膨脹到 500%+。
>
> **OpenClaw prompt：** `幫我檢查所有 agent 嘅 session token 用量`

## Gateway 版本不一致

**症狀：** Dashboard 顯示嘅版本同 `openclaw --version` 唔同。

**原因：** 同時存在全域安裝（`/usr/lib/`）同用戶級安裝（`~/.local/`）。

```bash
# 檢查邊度有安裝
which openclaw
ls /usr/lib/node_modules/openclaw/package.json
ls ~/.local/lib/node_modules/openclaw/package.json 2>/dev/null

# 如果有兩份，刪除用戶級安裝
rm -rf ~/.local/lib/node_modules/openclaw ~/.local/bin/openclaw

# 只保留全域安裝，更新用
sudo npm update -g openclaw
openclaw gateway restart
```

> **OpenClaw prompt：** `幫我檢查 openclaw 安裝路徑有冇衝突`

## openclaw.json 啟動失敗（Unknown Key）

**症狀：** `openclaw start` 報 schema validation error。

**原因：** openclaw.json 有唔啱嘅 key（OpenClaw 用 strict JSON schema validation）。

```bash
# 驗證設定
openclaw config validate

# 對照官方文檔檢查 key 名
# https://docs.openclaw.ai/gateway/configuration-reference
```

> **常見錯誤：** 打錯 key 名、用咗舊版本嘅 key、加咗 comment 但唔係 JSON5 格式。

## WhatsApp / WeChat 斷線

| 平台 | 原因 | 解決 |
|------|------|------|
| WhatsApp | 手機長時間離線 | `openclaw channels login --channel whatsapp` 重新掃 QR |
| WeChat | Session 過期 / 被踢 | `openclaw plugins run @icesword760/openclaw-wechat login` 重新掃碼 |

## Plugin 代碼改完冇生效

**原因：** jiti 緩存咗舊嘅 TypeScript 編譯結果。

```bash
# 清 jiti 緩存（改完 .ts 檔案後必做）
rm -rf /tmp/jiti/

# 然後重啟
openclaw gateway restart
```

> **注意：** 只改 config 唔使清 cache，只有改 `.ts` 源碼先要。

## API Key 明文洩漏

**症狀：** Key 直接寫喺 `models.json` 或 `openclaw.json`。

**解決：** 所有 key 統一放 `~/.openclaw/.env`，設定檔用 `${ENV_VAR}` 引用。

```bash
# 檢查有冇明文 key
grep -r "nvapi-\|jina_\|sk-\|bot[0-9]" ~/.openclaw/agents/*/agent/models.json

# 替換為環境變數引用
# "apiKey": "nvapi-xxx"  →  "apiKey": "${NVIDIA_INTEGRATE_API_KEY}"

# 設嚴權限
chmod 600 ~/.openclaw/.env
```

> **OpenClaw prompt：** `幫我掃描所有設定檔有冇明文 API key`

---

# Part 2 — 用 OpenClaw Prompt 完成設定

**唔識打指令？冇問題。** 裝好 OpenClaw 之後，你可以直接喺對話框（Telegram / WebChat / CLI）用以下 prompt 叫 agent 幫你完成設定。

> **前提：** 你需要先完成 [Part 3 Step 1](#step-1下載--環境檢查) 嘅基礎安裝（Node.js + OpenClaw + onboard）。之後嘅所有設定都可以用 prompt 完成。

### 初始設定

```
幫我 setup openclaw，由環境檢查開始
```
> Agent 會自動觸發 `openclaw-setup-guide` skill，逐步引導你完成所有設定。

### API Key 設定

```
幫我設定 API keys。我有 NVIDIA 同 Telegram 嘅 key，幫我加入 .env
```

```
幫我加一個新嘅 model provider，用 NVIDIA NIM，API key 係 nvapi-xxx
```

### Agent 管理

```
幫我建一個新 agent，叫「助手」，用 NVIDIA 嘅 minimax model
```

```
幫我睇下而家有邊啲 agent，每個用咩 model
```

```
幫我將 GPT agent 嘅 model 改做 gpt-5.4，fallback 用 minimax
```

### Telegram 設定

```
幫我設定 Telegram bot，我個 bot token 係 123456789:ABCdef...
```

```
幫我建一個 Telegram group 綁定，將 gpt agent 綁去 group ID -5278907100
```

```
幫我設定 Telegram 安全，只有我（user ID 1318441952）可以觸發 agent
```

### WhatsApp 設定

```
幫我啟用 WhatsApp channel，然後登入
```

```
幫我綁定一個 WhatsApp group 去 claude agent
```

### WeChat 設定

```
幫我安裝 WeChat plugin 同設定微信連接
```

### Cron Job 管理

```
幫我設一個 cron job，每日凌晨 1 點用 main agent 做研究
```

```
幫我檢查所有 cron job 嘅狀態
```

```
幫我修復 delivery 失敗嘅 cron job
```

### Memory Plugin

```
幫我安裝 memory-lancedb-pro plugin，用 Jina 做 embedding
```

```
幫我檢查 memory 系統有冇正常運作
```

### 診斷同修復

```
openclaw config validate 有 error，幫我修
```

```
幫我檢查所有 provider 嘅連線狀態
```

```
幫我掃描設定檔有冇安全問題（明文 key、權限太鬆等）
```

### Skills 管理

```
幫我安裝所有 skills
```

```
幫我睇下裝咗邊啲 skill，有冇缺嘅
```

```
幫我搵一個可以做 web search 嘅 skill
```

> **Tips：**
> - 你可以用任何語言同 agent 講（廣東話、普通話、英文都得）
> - Agent 會自動讀取相關 skill 嘅指引嚟幫你
> - 如果 agent 做錯咗，直接話佢「唔係，我要嘅係 XXX」就得
> - 複雜設定可以叫 agent 先 validate 再 apply：「幫我改，但改之前先 validate」

---

# Part 3 — 完整安裝教學

一步步教你喺 Ubuntu 上安裝 OpenClaw。

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

### Step 1：下載 + 環境檢查

用 SSH 連入你嘅 Ubuntu 伺服器：

```bash
# 下載呢個 repo
git clone https://github.com/radmanyeung/ford-openclaw-share.git
cd ford-openclaw-share

# 檢查環境
bash setup/env-check.sh
```

腳本會逐項檢查 Node.js、npm、OpenClaw，顯示 ✅/⚠️/❌ 同修正指令。

**裝 Node.js（如果未裝）：**

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version    # v20.x.x 或更高
```

**裝 OpenClaw + 初始化：**

```bash
sudo npm install -g openclaw
openclaw --version    # 2026.3.13 或更高
openclaw onboard      # 互動式初始設定
```

`openclaw onboard` 會建立 `~/.openclaw/` 目錄同基礎設定。

> 日後更新：`sudo npm update -g openclaw`
>
> **或者用 OpenClaw prompt：** `幫我檢查環境同安裝缺少嘅組件`

---

### Step 2：設定 API Keys

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

### Step 3：安裝 Skills

Skills 就好似 App 咁，每個 skill 教識 agent 做一樣嘢。

**方法 A — 用腳本：**

```bash
bash setup/install-skills.sh --all      # 安裝全部 34 個
bash setup/install-skills.sh --check    # 檢查安裝結果
```

**方法 B — 用 OpenClaw prompt：**

```
幫我安裝所有 skills
```

---

### Step 4：連接 Messaging 平台

#### 4a. 連接 Telegram

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

#### 4b. 連接 WhatsApp

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

#### 4c. 連接 WeChat（微信）

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

### Step 5：驗證 + 測試

```bash
# 驗證設定
openclaw config validate

# 啟動
openclaw start

# 睇狀態
openclaw status

# TUI 介面
openclaw tui
```

**測試方法：**

| 方法 | 點做 |
|------|------|
| Telegram | DM 你嘅 bot，send 任何訊息 |
| WhatsApp | DM 已連接嘅號碼 |
| 微信 | Send 觸發關鍵詞（如「bot」） |
| WebChat | 瀏覽器打開 `http://localhost:18789/`，用 Gateway token 登入 |
| CLI | `openclaw chat` |

**或者用 OpenClaw prompt：**

```
幫我驗證所有設定，檢查有冇問題
```

---

# Part 4 — 進階設定 + 參考

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

## 常見問題

**Q: 我可以用自己嘅電腦（唔用 VPS）嗎？**
A: 可以，只要係 Ubuntu Linux 就得。但如果要 24 小時運行（例如 Telegram bot 隨時回覆），建議用 VPS。

**Q: 完全免費嗎？**
A: OpenClaw 本身免費。AI 模型 API 有部分免費 tier（例如 NVIDIA NIM），用完免費額度先需要付費。VPS 需要租用費。

**Q: 我唔識 Linux，可以用嗎？**
A: 基礎安裝需要 copy-paste 幾條指令。裝好之後，大部分設定可以透過 OpenClaw prompt 完成（見 [Part 2](#用-openclaw-prompt-完成設定)），唔使再打指令。

**Q: 設定搞到一半可以停嗎？**
A: 可以。每個步驟都係獨立嘅，你可以隨時停，下次繼續。

---

## License

MIT
