---
name: openclaw-setup-guide
description: Interactive guide to set up OpenClaw multi-agent system from scratch on Ubuntu. Checks current environment against reference setup, installs missing dependencies, and guides through each configuration module step by step. Use when someone asks to install OpenClaw, set up agents, configure Telegram, or replicate an OpenClaw deployment. Triggers on "setup openclaw", "install openclaw", "配置 openclaw", "重建 openclaw", "openclaw 教學".
tools: [Bash, Read, Edit, Write, Glob, Grep]
---

# OpenClaw Setup Guide

你係一個 OpenClaw 設定助手。你嘅工作係幫用戶喺一台新嘅 Ubuntu 機器上，由零開始設定 OpenClaw 多 agent 系統。

## 重要原則

1. **先檢查，後動手** — 每個步驟開始前，檢查環境現狀
2. **差異對比** — 顯示「參考設定」vs「你嘅環境」，等用戶知道差喺邊
3. **逐步確認** — 每個動作都要用戶批准先做
4. **缺乜裝乜** — 自動偵測缺少嘅依賴並提議安裝
5. **用繁體中文溝通**，config/code 保持英文

---

## 第一步：環境檢查（必做）

觸發 skill 後，**首先執行環境檢查腳本** `~/.claude/skills/openclaw-setup-guide/env-check.sh`：

```bash
bash ~/.claude/skills/openclaw-setup-guide/env-check.sh
```

腳本會輸出一份 JSON 報告。讀取報告後，向用戶展示以下格式嘅對比表：

```
╔══════════════════════════════════════════════════════════╗
║              OpenClaw 環境檢查報告                       ║
╠════════════════════╦═══════════╦═══════════╦════════════╣
║ 項目               ║ 參考環境   ║ 你嘅環境   ║ 狀態      ║
╠════════════════════╬═══════════╬═══════════╬════════════╣
║ OS                 ║ Ubuntu 24 ║ ???       ║ ✅/⚠️/❌   ║
║ Node.js            ║ ≥20.x     ║ ???       ║            ║
║ npm                ║ ≥10.x     ║ ???       ║            ║
║ OpenClaw           ║ 2026.3.13 ║ ???       ║            ║
║ ~/.openclaw/       ║ 需要      ║ ???       ║            ║
║ ~/.openclaw/.env   ║ 需要      ║ ???       ║            ║
║ openclaw.json      ║ 需要      ║ ???       ║            ║
║ Telegram plugin    ║ 可選      ║ ???       ║            ║
║ memory-lancedb-pro ║ 可選      ║ ???       ║            ║
╠════════════════════╩═══════════╩═══════════╩════════════╣
║ ✅ = 已就緒  ⚠️ = 版本不同但可用  ❌ = 缺少/需安裝       ║
╚══════════════════════════════════════════════════════════╝
```

然後根據結果，列出需要做嘅事：

```
需要安裝/設定：
  ❌ Node.js — 需要安裝 v20+
  ❌ OpenClaw — 需要 npm install -g
  ❌ .env — 需要建立並填入 API keys

已就緒（可跳過）：
  ✅ OS — Ubuntu 24.04
  ✅ npm — v10.9.4
```

**問用戶：「要我幫你自動安裝缺少嘅依賴嗎？(y/n)」**

- 如果 y → 自動安裝缺少嘅基礎依賴（Node.js, OpenClaw）
- 如果 n → 只列出指令等用戶自己做

---

## 第二步：顯示模組選單

基礎依賴就緒後，顯示設定模組選單：

