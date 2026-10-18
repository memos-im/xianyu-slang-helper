# AGENTS.md

本文件为在本仓库工作的 agent 提供指引。

## What this is

一个 Manifest V3 Chrome/Edge 扩展（「闲鱼词典」/ Xianyu Dictionary），帮助用户看懂闲鱼 /
Goofish 二手交易里的暗语（黑话）。在 `goofish.com` / `xianyu.com` / `2.taobao.com` 上做三件事：

- **搜索建议** — 在站内搜索框输入常规词，弹出暗语变体，点击即替换。
- **行内解读** — 高亮商品标题/描述中的暗语，悬停出 tooltip；浮动按钮汇总全页暗语。
- **Popup 工具** — 翻译面板、分类浏览、用户自定义词典、可选的本地 AI 兜底（Chrome 内置 AI / Gemini Nano）。

技术栈：**WXT 0.21 + TypeScript + Bun**。无 UI 框架（纯 DOM）。`manifest.json` 由 WXT 生成，
**不在仓库里**。

## Commands

```bash
bun install                 # 装依赖；postinstall 会跑 `wxt prepare` 生成 .wxt/ 类型

bun run dev                 # WXT 开发模式：起 dev server + 构建到 dist/chrome-mv3-dev
bun run build               # 构建 → dist/chrome-mv3
bun run zip                 # 打包成可上传商店的 zip → dist/*-chrome.zip（manifest 在 zip 根目录）
bun run verify:dist         # 对构建产物做安全检查（无 tools/、无明文词典、抽样关键词不泄漏）
bun run release:build       # build + verify:dist + zip（CI 与本地发版走同一条路）

bun run compile             # bun check —— 类型检查（等价 tsc --noEmit，走 typescript-go 移植）
bun run lint                # oxlint —— 正确性/可疑/性能三类规则
bun run fmt                 # oxfmt --write —— 格式化
bun run fmt:check           # 只校验格式（CI 用）
bun run verify              # 上面三者串起来跑（release.yml 的发版闸门）

bun run dict:sync           # 从 awesome-chinese-secondhand-slang 同步暗语（预览，加 --apply 才写入）
bun run dict:sync:searchsharp   # 从 search-sharp.com 同步（尽力而为的次源）
bun run dict:audit          # 审计词典误报/冲突（单字、短缩写、日常词、重复映射）
bun run dict:encrypt        # 单独重新生成 data/dictionary.enc.json
```

> **工具链取向：只加 Oxc，不引 ESLint / Prettier / Biome**。lint 用 `oxlint`、格式化用 `oxfmt`
> （同一个 Rust 项目，配置在 `.oxlintrc.json` / `.oxfmtrc.json`）。Bun 1.4.3 自带 `bun check`
> 但没有 `bun lint` / `bun fmt`；等它们进 stable 后再把 `lint` / `fmt` 脚本换成 `bun lint` /
> `bun fmt` 即可，不需要回到 ESLint 生态。
>
> `.oxlintrc.json` 里关掉了四条**刻意违反**的规则，改前先读那里的注释（串行限流、
> content script 的内联函数、`_` 前缀私有约定、console 输出报告）。

## Architecture

### 目录

