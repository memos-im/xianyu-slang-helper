# Privacy Policy — 闲鱼词典 (Xianyu Dictionary)

**Last updated: 2026-05-13**
**Extension version: 1.6.0**

## TL;DR
This extension does **not collect, transmit, or share any user data**. Everything runs locally in your browser.

## What we don't do
- ❌ We do not collect personally identifiable information (PII)
- ❌ We do not collect browsing history, page contents, or search queries
- ❌ We do not send any data to external servers
- ❌ We do not use analytics, tracking pixels, or third-party SDKs
- ❌ We do not sell, share, or monetize any user information

## What is stored locally
The extension uses `chrome.storage.local` (a Chrome-provided local storage area, never synchronized to any server) to remember:

| Item | Purpose |
|------|---------|
| `decodeEnabled` (boolean) | Whether the in-page slang highlight is enabled |
| `customDict` (object) | Your personal custom slang entries that you manually add through the "我的词典" tab |

This data resides **only on your computer**. Uninstalling the extension removes it.

## How the dictionary works
The extension ships with a static, locally-bundled slang dictionary (`data/dictionary.enc.json`). The file is AES-256-GCM encrypted purely as a static-scraping deterrent — encryption key is in plain sight inside `data/crypto.js`, and the decrypted dictionary is used only in-memory for matching. The full plaintext source is also published in the project's public source repository.

## Built-in AI (optional)
When you click the **🤖 用本地 AI 试试解读** button in the popup, the extension calls Chrome's [Built-in Prompt API](https://developer.chrome.com/docs/ai/prompt-api), which runs Google's on-device Gemini Nano model **entirely on your computer**. No data leaves your device. The button is opt-in (you must click it each time) and only appears when Built-in AI is available on your system.

## Where the extension runs
The extension activates only on:
- `*.goofish.com` (Xianyu)
- `*.xianyu.com`
- `2.taobao.com`

On every other website, the extension does nothing.

## Permissions explained
| Permission | Purpose |
|------------|---------|
| `storage` | Save your preferences and custom dictionary locally |
| `activeTab` | Read the currently focused tab to inject slang highlighting on Xianyu pages |
| Host permissions for Xianyu domains | Inject the slang-highlight content script on those pages only |

## Changes to this policy
If we ever change how data is handled, this page will be updated with a new "Last updated" date.

## Contact
For questions, bug reports, or removal requests:
- GitHub Issues: https://github.com/memos-im/xianyu-slang-helper/issues
- Email: help@memos.im

---

# 中文版本

## 一句话
本插件 **不收集、不传输、不分享任何用户数据**，全部在浏览器本地运行。

## 我们不做的事
- ❌ 不收集任何个人身份信息
- ❌ 不收集浏览记录、页面内容、搜索关键词
- ❌ 不向任何外部服务器发送数据
- ❌ 不集成统计/埋点/第三方 SDK
- ❌ 不出售、不共享、不变现任何用户信息

## 本地存储的内容
插件使用 `chrome.storage.local`（Chrome 提供的本地存储，永不与任何服务器同步）保存：

| 项 | 用途 |
|----|------|
| `decodeEnabled` | 页面暗语高亮的开关状态 |
| `customDict` | 你通过"我的词典"标签手动添加的自定义词条 |

这些数据仅在你本机。卸载插件即清除。

## 内置 AI（可选）
点击 popup 中 🤖 按钮时，插件调用 Chrome 内置的 Prompt API（设备本地运行的 Gemini Nano 模型），**数据不离开你的设备**。此功能是 opt-in，每次需手动点击触发；不支持的系统不显示按钮。

## 生效域名
仅在 `*.goofish.com / *.xianyu.com / 2.taobao.com` 生效，其它网站完全不工作。

## 反馈
- GitHub Issues：https://github.com/memos-im/xianyu-slang-helper/issues
- 邮箱：help@memos.im