```
OpenClaw 設定模組 — 揀你要設定嘅（輸入數字，如 "1,2,3" 或 "all"）：

基礎設定：
 1. 環境變數 (.env)         — API keys 集中管理
 2. Model Providers         — 設定 AI 模型來源（NVIDIA/Qwen/Jina）
 3. Agents                  — 建立 AI agents（角色、模型、權限）
 4. 工具權限與 Hooks         — tool profiles + 內建 hooks

通訊：
 5. Telegram 整合           — Bot 建立 + channel 啟用
 6. Group 綁定              — Agent ↔ Telegram group 對應
 7. Telegram 安全           — 存取控制 + 公開 agent 加固

進階：
 8. Compaction              — 上下文壓縮（長對話自動摘要）
 9. Memory Plugin           — memory-lancedb-pro 長期記憶
10. Cron Jobs               — 定時任務排程
11. Gateway                 — 網關設定（port/auth/安全）

Skills：
12. Skills 安裝             — 32 個 skill 分 10 類，揀需要嘅裝

使用教學：
13. OpenClaw CLI 基礎       — onboard / start / tui 常用指令
14. Windows SSH 隧道        — 建立 .ps1 腳本連接 VPS
15. 遠端 Web UI 存取        — 透過 SSH tunnel 用瀏覽器操作

最後：
16. 驗證與啟動              — 設定檢查 + 啟動 OpenClaw
```

---

## 模組執行流程

對每個模組，按以下流程執行：

### 1. 檢查現狀
用 bash 檢查該模組相關嘅當前狀態。例如：
- Module 1：檢查 `~/.openclaw/.env` 是否存在、有幾多個 key
- Module 2：檢查 `openclaw.json` 入面有幾多個 provider
- Module 3：檢查已有幾多個 agent
- Module 5：檢查 TELEGRAM_BOT_TOKEN 是否已設

### 2. 解釋用途
用簡單易明嘅語言解釋呢個模組做咩、點解需要。

### 3. 展示參考設定
展示完整嘅 config 片段，附上每個欄位嘅中文註解。

### 4. 互動問答
問用戶需要邊啲選項。例如：
- Module 2：「你有邊啲 API key？(nvidia/jina/qwen)」
- Module 3：「你想建幾多個 agent？每個嘅角色係咩？」
- Module 7：「邊個 group 要限制存取？」

### 5. 生成設定
根據用戶回答，生成度身定做嘅 config。

### 6. 確認並寫入
展示最終 config，確認後先寫入。

---

## 模組詳細參考

### Module 1: 環境變數 (.env)

**用途：** 集中管理所有 API key，config 入面用 `${VAR_NAME}` 引用。

**檢查：**
```bash
# 檢查 .env 是否存在
test -f ~/.openclaw/.env && echo "EXISTS" || echo "MISSING"
# 列出已設嘅 key（唔顯示值）
grep -oP '^[A-Z_]+(?==)' ~/.openclaw/.env 2>/dev/null
```

**必要 keys：**
| Key | 用途 | 取得方式 |
|-----|------|----------|
| `OPENCLAW_GATEWAY_TOKEN` | Gateway 認證密碼 | 自訂任意字串 |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot | @BotFather → `/newbot` |

**模型 Provider keys（揀需要嘅）：**
| Key | Provider | 取得方式 |
|-----|----------|----------|
| `NVIDIA_INTEGRATE_API_KEY` | NVIDIA NIM (免費) | https://build.nvidia.com |
| `NVIDIA_DEEPSEEK_AI_API_KEY` | DeepSeek via NVIDIA | 同上 |
| `NVIDIA_QWEN_API_KEY` | Qwen via NVIDIA | 同上 |
| `NVIDIA_Z_AI_API_KEY` | GLM via NVIDIA | 同上 |
| `JINA_API_KEY` | Jina (memory plugin) | https://jina.ai |

**可選 keys：**
| Key | 用途 |
|-----|------|
| `TAVILY_API_KEY` | Web search |

寫入後執行：`chmod 600 ~/.openclaw/.env`

---

### Module 2: Model Providers

**用途：** 定義 AI 模型來源。OpenClaw 支援任何 OpenAI-compatible API。

**檢查：**
```bash
# 列出已設定嘅 providers
python3 -c "
import json
with open('$HOME/.openclaw/openclaw.json') as f:
    cfg = json.load(f)
providers = cfg.get('models',{}).get('providers',{})
for name, p in providers.items():
    models = [m['id'] for m in p.get('models',[])]
    print(f'  {name}: {models}')
" 2>/dev/null || echo "未設定"
```

**Provider 模板：**

問用戶：「你有邊啲 provider 嘅 API key？」然後只加對應嘅：

