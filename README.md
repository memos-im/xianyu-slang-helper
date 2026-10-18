# 闲鱼词典 (Xianyu Dictionary)

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-%E5%AE%89%E8%A3%85%E9%97%B2%E9%B1%BC%E8%AF%8D%E5%85%B8-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/%E9%97%B2%E9%B1%BC%E8%AF%8D%E5%85%B8/kblfpfpjgbhakbjefandponpkflfjmei)

> 🎉 **已上架 Chrome 应用商店** — 👉 **[点此一键安装](https://chromewebstore.google.com/detail/%E9%97%B2%E9%B1%BC%E8%AF%8D%E5%85%B8/kblfpfpjgbhakbjefandponpkflfjmei)**

Chrome / Edge 浏览器扩展，帮你解决闲鱼上的"暗语搜不到、看不懂"问题。

## 功能

- **搜索词翻译**：闲鱼搜索框输入正常词（`iPhone`、`茅台`、`谷子`），自动弹出对应暗语推荐，点击直接替换。
- **暗语解读**：商品标题/描述里的暗语自动加下划线高亮，悬停看含义。
- **独立翻译面板**：粘贴任意文本，正反向翻译，点击复制。
- **分类浏览**：21 个分类（电子产品/奢侈品/烟酒/球鞋/潮玩/谷圈/游戏/AI 服务/互联网/虚拟商品/账号交易/站外引流/刷单任务/成色/议价/防坑/渠道/营销/交易/卡牌），可按分类筛选。
- **自定义词条**：自己加的词只存在本地，永不上传。
- **跟随版本更新**：词典随插件版本更新，依赖 Chrome 自动更新机制，无需远端拉取。

## 安装

### 方式 1：Chrome 应用商店（推荐）

👉 **[从 Chrome 应用商店安装闲鱼词典](https://chromewebstore.google.com/detail/%E9%97%B2%E9%B1%BC%E8%AF%8D%E5%85%B8/kblfpfpjgbhakbjefandponpkflfjmei)** — 点"添加至 Chrome"即可，安装后随浏览器自动更新。

### 方式 2：手动加载（开发者模式）

1. 到 [Releases 页面](https://github.com/memos-im/xianyu-slang-helper/releases) 下载最新 `.zip` 并解压（或克隆本仓库）
2. 打开 `chrome://extensions/`，右上角开启"开发者模式"
3. "加载已解压的扩展程序" → 选 `xianyu-slang-helper` 文件夹
4. 访问 [goofish.com](https://www.goofish.com/) 即可生效

## 隐私

- **零外部请求**：不向任何外部服务器发请求，词典随扩展一起分发
- **零数据收集**：不上报使用数据，无统计埋点
- **生效域名限制**：仅在 goofish.com / xianyu.com / 2.taobao.com 三个域名运行
- **本地存储**：仅开关偏好和你的自定义词条，存在 `chrome.storage.local`，永不同步

## 词典规模（v1.9.0）

21 分类 · 250 条目 · 896 个暗语变体

来源：知乎、Linux.do、X / Twitter、谷圈科普文、[search-sharp.com](https://search-sharp.com) 社区众包（经质量 + 政策过滤）等公开内容。**只收录二手交易类**暗语，不含涉违法暗号。

## 来源致谢

- [闲鱼"暗语"你知道吗？(知乎)](https://zhuanlan.zhihu.com/p/112140534)
- [大众版暗网？闲鱼APP上的暗语 (环信)](https://www.easemob.com/news/8996)
- [闲鱼有哪些常见的术语和暗语？ (红草笔记)](https://www.redcao.com/archives/18810.html)
- [可以分享你知道的闲鱼暗语吗 (Linux.do)](https://linux.do/t/topic/972037)
- [谷圈名词科普 (知乎)](https://zhuanlan.zhihu.com/p/119634849)
- [全是"暗语"的谷圈 (界面新闻)](https://www.jiemian.com/article/6953041.html)
- [SearchSharp (search-sharp.com)](https://search-sharp.com) — 社区众包的叫法/别名，经质量 + 政策过滤后并入
- [r/goofish 闲鱼暗语字典分享 (Reddit)](https://www.reddit.com/r/goofish/comments/1ps0bnt/) — 待并入（受 Reddit 反爬限制，需手工提取）

---

## 开发

技术栈：**WXT 0.21 + TypeScript + Bun**（无 UI 框架，纯 DOM）。`manifest.json` 由 WXT 生成，不在仓库里。

```bash
bun install
bun run dev          # 起 dev server + 构建到 dist/chrome-mv3-dev（改动自动重建）
bun run build        # 构建 → dist/chrome-mv3
bun run compile      # 类型检查（bun check）
bun run lint         # oxlint
bun run fmt          # oxfmt --write
bun run verify       # 类型检查 + lint + 格式 + 匹配器等价性（发版 CI 的闸门）
```

### 装进 Chrome 调试

`bun run dev` 不会自己开浏览器（未装 `web-ext`）：它起 dev server 并打印
`Load "dist/chrome-mv3-dev" as an unpacked extension manually`。手动装一次即可：

1. `bun run dev`（保持这个终端开着）
2. `chrome://extensions` → 开启右上角 **开发者模式** → **加载已解压的扩展程序**
3. 选仓库下的 **`dist/chrome-mv3-dev`**（非隐藏目录，Finder 里直接可见）

用你自己的 Chrome profile，goofish 的登录态还在。改代码后 dev server 自动重建；
popup 走 Vite HMR，content script 改动 WXT 会自动重载（因此 dev manifest 会额外带上
`tabs` / `scripting` 权限 —— 发布产物没有这两个，别被权限提示误导）。

两个产物的差别只有词典：

| 产物                  | 词典                             | 用途                                                |
| --------------------- | -------------------------------- | --------------------------------------------------- |
| `dist/chrome-mv3-dev` | `dictionary.source.json`（明文） | 日常调试，改 `data/dictionary.source.json` 立即生效 |
| `dist/chrome-mv3`     | `dictionary.enc.json`（密文）    | 验证 AES-GCM 解密路径 / 上架前                      |

> 想让它自动开浏览器：`bun add -d web-ext`。注意它默认每次开全新临时 profile（没有登录态）、
> 且默认参数会**禁掉 Prompt API**（本扩展的 AI 兜底依赖它）；要调 AI 得配 `web-ext.config.ts`。

**dev server 收不干净**：`wxt` 是子进程，直接关终端（或 `kill` 外层 `bun`）可能留下它在后台占着
3000 端口、并继续写 `dist/chrome-mv3-dev`，下一个 `bun dev` 抢同一个目录就会报错。清理：

```bash
pkill -f "node_modules/.bin/wxt"   # 再跑 bun dev
```

> 顺带：`bun dev` 退出时打印 `error: script "dev" exited with code 143` 不是故障 —— 143 就是
> SIGTERM（Ctrl+C 或超时），服务本来就不该自己退出。

### 词典怎么走

改词典**不需要手动加密**：直接编辑 `data/dictionary.source.json`，开发模式下 loader 读明文，
改完刷新即生效。构建时由 `wxt.config.ts` 的 `build:publicAssets` hook 决定注入哪份：

| 模式 | 注入产物根目录的文件             | 加载行为     |
| ---- | -------------------------------- | ------------ |
| 开发 | `dictionary.source.json`（明文） | 直接读明文   |
| 发布 | `dictionary.enc.json`（密文）    | AES-GCM 解密 |

> 发布包里的词典是加密的，目的只是让爬虫没法 `curl + grep` 直接扒走词条列表；
> 口令以明文常量放在 `src/dict/constants.ts`，**没有做混淆**。缘由见 `src/dict/crypto.ts` 头部注释
> 与 `store-assets/reviewer-notes.md`。
> 运行时解密与构建期加密共用同一份 WebCrypto 实现，常量不可能两侧漂移。

### 发布

版本**只有一个来源：`package.json`**。改完词典后：

```bash
# 1. 改 package.json 的 version
# 2. 本地走一遍 CI 的构建链（构建 → 产物安全检查 → 打 zip）
bun run release:build
```

`verify:dist` 会断言产物里没有 `tools/`、没有明文词典、抽样关键词不泄漏；
`wxt zip` 产出的 `dist/*-chrome.zip` 里 `manifest.json` 已在根目录，可直接上传商店。

### CI 自动发布

推送 `v*` tag（如 `v1.9.1`）即触发 GitHub Actions：校验 `tag == package.json.version` → 构建 → 上传到 Chrome Web Store（默认草稿，到后台手动 Publish）。一次性凭据配置见 [.github/RELEASING.md](.github/RELEASING.md)。

### 词典定时同步

`.github/workflows/sync-slang.yml` 每周一自动从两个开源源拉取暗语并入 `data/dictionary.source.json`，有改动时开一个 `chore/sync-slang` PR 供人工复核：

- **awesome-chinese-secondhand-slang**（主源）— 人工维护的开源数据仓（~110 概念 / 4500+ 变体）：`bun run dict:sync [-- --apply]`
- **search-sharp.com**（次源）— 众包站（尽力而为，CI 里可能被限流）：`bun run dict:sync:searchsharp [-- --apply]`

两个脚本先抓取再经**政策分档 + 风险变体（单字/短缩写/日常词）+ 去重**过滤，默认只"暂存"到 `tools/*.staged.json` 并打印报告，加 `--apply` 才写入词典。

政策分两档（`tools/lib/dict-shared.ts`）：**HARD**（色情/毒品/武器/赌博/盗号/涉未成年等违法题材）一律排除；**GREY**（高仿假货/黄牛代抢/引流养号/社保代缴/活体宠物等商店政策灰色题材）**默认写入**并单独报告——合并 PR 时请确认过审风险可接受，介意可用 `--deny-grey`。

追加 `--ai-review` 可用 **TypeSafe System One 判别模型**（[Jev](https://docs.typesafe.ai)；自托管 DiffusionGemma 同 API）剔除上游的"模板化噪音"变体：每个候选变体问一个 `Noul`（是/否）问题，取概率 ≥ 阈值判为噪音，不生成文本、无解析、返回校准概率。未配置 key 时自动降级跳过，不阻断同步。

**key 填在哪**（取 key：<https://console.typesafe.ai/keys>）：

```bash
cp .env.example .env      # 然后填 TYPESAFE_API_KEY=...
```

Bun 会自动加载 `.env`（无需 dotenv 依赖），`bun run` 的脚本、直接 `bun run tools/…` 都读得到。注意**已 `export` 的环境变量优先于文件**。其他相关变量（都有默认值）：

| 变量                 | 默认                      | 说明                                                |
| -------------------- | ------------------------- | --------------------------------------------------- |
| `TYPESAFE_API_KEY`   | —                         | 托管 Jev 必填；本地端点可空                         |
| `TYPESAFE_BASE_URL`  | `https://api.typesafe.ai` | 自托管 DiffusionGemma 填本地/隧道地址               |
| `TYPESAFE_MODEL`     | `jev-latest`              |                                                     |
| `AI_NOISE_THRESHOLD` | `0.7`                     | 变体「含通用交易词缀」概率 ≥ 阈值即剔除；调低更激进 |

CI 里走仓库 Secret `TYPESAFE_API_KEY`（`sync-slang.yml` 已接好）。

合并后跑 `bun run dict:audit` 审计误报。发版仍需人工 bump `package.json` 版本并打 tag。

### 文件结构

```
xianyu-slang-helper/
├── wxt.config.ts            # manifest 生成 + 词典注入 hook
├── .oxlintrc.json / .oxfmtrc.json   # Oxc 的 lint / format 配置
├── src/
│   ├── entrypoints/
│   │   ├── background.ts    # Service worker（仅初始化设置）
│   │   ├── content/         # 内容脚本：搜索气泡 + 暗语高亮 + 详情浮层
│   │   └── popup/           # popup：4 个 tab（index.html / main.ts / style.css）
│   ├── dict/
│   │   ├── constants.ts     # 加密常量（运行时与构建期共用）
│   │   ├── crypto.ts        # AES-GCM 加解密
│   │   ├── loader.ts        # 受控查询 API，闭包持有明文
│   │   ├── matcher.ts       # 暗语匹配：trie 逐位置最长匹配（替代巨型正则）
│   │   └── types.ts         # 数据模型
├── public/icon/             # 图标（WXT publicDir = <root>/public）
├── data/
│   ├── dictionary.source.json   # 词典明文源（人类可读，维护者编辑此处）
│   └── dictionary.enc.json      # 加密产物（gitignored，构建时生成）
├── tools/                   # Bun 运行的 TS 脚本（不进发布包）
│   ├── lib/                 # 政策分档 / 风险变体 / System One 复核 / 路径
│   ├── sync-awesome.ts      # 主源同步
│   ├── sync-searchsharp.ts  # 次源同步
│   ├── audit-dict.ts        # 误报与冲突审计
│   ├── encrypt-dict.ts      # 单独生成 dictionary.enc.json
│   └── verify-dist.ts       # 构建产物安全检查
├── dist/                    # WXT 构建产物（gitignored）：chrome-mv3（发布）/ chrome-mv3-dev（调试）
└── README.md
```

## License

MIT
