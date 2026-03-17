# Prompt Template: Video Analysis Report

Use this structure when presenting the analysis to the user.

## Output Structure

```
## 📺 影片資訊
- 標題：{title}
- 長度：{duration}
- 語言：{language}

## 📝 逐字稿翻譯摘要
{Translated summary in user's preferred language. Keep concise but capture all key points.}

## A. 核心能力（學完後你將能夠⋯⋯）
1. {capability_1}
2. {capability_2}
3. {capability_3}
(3-5 items, concrete and actionable)

## B. 所需環境與工具清單
| 工具/平台 | 用途 | 必要性 |
|-----------|------|--------|
| {tool}    | {purpose} | 必要/選配 |

## C. 環境差距分析
Scan the user's current environment and compare against list B:
- ✅ {item} — {status}
- ❌ {item} — {what's missing}

## D. 建議執行順序
1. {step_1}
2. {step_2}
(Shortest path based on gap analysis)

---
請問要開始嗎？或者告訴我你想從哪個步驟切入。
```

## Environment Scanning Checklist

When performing gap analysis (section C), check:
- Installed CLI tools: `which <tool>` or `<tool> --version`
- Installed packages: `pip3 list`, `npm list -g`
- Running services: `systemctl status`, `docker ps`
- Config files: check relevant dotfiles and config dirs
- API keys: check env vars (do NOT display values, just confirm presence)

Report only presence/absence. Never expose secrets or API key values.