**NVIDIA NIM（免費，推薦）：** 每個 NVIDIA model 用獨立 provider + key 避免 rate limit。
```jsonc
"nvidia-integrate": {
  "baseUrl": "https://integrate.api.nvidia.com/v1",
  "apiKey": "${NVIDIA_INTEGRATE_API_KEY}",    // .env 入面嘅 key 名
  "api": "openai-completions",                 // OpenAI-compatible 格式
  "models": [{
    "id": "minimaxai/minimax-m2.1",            // NVIDIA catalog 入面嘅 model ID
    "name": "MiniMax M2.1",                    // 顯示名
    "reasoning": false,
    "input": ["text"],                         // 支援嘅輸入類型
    "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },  // 免費
    "contextWindow": 128000,                   // 上下文長度
    "maxTokens": 8192                          // 最大輸出 tokens
  }]
}
```

**Jina（Embedding，memory plugin 用）：**
```jsonc
"jina": {
  "baseUrl": "https://api.jina.ai/v1",
  "apiKey": "${JINA_API_KEY}",
  "api": "openai-completions",
  "models": [{ "id": "jina-embeddings-v2-base-zh", "name": "Jina Embeddings v2 Base ZH", "input": ["text"], "contextWindow": 8192, "maxTokens": 8192 }]
}
```

**Qwen Portal（OAuth 認證）：**
```jsonc
"qwen-portal": {
  "baseUrl": "https://portal.qwen.ai/v1",
  "apiKey": "qwen-oauth",               // 固定值，用 OAuth 認證
  "api": "openai-completions",
  "models": [
    { "id": "coder-model", "name": "Qwen Coder", "input": ["text"], "contextWindow": 128000, "maxTokens": 8192 },
    { "id": "vision-model", "name": "Qwen Vision", "input": ["text","image"], "contextWindow": 128000, "maxTokens": 8192 }
  ]
}
```

> Qwen Portal 需要額外設 auth profile + 定期執行 `openclaw models auth login --provider qwen-portal`

設完 providers 後，記得喺 `agents.defaults.models` 註冊所有 model（格式 `"provider/model-id": {}`）。

---

### Module 3: Agents

**用途：** 每個 agent 係一個獨立嘅 AI 角色，有自己嘅模型、身份、權限。

**概念解釋（向用戶說明）：**
- `main` 係內建 agent，唔使定義但可以 override
- 每個 agent 可以綁定一個 Telegram group
- `tools.profile` 控制 agent 能做咩：
  - `"coding"` = 完整能力（讀寫檔案、執行指令、上網）
  - `"messaging"` = 只有對話（安全，適合公開 agent）
- `subagents.allowAgents` = 呢個 agent 可以 call 邊啲其他 agent

**檢查：**
```bash
python3 -c "
import json
with open('$HOME/.openclaw/openclaw.json') as f:
    cfg = json.load(f)
agents = cfg.get('agents',{}).get('list',[])
print(f'已有 {len(agents)} 個 agent:')
for a in agents:
    mid = a.get('model',{}).get('primary','?')
    name = a.get('identity',{}).get('name','?')
    print(f'  {a[\"id\"]:12s} {name:15s} model={mid}')
" 2>/dev/null || echo "未設定"
```

**問用戶：**
1. 「你想建幾多個 agent？」
2. 「每個 agent 嘅角色係咩？（例如：coding助手、聊天bot、翻譯員）」
3. 「邊個 agent 要完整工具權限？邊個只需要對話？」

**Agent defaults：**
```jsonc
"agents": {
  "defaults": {
    "model": {
      "primary": "USER_CHOSEN_MODEL",       // 用戶揀嘅預設模型
      "fallbacks": ["FALLBACK_MODEL"]        // Primary 唔得時用嘅後備
    },
    "workspace": "/home/USER/.openclaw/workspace",
    "contextTokens": 200000,                  // 最大 context 長度
    "maxConcurrent": 4,                       // 同時處理幾多個對話
    "subagents": { "maxConcurrent": 8 }       // 同時幾多個 subagent
  }
}
```

**Agent 定義範例：**
```jsonc
{
  "id": "agent-id",                          // 唯一 ID（英文小寫）
  "model": {
    "primary": "provider/model-id",          // 主要模型
    "fallbacks": ["provider/fallback-id"]    // 後備模型（可空）
  },
  "identity": {
    "name": "顯示名稱 🎯",                   // Telegram 顯示名
    "emoji": "🎯"                             // 頭像 emoji
  },
  "tools": { "profile": "coding" },          // 或 "messaging"
  "subagents": {
    "allowAgents": ["main", "agent-id"]      // 可 call 嘅 agent 列表
  }
}
```

