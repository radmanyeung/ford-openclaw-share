---
name: readme-publisher
description: Sync workspace skills to GitHub repo, update README, and push. Use when skills are added/modified, openclaw settings change, or any update needs to be reflected in the public guide.
version: 2.0.0
---

# README Publisher

將 workspace skills + 變更同步到 GitHub repo `radmanyeung/ford-openclaw-share`。

## When to Use

每次有以下變更時**必須觸發**：
- 新增或修改 skill（不論用任何方法：手動、腳本、agent）
- 刪除 skill
- OpenClaw 設定修改（openclaw.json、agent、channel 等）
- Setup guide 內容更新

## Repo 資訊

- **本地路徑：** `~/openclaw-setup-guide/`
- **Remote：** `git@github.com:radmanyeung/ford-openclaw-share.git`
- **Branch：** `main`
- **README：** `~/openclaw-setup-guide/README.md`
- **Source of truth：** `~/.openclaw/workspace/skills/`（所有 skill 檔案嘅來源）

## 流程

### Step 1：同步 Workspace Skills → Repo

**每次都要先跑呢步**，確保 repo 嘅 skills/ 同 workspace 一致：

```bash
~/.openclaw/scripts/repo-sync.sh
```

呢個腳本會：
- 將 workspace 所有 skill 複製到 `~/openclaw-setup-guide/skills/`（實際檔案，唔係 symlink）
- 自動解析 symlink（GitHub 需要實際檔案）
- 報告有咩新增/更新/刪除

用 `--status` 可以預覽差異：
```bash
~/.openclaw/scripts/repo-sync.sh --status
```

用 `--skill NAME` 可以只同步單一 skill：
```bash
~/.openclaw/scripts/repo-sync.sh --skill youtube-prompt-generator
```

### Step 2：確認變更內容

列出今次要更新嘅內容，逐項問用戶確認：

```
以下變更需要更新 README：

1. [新增/修改/刪除] — 具體描述
2. [新增/修改/刪除] — 具體描述

要更新 README 並 push 上 GitHub 嗎？(Y/N)
```

**必須等用戶確認先繼續。**

### Step 3：編輯 README

```bash
# README 位置
~/openclaw-setup-guide/README.md
```

根據變更內容更新對應章節。常見更新位置：

| 變更類型 | 更新位置 |
|----------|----------|
| 新增 skill | Skills 分類表（README）+ `skills-manifest.json` |
| 修改 skill（描述/功能變動） | Skills 分類表描述 + `skills-manifest.json` |
| 修改 skill（內容微調） | 只需 repo-sync，README 唔使改 |
| 新增 channel | Step 2（連接 Messaging 平台） |
| Agent 設定變更 | 設定模組表 |
| Provider 變更 | API Key 申請教學 / .env.example |
| Cron 變更 | 相關章節 |

### Step 4：更新 skills-manifest.json（如果 skill 有變）

```bash
# 如果有新增/刪除 skill，更新 manifest
~/openclaw-setup-guide/skills-manifest.json
```

確保 `categories` 入面嘅 skill 列表同實際 `skills/` 目錄一致。

### Step 5：Commit + Push

```bash
cd ~/openclaw-setup-guide

# Stage 改咗嘅檔案（唔好用 git add -A）
git add README.md
git add skills-manifest.json                    # 如果有改
git add skills/                                 # repo-sync 同步過嘅 skill 檔案

# Commit — 註明具體變更
git commit -m "$(cat <<'EOF'
<簡短標題>

變更內容：
- [新增/修改/刪除] <具體描述>
- [新增/修改/刪除] <具體描述>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"

# Push
git push origin main
```

### Step 6：回報結果

Push 完之後回報：

```
已同步 skills 並更新 README，push 到 GitHub。

變更摘要：
- [列出每項變更]

Commit: <commit hash>
```

## Commit Message 格式

標題用以下 prefix：

| Prefix | 用途 |
|--------|------|
| `Add` | 新增功能/skill/章節 |
| `Update` | 修改現有內容 |
| `Remove` | 刪除內容 |
| `Fix` | 修正錯誤 |

例子：
- `Add readme-publisher skill (34 skills total)`
- `Update WhatsApp setup guide with multi-account support`
- `Add new cron job examples to README`

## 注意事項

- **每項變更都要問用戶確認**，唔好自動 push
- Commit 訊息要清楚列出所有變更
- 如果同時有多項變更，合成一個 commit
- Push 前確認 `git status` 冇意外嘅檔案
- 唔好 commit `.env` 或任何含 API key 嘅檔案
