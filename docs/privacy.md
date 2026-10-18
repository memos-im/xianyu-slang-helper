---
layout: default
title: 隐私政策 · 闲鱼词典
permalink: /privacy/
---

# 隐私政策 · 闲鱼词典

**最后更新：2026-05-13**
**插件版本：v1.7.1**

## 一句话总结

本插件 **不收集、不传输、不分享任何用户数据**，全部在浏览器本地运行。

## 我们不做的事

- ❌ 不收集任何个人身份信息（PII）
- ❌ 不收集浏览记录、页面内容、搜索关键词
- ❌ 不向任何外部服务器发送数据
- ❌ 不集成统计 / 埋点 / 第三方 SDK
- ❌ 不出售、不共享、不变现任何用户信息

## 我们存什么（仅本地）

插件使用 Chrome 提供的本地存储区 `chrome.storage.local`（**永不与任何服务器同步**）保存：

| 项 | 用途 |
|---|---|
| `decodeEnabled`（布尔值） | 页面暗语高亮的开关状态 |
| `customDict`（对象） | 你通过"我的"标签手动添加的自定义词条 |

这些数据**仅在你本机**。卸载插件即清除。

## 词典是怎么工作的

插件随安装包自带一份静态加密词典（`dictionary.enc.json`）。AES-256-GCM 加密只用于**防爬虫静态抓取**——解密 key 在 `src/dict/crypto.ts` 是明文常量，解密后的内容只在内存中用于查找。完整明文词典也公开在 [GitHub 仓库](https://github.com/memos-im/xianyu-slang-helper/blob/main/data/dictionary.source.json) 的 `data/dictionary.source.json`。

## 关于内置 AI（可选功能）

当你**主动点击** popup 中的 🤖 按钮时，插件调用 [Chrome 内置 Prompt API](https://developer.chrome.com/docs/ai/prompt-api)，运行 Google 的设备本地模型 Gemini Nano，**所有计算都在你的设备上**。无任何数据离开你的电脑。

- 此功能是 **opt-in**——每次需手动点按钮才触发
- 不支持 Chrome Built-in AI 的设备**不显示此按钮**
- 推测结果会带"AI 推测"标签提醒

## 生效域名

插件**仅在以下三个域名**激活：

- `*.goofish.com`（闲鱼网页版）
- `*.xianyu.com`
- `2.taobao.com`

在其它任何网站，插件不执行任何操作。

## 权限说明

| 权限 | 用途 |
|---|---|
| `storage` | 保存你的偏好和自定义词典到本地 |
| `activeTab` | 让 popup 能读取当前活跃标签页，应用设置更改 |
| 三个闲鱼域名的 host permission | 仅在闲鱼页面注入暗语高亮的内容脚本 |

**不申请** `<all_urls>` / `webRequest` / `tabs` / `cookies` / `history` 等任何敏感权限。

## 变更说明

如果将来数据处理方式发生变更，本页将更新"最后更新"日期。

## 反馈与联系

- GitHub Issues：[https://github.com/memos-im/xianyu-slang-helper/issues](https://github.com/memos-im/xianyu-slang-helper/issues)
- 邮箱：[help@memos.im](mailto:help@memos.im)
- 如需删除任何与你相关的信息，请通过上述渠道联系（**目前不收集用户数据，所以无信息可删**）

---

## English Summary

This Chrome extension **does not collect, transmit, or share any user data**. Everything runs locally in your browser.

- No PII collection
- No browsing history or page content collection
- No data transmission to external servers
- No analytics, tracking pixels, or third-party SDKs
- No selling, sharing, or monetization of any user information

Locally stored items (in `chrome.storage.local`, never synchronized to any server):
- `decodeEnabled` boolean — whether in-page slang highlighting is enabled
- `customDict` object — your optional custom slang entries added via the popup

The extension activates only on `*.goofish.com`, `*.xianyu.com`, and `2.taobao.com`. It performs zero actions on any other site.

Contact: [help@memos.im](mailto:help@memos.im) · [GitHub Issues](https://github.com/memos-im/xianyu-slang-helper/issues)