**建立 agent 目錄：**
```bash
mkdir -p ~/.openclaw/agents/AGENT_ID/agent
mkdir -p ~/.openclaw/agents/AGENT_ID/sessions
```

每個 agent 需要 `agents/AGENT_ID/agent/models.json`（格式同 `models.providers`）。

⚠️ `auth.json` 如果係空檔，agent 會完全無回應。

---

### Module 4: 工具權限與 Hooks

**Hooks — 內建自動行為：**
```jsonc
"hooks": {
  "internal": {
    "enabled": true,
    "entries": {
      "boot-md": { "enabled": true },              // 啟動時讀 BOOT.md 指令
      "command-logger": { "enabled": true },        // 記錄所有指令
      "session-memory": { "enabled": true },        // 對話記憶
      "bootstrap-extra-files": { "enabled": true }  // 啟動時載入額外檔案
    }
  }
}
```

**工具權限：**
```jsonc
"tools": {
  "profile": "coding",                // 全局預設 tool profile
  "web": {
    "search": { "provider": "gemini" } // Web search 用邊個 provider
  },
  "agentToAgent": {
    "enabled": true,                   // 允許 agent 之間互相 call
    "allow": ["main", "gpt", "claude"] // 邊啲 agent 可以被 call
  }
}
```

如果啟用咗 memory plugin，加入 memory tools：
```jsonc
"tools": {
  "allow": [
    "memory_recall", "memory_store", "memory_forget",
    "memory_update", "memory_stats", "memory_list",
    "self_improvement_log"
  ]
}
```

---

### Module 5: Telegram 整合

**步驟：**
1. 喺 Telegram 搵 @BotFather → `/newbot` → 拎 token
2. Token 放入 `.env` 嘅 `TELEGRAM_BOT_TOKEN`
3. 搵 @userinfobot 攞你嘅 User ID

**設定：**
```jsonc
"channels": {
  "telegram": {
    "enabled": true,
    "dmPolicy": "pairing",       // DM 需要先配對裝置
    "groupPolicy": "open",       // Group 預設開放
    "streaming": "partial"       // 即時顯示打字
  }
},
"plugins": {
  "allow": ["telegram"],
  "entries": { "telegram": { "enabled": true } }
}
```

---

### Module 6: Group 綁定

**步驟：**
1. 將 bot 加入 Telegram group
2. 喺 group 發送任意訊息
3. 用 `https://api.telegram.org/bot<TOKEN>/getUpdates` 搵 group ID（負數）

**設定：**
```jsonc
"bindings": [
  {
    "agentId": "你的agent_id",
    "match": {
      "channel": "telegram",
      "peer": { "kind": "group", "id": "-GROUP_ID" }
    }
  }
]
```

---

### Module 7: Telegram 安全

**概念：** `groupPolicy` 係全局設定。要做 per-group 控制：
- 設 `groupPolicy: "open"`
- 喺個別 group 加 `allowFrom: [userId]`
- 冇 `allowFrom` = 任何人可觸發

```jsonc
"channels": {
  "telegram": {
    "groupPolicy": "open",
    "groupAllowFrom": [YOUR_USER_ID],
    "groups": {
      "-PRIVATE_GROUP": { "requireMention": false, "allowFrom": [YOUR_USER_ID] },
      "-PUBLIC_GROUP": { "requireMention": false }
    }
  }
}
```

公開 agent 安全加固：
- `tools.profile: "messaging"` — 限制工具
- `subagents.allowAgents: ["self"]` — 唔可以 call 其他 agent
- 即使 prompt injection 都只能令 agent 講錯嘢，唔能做危險操作

---

### Module 8: Compaction

**用途：** 對話太長時自動壓縮上下文，避免超出 model context window。

**注意：** 只支援 `agents.defaults`，唔支援 per-agent 設定。

