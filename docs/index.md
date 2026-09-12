---
layout: default
title: 闲鱼词典 · 闲鱼黑话/暗语翻译 Chrome 扩展
description: 一秒读懂闲鱼黑话！Chrome 插件帮你搜得到、看得懂卖家用的谐音/缩写/绰号。21 个分类、243 词条、本地运行、零数据收集。
keywords: 闲鱼黑话, 闲鱼暗语, 闲鱼词典, 闲鱼翻译, 黑话翻译, 闲鱼搜索, 闲鱼插件, 二手交易黑话, goofish, xianyu
permalink: /
image: /screenshots/03-detail-panel.png
---

<!-- JSON-LD structured data for Google rich results -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "闲鱼词典",
  "alternateName": ["闲鱼黑话助手", "闲鱼暗语翻译", "Xianyu Dictionary"],
  "applicationCategory": "BrowserApplication",
  "operatingSystem": "Chrome, Edge, Brave",
  "description": "Chrome 浏览器扩展，帮你搜得到、看得懂闲鱼上卖家用的黑话/暗语。21 个分类、243 词条、本地运行、零数据收集。",
  "softwareVersion": "1.8.0",
  "url": "https://xianyu.memos.im/",
  "downloadUrl": "https://chromewebstore.google.com/detail/%E9%97%B2%E9%B1%BC%E8%AF%8D%E5%85%B8/kblfpfpjgbhakbjefandponpkflfjmei",
  "author": {
    "@type": "Organization",
    "name": "memos-im",
    "url": "https://github.com/memos-im"
  },
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  },
  "inLanguage": "zh-CN"
}
</script>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "什么是闲鱼黑话？",
      "acceptedAnswer": { "@type": "Answer", "text": "闲鱼黑话是卖家用来规避平台关键词过滤的隐讳表达——通常是谐音（猫腻=茅台）、缩写（AJ=Air Jordan）、绰号（驴牌=LV）或圈内行话（谷子=二次元周边）。" }
    },
    {
      "@type": "Question",
      "name": "为什么闲鱼上有这么多黑话？",
      "acceptedAnswer": { "@type": "Answer", "text": "主要四个原因：品牌词被平台限制；用黑话能找到竞争少的漏；谷圈卡圈潮玩圈有自己的行话形成圈层认同；以及防止商品被外部搜索引擎和爬虫收录。" }
    },
    {
      "@type": "Question",
      "name": "这个扩展能解读哪些类型的黑话？",
      "acceptedAnswer": { "@type": "Answer", "text": "21 个分类、243 个核心词条、819 个变体，覆盖电子产品、奢侈品、烟酒、球鞋、潮玩、谷圈、游戏账号、AI 服务、互联网/数字服务、虚拟商品、账号交易、图片暗号/站外引流、刷单任务、成色描述、议价话术、防坑识别、渠道来源、营销话术、交易话术、卡牌集换。" }
    },
    {
      "@type": "Question",
      "name": "安全吗？会上传我的搜索记录吗？",
      "acceptedAnswer": { "@type": "Answer", "text": "完全本地运行。本插件不发起任何网络请求，不集成任何统计埋点，仅开关偏好和自定义词条存在浏览器本地存储中，永不与服务器同步。" }
    },
    {
      "@type": "Question",
      "name": "词典里没有的新黑话怎么办？",
      "acceptedAnswer": { "@type": "Answer", "text": "可以在插件「我的」标签本地添加自定义词条（永不上传），也可以在 GitHub Issues 提交给社区，审核后会并入下个版本。" }
    }
  ]
}
</script>

# 🐟 闲鱼词典 — 一秒读懂卖家的黑话/暗语

> Chrome 浏览器扩展 · 解决闲鱼上**黑话/暗语**搜不到、看不懂的问题 · 完全本地运行 · 零数据收集