```
wxt.config.ts          # manifest 生成 + 词典注入 hook + __APP_VERSION__ define
src/
  entrypoints/
    background.ts      # service worker（仅在首次安装时写默认开关）
    content/           # 内容脚本：搜索建议 + 高亮 + 详情浮层（+ style.css）
    popup/             # popup：4 个 tab（+ index.html / style.css）
  dict/
    constants.ts       # 加密常量：PASSPHRASE / SALT_HEX / 迭代次数 / 文件名 / 匹配规则
    types.ts           # 数据模型与 API 返回类型
    crypto.ts          # AES-GCM 加解密（运行时解密 + 构建期加密，同一实现）
    loader.ts          # 词典查询 API（唯一入口，闭包私有 + 冻结导出）
public/icon/           # 图标（WXT 的 publicDir 默认是 <root>/public，不是 <srcDir>/public）
tools/
  lib/dict-shared.ts   # 政策分档、风险变体判定、source.json 序列化、本地索引
  lib/ai-review.ts     # TypeSafe System One (Jev) 噪音复核
  lib/paths.ts         # 仓库路径 + 版本读取
  sync-awesome.ts      # 主源导入
  sync-searchsharp.ts  # 次源导入
  audit-dict.ts        # 词典审计
  encrypt-dict.ts      # 生成 data/dictionary.enc.json
  verify-dist.ts       # 构建产物安全检查
  dictionary.grey-area.json  # 敏感分类备份（gitignored）
data/
  dictionary.source.json     # 词典明文源（人类可编辑）
  dictionary.enc.json        # 加密产物（gitignored，构建时生成）
docs/                  # Jekyll 站点（GitHub Pages 营销页），不属于扩展
store-assets/          # Chrome Web Store 文案/隐私政策/审核员说明
```

### 三个运行时上下文

- **Content script**（`src/entrypoints/content/index.ts`）— 搜索建议面板，以及用 `MutationObserver`
  配合 `TreeWalker` 做暗语高亮、FAB/侧滑详情面板。由 `defineContentScript` 声明匹配规则与 `run_at`。
- **Popup**（`src/entrypoints/popup/`）— 4 个 tab（翻译 / 词典 / 我的 / 关于）。**唯一**运行
  AI 兜底（Chrome 内置 AI）的地方。
- **Background**（`src/entrypoints/background.ts`）— 只在首次安装时设 `decodeEnabled: true`。

### 词典加载管线（核心设计）

`src/dict/loader.ts` 是词典数据的**唯一入口**，导出一个 `Object.freeze` 的 `xyDict` 命名空间。
数据来源自动选择：

- **开发期** — `wxt.config.ts` 的 `build:publicAssets` hook 把 `data/dictionary.source.json`（明文）
  注入产物根目录，loader 直接读，免解密。
- **发布期** — 同一 hook 改为注入 `dictionary.enc.json`（AES-GCM 密文），loader 走
  `src/dict/crypto.ts` 解密。明文文件在发布包里不存在，明文分支 404 后自动回落。

解密后的明文只存在于 `loader.ts` 的模块作用域里 —— **永不挂到 `window`/`self`**。
ES module 的顶层绑定天然不可枚举、不可写，比旧版 IIFE 的 `defineProperty` 更严。
外部只能调用按需查询函数（`suggestSlangsFor` / `decodeText` / `getCategoryEntries` / …），
**不存在**一次性 dump 整本词典的接口。这是刻意的防抓取边界，不是随手写的。

`buildIndexes()` 派生：正向表（normal → slangs）、反向表（slang → normals）、以及一个合成
`RegExp`（暗语交替、长者优先）用于扫描页面文本。用户自定义词典（`storage.local.customDict`）
作为一个合成 `custom` 分类并入；`storage.onChanged` 监听会失效并重建索引。

### 加密（防爬虫，不是防逆向）

AES-256-GCM，密钥由 PBKDF2-SHA256（100k 轮，固定 salt）派生。**口令是明文常量**
（`src/dict/constants.ts`）——目的是阻止 `curl | grep` 式静态抓取，而不是对审核员或逆向者隐藏。
**不要**"加固"成混淆密钥，那与设计意图和商店审核说明相矛盾。理由写在 `src/dict/crypto.ts`
头部注释和 `store-assets/reviewer-notes.md`。

运行时解密与构建期加密**共用同一份实现**（WebCrypto 在浏览器和 Node 20+ 都可用），
所以常量与算法不可能两侧漂移。

## Invariants — 容易踩，会咬人

- **版本唯一来源是 `package.json`**。`wxt.config.ts` 把它写进 manifest，CI 校验 `tag == package.json.version`。
  词典数据**不再**携带 version（旧的 manifest/source 双写不变量已废除）。