```jsonc
"agents": {
  "defaults": {
    "compaction": {
      "mode": "safeguard",           // 接近上限時壓縮
      "reserveTokens": 38400,        // 保留空間（建議 context × 30%）
      "reserveTokensFloor": 20000,   // 最低保留量
      "postIndexSync": "async"       // 異步同步，唔阻塞對話
    }
  }
}
```

觸發點 = `min(contextTokens, model.context) - reserveTokens`

---

### Module 9: Memory Plugin

**用途：** 長期記憶系統，agent 可以記住同回憶過去嘅對話同知識。需要 `JINA_API_KEY`。

**安裝：**
```bash
openclaw plugin install memory-lancedb-pro
```

**設定：** 加入 `plugins` 區塊：
```jsonc
"plugins": {
  "allow": ["memory-lancedb-pro"],
  "slots": { "memory": "memory-lancedb-pro" },
  "entries": {
    "memory-lancedb-pro": {
      "enabled": true,
      "config": {
        "embedding": {
          "apiKey": "${JINA_API_KEY}",
          "model": "jina-embeddings-v5-text-small",
          "baseURL": "https://api.jina.ai/v1",
          "dimensions": 1024,
          "normalized": true
        },
        "dbPath": "/home/USER/.openclaw/data/memory-lancedb-pro",
        "autoCapture": true,          // 自動記住重要內容
        "autoRecall": true,           // 自動回憶相關記憶
        "smartExtraction": true,      // 用 LLM 提取重點
        "retrieval": {
          "mode": "hybrid",           // 向量 + BM25 混合搜尋
          "vectorWeight": 0.7,
          "bm25Weight": 0.3,
          "minScore": 0.6,
          "rerank": "cross-encoder",  // Jina reranker 重排
          "rerankProvider": "jina",
          "rerankModel": "jina-reranker-v3",
          "rerankEndpoint": "https://api.jina.ai/v1/rerank",
          "rerankApiKey": "${JINA_API_KEY}",
          "candidatePoolSize": 12
        },
        "llm": {                      // Smart Extraction 用嘅 LLM
          "apiKey": "${NVIDIA_INTEGRATE_API_KEY}",
          "model": "minimaxai/minimax-m2.1",
          "baseURL": "https://integrate.api.nvidia.com/v1"
        },
        "enableManagementTools": true,
        "scopes": { "default": "global" }
      }
    }
  }
}
```

---

### Module 10: Cron Jobs

**用途：** 定時任務，例如每日研究、記憶清理、安全掃描。

**用 CLI 建立：**
```bash
openclaw cron add \
  --name "任務名稱" \
  --agent main \
  --expr "CRON_EXPRESSION" \
  --tz "Asia/Hong_Kong" \
  --message "agent 收到嘅指令"
```

**常用模板：**
| 名稱 | Cron | 用途 |
|------|------|------|
| Daily Research | `0 1 * * *` | 每日凌晨 1 點研究 |
| Memory Cleanup | `5 2 * * *` | 凌晨 2:05 清理記憶 |
| Security Scan | `0 3 * * *` | 凌晨 3 點掃描 |
| Weekly Review | `0 4 * * 0` | 每週日凌晨回顧 |
| Health Check | `0 * * * *` | 每小時健康檢查 |

**Delivery 設定：**
```jsonc
"delivery": {
  "mode": "announce",         // 結果傳送
  "channel": "telegram",      // ⚠️ 一定要寫 "telegram"，唔好用 "last"
  "to": "YOUR_USER_ID"
}
```

⚠️ 已知 bug：`"channel": "last"` 會導致 delivery 失敗，一定要用明確嘅 `"channel": "telegram"`。

---

### Module 11: Gateway

**用途：** HTTP 網關，處理 Telegram webhook 同裝置配對。

```jsonc
"gateway": {
  "port": 18789,                              // 監聽端口
  "mode": "local",                            // local = 單機
  "bind": "loopback",                         // 只聽 127.0.0.1
  "auth": {
    "mode": "token",
    "token": "${OPENCLAW_GATEWAY_TOKEN}"      // .env 入面嘅密碼
  },
  "tailscale": { "mode": "off" },
  "nodes": {
    "denyCommands": [                         // 禁止嘅危險指令
      "camera.snap", "camera.clip", "screen.record",
      "calendar.add", "contacts.add", "reminders.add"
    ]
  }
}
```

