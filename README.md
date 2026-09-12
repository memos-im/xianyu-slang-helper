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

改词典**不需要任何 build 步骤**——直接编辑明文源文件，刷新插件即生效：

```bash
$EDITOR tools/dictionary.source.json     # 改词条
# chrome://extensions/ → 刷新插件
```

加载器有两条路径，选哪条由文件是否存在**自动**决定：

| 模式 | `tools/dictionary.source.json` | 加载行为 |
|------|------------------------------|---------|
| 开发期 | 存在（明文） | 直接读明文 |
| 发布期 | 不存在（打包脚本剔除） | 回落到 `data/dictionary.enc.json` |

> 发布包里的词典是加密的，目的只是让爬虫没法 `curl + grep` 直接扒走词条列表；
> 解密 key 以明文常量放在 `data/crypto.js` 里，**没有做混淆**，缘由见该文件头部注释。

### 发布

```bash
# 先把 manifest.json 和 tools/dictionary.source.json 的 version 改成同一个值
node tools/package.mjs
```

脚本会：

1. 加密 `tools/dictionary.source.json` → `data/dictionary.enc.json`
2. 校验 manifest / source 版本对齐
3. 拷贝运行时文件到 `dist/xianyu-slang-helper/`，**剔除整个 tools/ 目录**
4. 安全检查：抽样 grep 关键词，确保 dist/ 无明文泄漏

打 zip 时**必须在包目录内部打包**——`manifest.json` 要在 zip 根目录，外面多套一层目录商店会直接拒收：

```bash
cd dist/xianyu-slang-helper && zip -qr ../xianyu-slang-helper-v1.8.0.zip .
```

只想跑一次加密、不要 `dist/`：`node tools/encrypt-dict.mjs`。

### CI 自动发布

推送 `v*` tag（如 `v1.8.0`）即触发 GitHub Actions：校验版本一致 → 打包 → 上传到 Chrome Web Store（默认草稿，到后台手动 Publish）。上面的手动打包步骤走 CI 就不用管。一次性凭据配置见 [.github/RELEASING.md](.github/RELEASING.md)。

### 文件结构

```
xianyu-slang-helper/
├── manifest.json                # MV3
├── background.js                # Service worker (仅初始化设置)
├── content.js                   # 内容脚本: 搜索气泡 + 暗语高亮
├── content.css
├── popup.html / popup.css / popup.js
├── data/
│   ├── crypto.js                # 运行时 AES-GCM 解密
│   ├── dict-loader.js           # 受控查询 API, 闭包持有明文
│   └── dictionary.enc.json      # 加密词典 (build 产物, 发布时使用)
├── tools/                       # 仅开发期, 打包时整目录剔除
│   ├── dictionary.source.json   # 词典源 (人类可读, 维护者编辑此处)
│   ├── encrypt-dict.mjs         # 单独加密脚本
│   ├── package.mjs              # 发布打包脚本 (加密 + 拷贝 + 安全检查)
│   └── fetch-searchsharp.mjs    # 从 search-sharp.com 同步众包暗语 (sync-searchsharp skill)
├── dist/                        # 打包产物 (gitignored, 上传 Web Store 用)
├── icons/
└── README.md
```

## License

MIT