- **加密常量只在 `src/dict/constants.ts` 定义一次**，运行时与构建期共用。改口令/salt/迭代次数
  只需改这里；改错了会导致解密静默失败。
- **`manifest.json` 不在仓库里**：改权限/匹配规则请改 `wxt.config.ts`，改匹配规则还要同步
  `src/dict/constants.ts` 的 `DICT_MATCHES`（manifest 与 `web_accessible_resources` 共用）。
- **`verify-dist.ts` 的 `SAMPLE_KEYWORDS`** 断言这些词不出现在任何构建产物里。从词典里
  删掉/改名这些词时要同步更新，否则检查会变成空转。
- **明文词典永远不进产物**：`data/dictionary.source.json` 只允许出现在开发模式产物里
  （由 hook 的 `mode === "development"` 分支注入）。改动 hook 时务必保住这一点。

## 词典导入管线

两个上游源，先"暂存 → 人审 → `--apply`"：

- **`awesome-chinese-secondhand-slang`**（主源）— 人工维护的 GitHub 数据仓，
  `{ standardName, category, slangVariants[], riskLevel, liveness, explanation }`。用 `dict:sync`。
- **`search-sharp.com`**（次源）— 众包 UGC，噪音与违规词都多。用 `dict:sync:searchsharp`；
  它用保守的 `policyHit()`（任一档命中即排除）。

**政策分两档**（`tools/lib/dict-shared.ts`）：

| 档   | 内容                                                                  | 默认               | 翻转开关              |
| ---- | --------------------------------------------------------------------- | ------------------ | --------------------- |
| HARD | 违法题材（色情服务/毒品/武器/赌博/盗号洗钱/涉未成年）                 | **排除**           | `--allow-hard-policy` |
| GREY | 商店政策灰色（假货仿品/黄牛代抢/引流养号/社保代缴/活体宠物/医疗减肥） | **写入**并单独报告 | `--deny-grey`         |

**风险变体**（单字、纯 ASCII ≤3、通用日常词）默认剔除 —— 词典用无边界全局正则匹配，
这些词会造成灾难级误报。`--include-risky` 可放行。

**System One 复核**（`tools/lib/ai-review.ts`）— `--ai-review` 用 TypeSafe **Jev** 判别模型
（不生成文本，返回校准概率；自托管 DiffusionGemma 同 API）剔除"对词典没有增量"的变体。

判定只问一个原子问题：**「变体里是否含有通用交易词缀」**（现货/包邮/秒杀/学习位/诚心出…），
`noul ≥ AI_NOISE_THRESHOLD`（默认 0.7）即剔除。

为什么一个问题就够：扫描用**无边界子串匹配**（`src/dict/loader.ts` 的 `buildIndexes`），
`哈基米现货` 本来就会被已有的 `哈基米` 命中 —— 含通用词缀 ≈ 对词典没有增量。

> 试过再加一个 `core` 问题（「去掉词缀后剩下的是不是独立暗语」）当第二道闸，实测不划算并已删除：
> `core` 的 noul 中位 0.60、>0.9 仅 1%（Jev 对这个问题没把握），`filler` 中位 0.47、>0.9 占 42%。
> 加上 `core` 只换来少 2 个误杀，代价是多留约 270 个冗余变体。

同批共用 `state`，env 还支持 `TYPESAFE_API_KEY`（本地端点可空）/ `TYPESAFE_BASE_URL` /
`TYPESAFE_MODEL`。失败不阻断导入。

新概念统一落在 `社区补充` 分类（上游分类体系与本扩展分类未一一对应），供人工细分。
`.github/workflows/sync-slang.yml` 每周一自动跑两个源并开 PR；它不推主干、不发版。

## CI

- `.github/workflows/release.yml` — 推 `v*` tag 触发：校验 `tag == package.json` → `bun run release:build`
  → 上传 Chrome Web Store（**默认草稿**，去后台手动 Publish）。凭据配置见 `.github/RELEASING.md`。
- `.github/workflows/sync-slang.yml` — 每周定时同步词典并开 PR 供人审。