⚠️ Gateway 設定改完需要重啟 OpenClaw（唔會 hot-apply）。

---

### Module 12: Skills 安裝

**用途：** 安裝 32 個預建 skill，擴展 agent 能力。Skills 分 10 個分類，用戶可以揀需要嘅裝。

**概念解釋：**
- Skill = agent 嘅專業能力模組（如 web search、記憶管理、報告生成）
- 裝咗嘅 skill，agent 會自動根據對話內容觸發使用
- 每個 skill 有 SKILL.md 定義同可選嘅 scripts/references

**檢查已安裝：**
```bash
bash ~/.claude/skills/openclaw-setup-guide/install-skills.sh --check
```

**分類清單：**

讀取 `~/.claude/skills/openclaw-setup-guide/skills-manifest.json` 展示分類。向用戶呈現：

| 分類 | 數量 | 說明 | 需要嘅 Key |
|------|------|------|------------|
| **core** — 核心管理 | 6 | OpenClaw 設定、gateway、provider 檢查 | — |
| **memory** — 記憶系統 | 3 | LanceDB 長期記憶、清理、context 管理 | JINA_API_KEY |
| **monitoring** — 監控報告 | 4 | Cron 監控、日報週報、研究追蹤、log 復原 | — |
| **skills-mgmt** — Skill 管理 | 6 | Skill 搜尋、審計、版本、依賴追蹤 | — |
| **workflow** — 工作流程 | 3 | 任務編排、事件驅動、模板庫 | — |
| **research** — 研究搜尋 | 3 | Tavily web search、深度研究、情報收集 | TAVILY_API_KEY |
| **data** — 資料驗證 | 2 | JSON/YAML 驗證同自動修復 | — |
| **integration** — 整合工具 | 2 | API 聚合器、自動報告管線 | — |
| **learning** — 學習進化 | 2 | 自我學習、YouTube 影片學習 | — |
| **utility** — 實用工具 | 1 | 天氣查詢（免 key） | — |

**問用戶：**
1. 「你想裝全部 32 個 skill，定係揀分類？」
2. 如果揀分類：「你想裝邊啲？(core, memory, monitoring, ...)」
3. 提醒：memory 分類需要 JINA_API_KEY，research 需要 TAVILY_API_KEY

**安裝方式：**

如果有 skills bundle（由 `package-skills.sh` 打包）：
```bash
# 安裝全部
bash setup/install-skills.sh --all

# 安裝指定分類
bash setup/install-skills.sh --category core,monitoring,data

# 互動選擇
bash setup/install-skills.sh --pick
```

如果喺本機有 skill 檔案（`~/.openclaw/workspace/skills/` 或 `~/.claude/skills/`），直接執行：
```bash
bash ~/.claude/skills/openclaw-setup-guide/install-skills.sh --check
```

**打包分發（喺源機器做）：**
```bash
bash ~/.claude/skills/openclaw-setup-guide/package-skills.sh
# 輸出 ~/openclaw-skills-bundle.tar.gz
# scp 去新機器後解壓使用
```

**安裝完後：**
- 執行 `skill-sync.sh`（如果有）同步 Claude Code ↔ OpenClaw
- 重啟 OpenClaw：`openclaw restart`

---

### Module 13: OpenClaw CLI 基礎教學

**用途：** 認識 OpenClaw 嘅常用 CLI 指令，等你識得操作同管理。

**初始設定：**
```bash
openclaw onboard
```
第一次安裝後必須跑。佢會：
- 建立 `~/.openclaw/` 目錄結構
- 引導你設定基本 config（openclaw.json）
- 設定第一個 channel（如 Telegram）

**啟動 / 停止：**
```bash
openclaw start           # 啟動 OpenClaw（背景運行）
openclaw stop            # 停止
openclaw restart         # 重啟（改完 gateway 設定後必須）
openclaw status          # 睇運行狀態
```

**TUI（終端介面）：**
```bash
openclaw tui
```
打開互動式終端介面，可以：
- 即時同 agent 對話
- 切換唔同 agent
- 睇 session 歷史
- 監控 agent 狀態

