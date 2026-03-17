---
name: readme-publisher
description: Update the ford-openclaw-share repo README and push to GitHub. Use when skills are added/modified, openclaw settings change, or any update needs to be reflected in the public guide.
version: 1.0.0
---

# README Publisher

將變更同步到 GitHub repo `radmanyeung/ford-openclaw-share` 嘅 README.md。

## When to Use

每次有以下變更時觸發：
- 新增或修改 skill
- OpenClaw 設定修改（openclaw.json、agent、channel 等）
- Setup guide 內容更新

## Repo 資訊

- **本地路徑：** `~/openclaw-setup-guide/`
- **Remote：** `git@github.com:radmanyeung/ford-openclaw-share.git`
- **Branch：** `main`
- **README：** `~/openclaw-setup-guide/README.md`

## 流程

### Step 1：確認變更內容

列出今次要更新嘅內容，逐項問用戶確認：

```
以下變更需要更新 README：

1. [新增/修改/刪除] — 具體描述
2. [新增/修改/刪除] — 具體描述

要更新 README 並 push 上 GitHub 嗎？(Y/N)
```

**必須等用戶確認先繼續。**

### Step 2：編輯 README

```bash
# README 位置
~/openclaw-setup-guide/README.md
```

根據變更內容更新對應章節。常見更新位置：

| 變更類型 | 更新位置 |
|----------|----------|
| 新增 skill | Skills 分類表 + `skills-manifest.json` |
| 修改 skill | 對應章節描述 |
| 新增 channel | Step 5（連接 Messaging 平台） |
| Agent 設定變更 | 設定模組表 |
| Provider 變更 | API Key 申請教學 / .env.example |
| Cron 變更 | 相關章節 |

### Step 3：更新 skills-manifest.json（如果 skill 有變）

```bash
# 如果有新增 skill，更新 manifest
~/openclaw-setup-guide/skills-manifest.json
```

確保 `categories` 入面嘅 skill 列表同實際 `skills/` 目錄一致。

### Step 4：Commit + Push

```bash
cd ~/openclaw-setup-guide

# Stage 改咗嘅檔案（唔好用 git add -A）
git add README.md
git add skills-manifest.json          # 如果有改
git add skills/<new-skill>/SKILL.md   # 如果有新 skill

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

### Step 5：回報結果

Push 完之後回報：

```
已更新 README 並 push 到 GitHub。

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