[![Version](https://img.shields.io/badge/version-1.8.0-orange)](https://github.com/memos-im/xianyu-slang-helper/releases)
[![License](https://img.shields.io/badge/license-MIT-blue)](https://github.com/memos-im/xianyu-slang-helper/blob/main/LICENSE)
[![Stars](https://img.shields.io/github/stars/memos-im/xianyu-slang-helper?style=social)](https://github.com/memos-im/xianyu-slang-helper)

[![安装闲鱼词典](https://img.shields.io/badge/Chrome%20Web%20Store-%E5%AE%89%E8%A3%85%E9%97%B2%E9%B1%BC%E8%AF%8D%E5%85%B8-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/%E9%97%B2%E9%B1%BC%E8%AF%8D%E5%85%B8/kblfpfpjgbhakbjefandponpkflfjmei)

> 🎉 **已上架 Chrome 应用商店** — 👉 **[点此一键安装闲鱼词典](https://chromewebstore.google.com/detail/%E9%97%B2%E9%B1%BC%E8%AF%8D%E5%85%B8/kblfpfpjgbhakbjefandponpkflfjmei)**（点"添加至 Chrome"，安装后随浏览器自动更新）

> 📖 遇到看不懂的词？先查 **[闲鱼黑话大全（2026 持续更新）](heihua/)**

## 📑 目录
{: .no_toc }

{::options toc_levels="2" /}
* TOC
{:toc}

## 它解决什么问题？

闲鱼上很多卖家使用谐音、缩写、绰号等**黑话**规避平台的关键词过滤，普通买家**搜不到**目标，**看不懂**商品描述。这些隐讳用语（业内叫**暗语**或**黑话**）随便举几个：

| 你能看懂这是什么吗？ | 实际是？ |
|---|---|
| **艾疯** 14 Pro Max | iPhone 14 Pro Max |
| **猫腻** 2018 飞天 | 茅台 2018 飞天 |
| **驴牌** Speedy 30 | LV (路易威登) Speedy 30 |
| **拉布布** 三代 隐藏款 | Labubu 三代隐藏款 |
| **耐磕** AJ1 黑红 **公司级** | Nike AJ1 黑红（高仿质量分级） |
| **接受小刀** | 接受小幅度议价 (7-8 折) |
| **9 成 9 新** 包**邮** | 接近全新，卖家承担运费 |
| **女大学生自用** | （警示：可能是矿卡 / 翻新货） |

这就是为什么直接搜"iPhone"、"茅台"经常找不到便宜货——它们的关键词都被卖家替换成了黑话。

**闲鱼词典**用一份精心整理的暗语词典——**21 个分类 · 243 条目 · 819 个变体**——一次性解决这两个问题。

---

## 核心功能

### 🔍 搜索时自动建议暗语

在闲鱼搜索框输入正常关键词（如 `iPhone`），自动弹出对应黑话推荐（`艾疯/i疯/爱疯`），点击直接替换搜索词，瞬间提升能搜到的商品数。

![搜索建议气泡 - 闲鱼黑话翻译](screenshots/01-search-popup.png){: loading="lazy" }

### ✨ 浏览商品时自动解读黑话

商品标题和描述里的暗语会自动加下划线高亮。鼠标悬停就显示真实含义，不再需要专门去搜"XX 是什么意思"。

![商品列表黑话高亮 - 闲鱼暗语翻译](screenshots/02-listing-highlights.png){: loading="lazy" }

### 📋 一键查看本页全部暗语

右下角浮动按钮显示本页检测到的黑话数量。点击展开侧滑面板，按出现频次排列，**点击条目可定位到第一次出现的位置**。

![本页黑话清单 - 闲鱼词典](screenshots/03-detail-panel.png){: loading="lazy" }

### 💬 独立翻译面板

点击工具栏图标，弹窗里可以做双向翻译：

- **正向**（→ 转暗语）：输入"iPhone 茅台"，得到所有黑话变体
- **反向**（← 解读暗语）：粘贴商品描述，自动标出所有黑话

![双向翻译面板](screenshots/04-popup-translate.png){: loading="lazy" }

### 📝 自定义词典（本地）

发现新黑话？在"我的"标签自己加。

- 增 / 删 / 改 / JSON 导入导出
- 与内置词典视觉区分（**蓝色** vs 内置橙色）
- 数据**永不上传**，只存你的浏览器

![自定义黑话词典](screenshots/05-popup-custom.png){: loading="lazy" }

### 📚 完整词典浏览

21 个分类 chip 一键筛选，支持词条 / 变体双向全文搜索。

![词典分类浏览](screenshots/06-popup-dict.png){: loading="lazy" }

### 🤖 可选本地 AI 兜底

词典查不到？一键调用 Chrome 内置的 **Gemini Nano**（完全在你设备上运行），让 AI 推测黑话含义。

- **opt-in** — 必须用户点按钮才触发
- **完全本地** — 不联网、不外发
- 推测结果带"AI 推测"标签，准确度低于词典

---

## 词典覆盖范围

| 分类 | 词条数 | 黑话示例 |
|---|---|---|
| 📱 电子产品 | 20 | 艾疯 / 卑果 / 花为 / 大米 / 矿卡 / 农企 |
| 👜 奢侈品 | 12 | 驴牌 / 香奶奶 / 爱马屎 / 老鼠 / 绿水鬼 |
| 🚬 烟酒 | 9 | 猫腻 / 仲华 / 拉飞 / 酱香科技 |
| 👟 球鞋潮牌 | 9 | 耐磕 / 椰子 / 通货 / 纯原 / 公司级 |
| 🎲 潮玩盲盒 | 8 | 拉布布 / 川沙妲己 / 端盒 |
| 🐰 谷圈 / 二次元 | 28 | 谷子 / 吧唧 / 痛包 / 海景房 / 同担拒否 |
| 🎮 游戏账号 | 28 | 农药 / 原批 / 吃鸡 / 老滚5 / 猛汉王 / 俄罗斯原神 |
| 🤖 AI 服务 | 15 | 拟人 / 拼车 / 狗屁通 / closeai / 中转站 |
| 🌐 互联网 / 数字服务 | 14 | 良心云 / 网飞 / 纸飞机 / 巨硬 / b站 / 推特 |
| 💾 虚拟商品 | 8 | 拍下不发货 / 自动发货 / 网盘资源 / 打包资料 |
| 🔑 账号交易 | 7 | 老号 / 高权重 / 可改密 / 带粉账号 / 纯净号 |
| 📵 图片暗号 / 站外引流 | 4 | 细节看图 / 图中暗号 / 扫码联系 / 私信详谈 |
| 🔁 刷单 / 任务 | 7 | 仁武 / 互关互赞 / 好评返现 / 任务单 |
| 🏷️ 成色描述 | 16 | 99 新 / 伊拉克成色 / 充新 / 战损 / 穿一洗一 |
| 💰 议价话术 | 10 | 不接受任何刀 / 小刀 / 屠龙刀 / 大刀勿扰 |
| ⚠️ 防坑识别 | 8 | 女大学生自用 / 只面交 / 国行在保 / 懂的都懂 |
| 📦 渠道来源 | 4 | 年会奖品 / 水货代购 |
| 📢 营销话术 | 5 | 白菜价 / 急出 / 清仓 |
| 💬 交易话术 | 21 | 走闲鱼 / 秒拍 / 绿泡泡 / 企鹅 / 软妹币 |
| 🃏 卡牌集换 | 5 | 端盒 / 散包 / SP |

👉 常见词的含义详解（免安装可查）：**[闲鱼黑话大全（2026 持续更新）](heihua/)**

---

## 安装

### 方式 1：Chrome 应用商店（推荐）

👉 **[从 Chrome 应用商店安装闲鱼词典](https://chromewebstore.google.com/detail/%E9%97%B2%E9%B1%BC%E8%AF%8D%E5%85%B8/kblfpfpjgbhakbjefandponpkflfjmei)**

打开后点击"**添加至 Chrome**"即可，安装后随 Chrome 自动更新。

### 方式 2：手动加载（开发者模式）

1. 到 [Releases 页面](https://github.com/memos-im/xianyu-slang-helper/releases) 下载最新 `.zip`
2. 解压到任意文件夹
3. Chrome 地址栏访问 `chrome://extensions/`
4. 右上角开启"**开发者模式**"
5. 点击"**加载已解压的扩展程序**"，选刚才的文件夹
6. 访问 [goofish.com](https://www.goofish.com/) 即可使用

> 兼容 Chrome 138+ / Edge / Brave 等 Chromium 内核浏览器

---

## 常见问题（FAQ）

### 什么是闲鱼黑话？

闲鱼黑话是卖家用来**规避平台关键词过滤**的隐讳表达——通常是谐音（如"猫腻" = 茅台）、缩写（如"AJ" = Air Jordan）、绰号（如"驴牌" = LV）或圈内行话（如"谷子" = 二次元周边）。常见词的完整解释见 **[闲鱼黑话大全](heihua/)**。

### 为什么闲鱼上有这么多黑话？

主要四个原因：
1. **品牌词被屏蔽**：奢侈品、烟酒等品类的官方品牌词常被平台限制
2. **避免被加价**：高人气品牌词搜索量大，竞争激烈，用黑话能找到"漏"
3. **圈层认同**：谷圈、卡圈、潮玩圈等社群有自己的内部行话
4. **防止盗图**：让闲鱼商品不被外部搜索引擎或爬虫收录

### 这个扩展能解读哪些类型的黑话？

21 个分类、243 个核心词条、819 个变体。覆盖电子产品、奢侈品、烟酒、球鞋、潮玩、谷圈、游戏账号、AI 服务、互联网/数字服务、虚拟商品、账号交易、图片暗号/站外引流、刷单任务、成色描述、议价话术、防坑识别、渠道来源、营销话术、交易话术、卡牌集换。

### 词典里没有的新黑话怎么办？

两个办法：
1. **本地添加**：在 popup 的"我的"标签自己加词条（永不上传）
2. **贡献给社区**：在 [GitHub Issues](https://github.com/memos-im/xianyu-slang-helper/issues) 提交，审核后会并入下个版本

### 安全吗？会上传我的搜索记录吗？

**完全本地运行**。本插件不发起任何网络请求，不集成任何统计/埋点。仅你的开关偏好和自定义词条存在 `chrome.storage.local`（Chrome 提供的本地存储，永不与服务器同步）。

详见 [隐私政策](privacy/)。

### 跟 Chrome 内置的 AI 是什么关系？

可选功能。**默认不调用**。当你点击翻译面板里的"用本地 AI 试试解读"按钮时，才会调用 Chrome 自带的 Gemini Nano（设备本地模型）做推测——同样不联网，结果会明确标记为"AI 推测"。

### 跟其他闲鱼翻译插件有什么区别？

| 维度 | 闲鱼词典 | 一般翻译插件 |
|---|---|---|
| 词典体积 | 243 条 / 819 变体 | 通常 < 50 |
| 数据上传 | 0 字节 | 通常上传搜索词做"改进" |
| AI 兜底 | 本地 Gemini Nano（opt-in） | 通常调云端 API |
| 自定义词典 | 支持，本地存 | 较少支持 |
| 详情页解读 | 浮动 FAB + 侧滑全览 | 仅悬停 tooltip |
| 开源 | 是（MIT） | 通常闭源 |

---

## 隐私

| 项 | 说明 |
|---|---|
| 外部请求 | 🚫 **零**（无任何 fetch / XHR / WebSocket） |
| 数据收集 | 🚫 **零**（无统计、无埋点、无第三方 SDK） |
| 同步存储 | 🚫 **不使用** chrome.storage.sync |
| 本地存储 | ✅ 仅你的偏好设置和自定义词条 |
| 生效域名 | ✅ 仅 `goofish.com / xianyu.com / 2.taobao.com` |

完整说明：[隐私政策](privacy/)

---

## 开源

源代码、构建脚本、明文词典完全开源：

[github.com/memos-im/xianyu-slang-helper](https://github.com/memos-im/xianyu-slang-helper)

License: MIT

## 反馈与贡献

- 词典遗漏 / 误报 / Bug：[GitHub Issues](https://github.com/memos-im/xianyu-slang-helper/issues)
- 邮箱：[help@memos.im](mailto:help@memos.im)

欢迎 PR 补充新黑话词条！编辑 [tools/dictionary.source.json](https://github.com/memos-im/xianyu-slang-helper/blob/main/tools/dictionary.source.json) 即可。