TUI 快捷鍵：
| 按鍵 | 功能 |
|------|------|
| `Tab` | 切換 agent |
| `Ctrl+C` | 退出 TUI |
| `/` | 輸入指令 |

**設定管理：**
```bash
openclaw config validate          # 驗證 openclaw.json 格式
openclaw config edit              # 編輯設定（會自動 hot-apply）
```

**Model 管理：**
```bash
openclaw models list              # 列出所有已設定嘅 model
openclaw models auth login --provider qwen-portal   # OAuth 登入
```

**Cron 管理：**
```bash
openclaw cron list                # 列出所有定時任務
openclaw cron add --name "xxx" --agent main --expr "0 1 * * *" --message "..."
openclaw cron enable <job-id>     # 啟用
openclaw cron disable <job-id>    # 停用
```

**Plugin 管理：**
```bash
openclaw plugin list              # 列出已安裝 plugin
openclaw plugin install memory-lancedb-pro   # 安裝 plugin
```

**裝置配對：**
```bash
openclaw pair                     # 產生配對碼，俾手機/電腦 app 掃描
```

**Log 查看：**
```bash
openclaw logs                     # 睇即時 log
openclaw logs --tail 50           # 睇最後 50 行
```

---

### Module 14: Windows SSH 隧道

**用途：** 如果 OpenClaw 跑喺遠端 VPS（例如 Oracle Cloud），你需要建立 SSH tunnel 先可以喺本地電腦存取 Web UI。

**概念解釋（向用戶說明）：**
- OpenClaw Gateway 預設只聽 `127.0.0.1:18789`（loopback），外部無法直接存取
- SSH tunnel 將本地電腦嘅 port 轉發去 VPS 嘅 port
- 咁你就可以喺本地瀏覽器開 `http://127.0.0.1:18789/` 存取 OpenClaw

**問用戶攞以下資料：**
1. VPS IP 地址
2. SSH 用戶名（通常 `ubuntu`）
3. SSH key 路徑（Windows 通常 `C:\Users\你的用戶名\.ssh\id_ed25519` 或自訂名）
4. OpenClaw Gateway port（預設 `18789`）

**幫用戶建立 PowerShell 腳本（.ps1）：**

根據用戶提供嘅資料，生成一個 `.ps1` 檔案：

```powershell
# openclaw-tunnel.ps1
# OpenClaw SSH Tunnel — 連接到遠端 VPS
# 用法：右鍵 → 用 PowerShell 執行，或喺終端機輸入 .\openclaw-tunnel.ps1

# === 設定（改成你嘅資料）===
$VPS_IP = "YOUR_VPS_IP"                              # VPS IP 地址
$VPS_USER = "ubuntu"                                  # SSH 用戶名
$SSH_KEY = "$env:USERPROFILE\.ssh\YOUR_KEY_NAME"      # SSH key 路徑
$LOCAL_PORT = 18789                                    # 本地 port
$REMOTE_PORT = 18789                                   # VPS 上嘅 OpenClaw port

# === 連接 ===
Write-Host "Connecting to OpenClaw on $VPS_IP..." -ForegroundColor Cyan
Write-Host "Local:  http://127.0.0.1:$LOCAL_PORT/" -ForegroundColor Green
Write-Host "Press Ctrl+C to disconnect" -ForegroundColor Yellow
Write-Host ""

ssh -N -L "${LOCAL_PORT}:127.0.0.1:${REMOTE_PORT}" -i $SSH_KEY "${VPS_USER}@${VPS_IP}"
```

**指導用戶儲存同執行：**

1. 用記事本或 VS Code 建立檔案，貼上面嘅內容
2. 儲存為 `openclaw-tunnel.ps1`（建議放喺桌面或常用位置）
3. 修改入面嘅 `$VPS_IP`、`$SSH_KEY` 等變數
4. 執行方式：
   - 右鍵 `.ps1` 檔案 → 「用 PowerShell 執行」
   - 或者打開 PowerShell 終端機，輸入 `.\openclaw-tunnel.ps1`

**如果 PowerShell 唔俾執行 .ps1：**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**進階：開機自動連接**

如果用戶想開機自動建立 tunnel，可以：
1. 按 `Win+R`，輸入 `shell:startup`
2. 建立一個 `openclaw-tunnel.vbs`：
```vbs
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell -WindowStyle Hidden -File ""C:\Users\你的用戶名\openclaw-tunnel.ps1""", 0, False
```

