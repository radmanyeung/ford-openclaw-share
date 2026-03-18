---
name: youtube-prompt-generator
description: Generate a reusable prompt from a YouTube tutorial video. Fetches transcript, analyses content, extracts actionable steps. Triggers on "提取prompt", "extract prompt", "生成prompt", "make a prompt from this video", "turn this tutorial into a prompt", "用呢條片生成 prompt", or any YouTube URL with prompt/提取 intent.
tools: [Bash, Read, Edit, Write, Glob, Grep]
---

# YouTube Prompt Generator

將 YouTube 教學影片自動轉換成可重用嘅結構化 prompt。

## 重要原則

1. **一條片 = 一個 prompt** — 每條影片生成一個獨立 prompt
2. **忠於原片** — prompt 嘅內容要準確反映影片教嘅嘢，唔好自己加料
3. **可執行** — 生成嘅 prompt 要可以直接用，唔只係文字摘要
4. **逐步確認** — 每個階段都要用戶確認先繼續
5. **用繁體中文溝通**，prompt 內容按影片語言 + 用戶偏好決定

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

| 類型 | 特徵 | Prompt 重點 |
|------|------|-------------|
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

要根據呢啲內容生成 prompt 嗎？
```

---

### Phase 2: 生成 Prompt

根據 Phase 1 提取嘅資訊，生成以下固定結構嘅 prompt，直接回覆俾用戶：

**Prompt 輸出模板：**

````
你是一位 AI 代理助手。你的任務是學習以下影片的完整內容，分析使用者當前環境與影片需求的差距，再等待使用者確認後幫助他建立環境並執行任務。

## 影片資訊
- 標題：{影片標題}
- 分類：{根據 Step 1.2 判斷嘅類型}
- 摘要：{2-3 句描述影片內容，涵蓋主題、方法同目標}

---

## 第一步：確認 Transcript 技能是否就緒

嘗試使用 youtube-transcript-yt-dlp 技能取得以下影片的英文字幕（含時間戳記）。

**如果技能尚未安裝，請向使用者說明（已安裝者可忽略此段）：**

> 請在終端機執行以下指令安裝字幕技能：
>
> npx clawhub@latest install itzsubhadip/youtube-transcript-yt-dlp
>
> 安裝完成後，重新貼上這段 Prompt 即可繼續。

若技能已就緒，直接進行下一步，不需顯示安裝說明。

---

## 第二步：取得字幕並翻譯分析

成功呼叫技能後：

1. 優先取得**英文字幕**（若無英文字幕，改取任何可用語言）
2. 將逐字稿全文翻譯成**繁體中文**
3. 進行以下分析：

**A. 影片核心能力**
條列 3–5 項「學完後你將能夠⋯⋯」的具體能力

**B. 所需環境與工具清單**
列出影片提到的所有工具、平台、API、套件及版本需求

**C. 環境差距分析**
主動掃描使用者目前的環境（已安裝工具、現有設定），與 B 項清單逐一對照：
- ✅ 已就緒的項目
- ❌ 缺少或需要設定的項目

**D. 建議執行順序**
根據差距分析，列出最短路徑的設定步驟

---

## 第三步：提案並等待確認

完成分析後，向使用者呈現：

「我已讀完這支影片的完整內容。

**學完後你將具備的能力：**
[列出 A]

**環境差距分析：**
[列出 C]

**建議設定步驟：**
[列出 D]

請問要開始嗎？或者告訴我你想從哪個步驟切入。」

---

## 第四步：建立環境並執行任務

使用者確認後，依步驟協助建立環境並執行任務。
遇到需要使用者手動操作的步驟時，暫停說明並等待確認後再繼續。

---

影片來源：{YouTube URL}
````

**Prompt 撰寫原則：**
- 影片資訊嘅摘要要忠於原片內容，唔好自己加料
- 分類要根據 Step 1.2 嘅影片類型判斷結果填入
- 摘要要涵蓋：教咩、點做、達到咩效果
- 影片入面提到嘅所有工具、依賴都要反映喺「所需環境與工具清單」嘅預期輸出入面
- 環境差距分析要涵蓋所有依賴，唔好遺漏
- 保留原片嘅決策邏輯（「因為 X 所以做 Y」）

---

### Phase 3: 驗證同輸出

**Step 3.1 — 驗證 Prompt 內容**

喺輸出之前，自我檢查：
- 影片資訊準確（標題、分類、摘要）
- 摘要來自影片，冇自己加料
- 模板結構完整（四個步驟齊全）
- YouTube URL 正確填入
- 冇洩漏 API key 或 secret
- 環境檢查涵蓋所有依賴

**Step 3.2 — 直接回覆用戶**

將完整 prompt 內容直接輸出俾用戶，唔需要寫入檔案。用 markdown code block 包住成個 prompt，方便用戶直接複製。

---

## 品質檢查清單

生成完 prompt 後，自我檢查：

- [ ] 影片標題正確
- [ ] 分類合理（對應 Step 1.2 嘅影片類型）
- [ ] 摘要忠於原片，冇自己加料
- [ ] 四個步驟結構完整
- [ ] 環境檢查涵蓋所有依賴
- [ ] YouTube URL 正確填入（影片來源）
- [ ] 冇洩漏 API key 或 secret
- [ ] Prompt 可以直接複製貼上使用

---

## 限制

- 字幕質素差嘅片可能影響提取準確度
- 純視覺操作（冇口述步驟）嘅片會缺失資訊
- 生成嘅 prompt 需要用戶 review，唔好盲目信任
- 影片入面嘅版本號可能過時，提醒用戶檢查
