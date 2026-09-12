# Chrome Web Store Listing Copy

## Extension Name (限定 75 字符)

**中文（推荐）**：
```
闲鱼词典 — 搜索翻译 + 暗语解读
```

**English alternative**：
```
Xianyu Dictionary — Search & Decode
```

---

## Short Description (限定 132 字符)

**中文**：
```
帮你在闲鱼/咸鱼搜索时自动建议暗语关键词；浏览商品时高亮并解读标题/描述里的隐晦用语。本地运行，零数据收集。
```
（61 字符）

**English**：
```
Decode coded jargon used by sellers on Xianyu (Goofish). Suggests slang variants in search, highlights and explains them on listings. 100% local.
```
（145 字符 — 注意要精简到 132 内）

精简版本（128 字符）：
```
Decode coded slang on Xianyu/Goofish. Suggests jargon for search; highlights and explains it on listing pages. 100% local.
```

---

## Detailed Description (限定 16,000 字符)

```
🐟 闲鱼词典 — 搜索建议 + 浏览解读 + 自定义扩展

闲鱼上很多卖家用谐音、缩写、绰号规避平台关键词过滤，普通买家搜不到目标，看不懂描述。
本插件用一份精心整理的暗语词典（覆盖电子产品 / 奢侈品 / 烟酒 / 球鞋 / 潮玩 / 谷圈 / 游戏账号 / 成色 / 议价 / 防坑 / 渠道 / 营销 等 15 个分类，共 159 个词条 / 489 个变体）解决这两个问题。

═════════ 功能 ═════════

🔍 搜索时自动建议暗语
在闲鱼搜索框输入正常关键词（如 iPhone / 茅台 / 周边），自动弹出对应暗语推荐（艾疯 / 猫腻 / 谷子...），点击直接替换。同时支持反向：输入暗语也能找到关联兄弟变体。

✨ 商品页自动解读
商品标题 / 描述中的已知暗语会自动加下划线高亮，鼠标悬停显示真实含义。
右下角浮动按钮一键打开侧滑面板，按出现频次列出本页所有暗语，点击条目可直接定位。

📚 完整词典浏览
弹窗内可按 15 个分类筛选浏览，全文搜索支持词条与变体双向查询。

📝 自定义词典（本地）
新版本支持你自己添加扩充词条。在「我的词典」标签可增删改查、JSON 导入 / 导出，与内置词典视觉区分（蓝色），永不上传。

🤖 可选本地 AI 兜底
词典查不到时，可一键调用 Chrome Built-in AI（Gemini Nano，运行在你本机）推测含义。完全本地、需手动触发、推测结果带"AI 推测"标签。

═════════ 隐私 ═════════

· 本插件不发起任何外部请求
· 不收集 / 不上报 / 不分享任何用户数据
· 仅本地存储自定义词典和开关偏好
· 只在闲鱼三个域名下工作

详见隐私政策：https://xianyu.memos.im/privacy

═════════ 开源 ═════════

源代码与词典 plaintext 源完全开源：
https://github.com/memos-im/xianyu-slang-helper

═════════ 反馈 ═════════

发现词典遗漏 / 误报，欢迎在 GitHub 提 Issue。
```

---

## English Detailed Description (alternative)

```
🐟 Xianyu Dictionary — Search · Decode · Custom Dictionary

Many Xianyu (Goofish) sellers use coded jargon (homophones, abbreviations, nicknames) to evade keyword filters. Ordinary buyers can't search effectively or understand listings. This extension solves both with a curated 159-entry / 489-variant slang dictionary spanning 15 categories: electronics, luxury, tobacco/alcohol, sneakers, designer toys, anime merch, gaming accounts, condition grades, negotiation phrases, anti-scam markers, sourcing claims, marketing speak, transaction terms, trading cards, and AI services.

═════════ Features ═════════

🔍 Search-time slang suggestions
Type a normal keyword in Xianyu's search box (iPhone, Rolex, etc.) and a popover suggests the actual coded variants used by sellers. One click replaces your query. Also works in reverse: type a slang term and find sibling variants.

✨ Auto-decode in product pages
Known slang in titles/descriptions is highlighted with a dotted underline. Hover to see the real meaning. A floating button opens a side panel listing every slang on the current page with frequency counts; click to jump to first occurrence.

📚 Full dictionary browser
Filter by 15 categories or full-text search across all entries and variants.

📝 Custom dictionary (local-only)
Add your own slang entries via the "My Dict" tab. Edit, delete, import/export JSON. Visually distinct from built-in entries (blue vs orange). Stored only in your browser.

🤖 Optional on-device AI fallback
When the dictionary doesn't have a match, click the AI button to invoke Chrome's Built-in Prompt API (Gemini Nano, runs on-device). Opt-in per query.

═════════ Privacy ═════════

· No external network requests
· No telemetry, no analytics, no tracking
· Only your custom entries and preferences stored locally
· Activates only on goofish.com / xianyu.com / 2.taobao.com

Privacy policy: https://xianyu.memos.im/privacy

═════════ Open source ═════════

Source code and plaintext dictionary: https://github.com/memos-im/xianyu-slang-helper
```

---

## Single Purpose (限定 1000 字符)

```
A single-purpose tool: helps users navigate the Xianyu (Goofish) second-hand marketplace by decoding the coded slang sellers commonly use, and by suggesting those slang variants in the platform's search box. Operates only on goofish.com / xianyu.com / 2.taobao.com domains and performs no function elsewhere.
```

---

## Permission Justifications

每个权限要单独解释：

### `storage`
```
Used to persist user preferences (e.g., whether in-page slang highlighting is enabled) and the user's optional custom dictionary entries. All data remains local in chrome.storage.local; no external transmission.
```

### `activeTab`
```
Used by the popup interface to read the currently focused tab so it can apply settings (e.g., re-scan the page after dictionary changes). No background data collection.
```

### Host permission: `*://*.goofish.com/*`, `*://*.xianyu.com/*`, `*://2.taobao.com/*`
```
The extension only injects its slang-detection content script on the official Xianyu (Goofish) second-hand marketplace domains. These are the only sites where the coded slang dictionary is relevant. The extension performs zero actions on any other domain.
```

### Remote code use
```
No. The extension does not download, execute, or evaluate any remote code. The bundled encrypted dictionary file is static data (a slang word list) decrypted in-memory using a locally-stored key.
```

---

## Category

**Productivity** (推荐) — 或 **Shopping** 也可

## Language

Primary: **Chinese (Simplified)** zh_CN — 主要用户是中文用户

可在 listing 里额外配 English description (上面已附)

## Maturity

**Everyone** — 不含成人 / 敏感内容（已主动移除"敏感暗语"分类）

## Search Keywords (用于发现性)

闲鱼, 咸鱼, goofish, xianyu, 二手, 暗语, 暗语, slang, 翻译, 解读, 谷圈, 球鞋, 议价, 防坑