---

### Module 15: 遠端 Web UI 存取

**用途：** 透過 SSH tunnel 喺瀏覽器操作 OpenClaw。

**前提：** Module 14 嘅 SSH tunnel 已經連接。

**步驟 1：打開瀏覽器**

SSH tunnel 連接後，喺本地電腦嘅瀏覽器打開：
```
http://127.0.0.1:18789/
```

**步驟 2：輸入 Token**

頁面會要求輸入 Gateway Token。呢個 token 就係 `.env` 入面嘅 `OPENCLAW_GATEWAY_TOKEN`。

喺 VPS 上查看：
```bash
grep OPENCLAW_GATEWAY_TOKEN ~/.openclaw/.env | cut -d= -f2
```

**步驟 3：開始使用**

登入後你可以：
- 同任何 agent 對話
- 睇所有 session 歷史
- 管理 cron jobs
- 監控系統狀態
- 配對裝置（手機 app）

**排查連線問題：**

| 問題 | 原因 | 解決 |
|------|------|------|
| 瀏覽器打唔開 | SSH tunnel 未連接 | 確認 PowerShell 視窗仲開住 |
| Connection refused | OpenClaw 未啟動 | 喺 VPS 跑 `openclaw start` |
| 401 Unauthorized | Token 錯 | 檢查 `.env` 入面嘅 `OPENCLAW_GATEWAY_TOKEN` |
| Port already in use | 本地 18789 被佔用 | 改 .ps1 嘅 `$LOCAL_PORT` 做其他 port |
| SSH key denied | Key 唔啱 | 確認 `.ssh/` 入面嘅 key 名同 VPS authorized_keys 匹配 |

**安全提醒：**
- Gateway 設定 `"bind": "loopback"` 確保只有 SSH tunnel 可以存取
- 唔好將 `bind` 改成 `0.0.0.0`，否則任何人都可以存取
- Token 要設得夠強，建議 20+ 字元隨機字串

---

### Module 16: 驗證與啟動

**驗證：**
```bash
openclaw config validate
```

**啟動：**
```bash
openclaw start
```

**常見問題排查：**
| 問題 | 原因 | 解決 |
|------|------|------|
| Agent 完全無回應 | `auth.json` 空/無效 | 重新同步 auth token |
| Unknown key 啟動失敗 | openclaw.json 有非法 key | 對照 docs.openclaw.ai 檢查 |
| OAuth token 過期 | 需定期刷新 | `openclaw models auth login --provider xxx` |
| Cron delivery 失敗 | 用咗 `"channel": "last"` | 改為 `"channel": "telegram"` |
| Plugin 載入失敗 | 未安裝或路徑錯 | `openclaw plugin install xxx` |

**參考文檔：**

OpenClaw 官方：
- 文檔首頁：https://docs.openclaw.ai/
- Features 總覽：https://docs.openclaw.ai/concepts/features
- 設定參考：https://docs.openclaw.ai/gateway/configuration-reference
- 設定範例：https://docs.openclaw.ai/gateway/configuration-examples
- 排查指南：https://docs.openclaw.ai/troubleshooting
- GitHub：https://github.com/openclaw/openclaw
- Discord：https://discord.gg/clawd

Skills 同 Plugins：
- ClawHub 市場：https://clawhub.ai
- Skills 瀏覽：https://skills.sh/
- memory-lancedb-pro：https://github.com/CortexReach/memory-lancedb-pro
- Anthropic Skill Creator：https://github.com/anthropics/Skills/tree/main/Skills/skill-creator
- obra/superpowers：https://github.com/obra/superpowers
- awesome-claude-Skills：https://github.com/composiohq/awesome-claude-Skills

社群教學：
- OpenClaw Explained (Medium)：https://medium.com/@hasanmcse/openclaw-explained-features-real-world-use-cases-1ad115dd6578
- Ultimate Guide (Reddit)：https://www.reddit.com/r/ThinkingDeeplyAI/comments/1qsoq4h/the_ultimate_guide_to_openclaw_formerly_clawdbot/

完整參考清單見 README.md。
