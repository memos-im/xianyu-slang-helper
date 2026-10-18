# 发布流程 (CI → Chrome Web Store)

`.github/workflows/release.yml` 把「构建 + 加密 + 打包 + 上传」自动化。**前提是扩展已在
Chrome Web Store 手动发布过至少一次**（拿到 extension id），且配好下面 4 个 Secrets。

---

## 一、一次性配置（只做一次）

### 1. 拿到 Chrome Web Store API 凭据

1. 打开 [Google Cloud Console](https://console.cloud.google.com/) → 新建（或选一个）项目。
2. **APIs & Services → Library** → 搜索 **Chrome Web Store API** → Enable。
3. 配置 OAuth（新版叫 **Google Auth Platform**，已没有单独的 “OAuth consent screen” 页）：
   点 **Get started** → _App Information_ 填应用名 + 支持邮箱 → **_Audience_ 这一步选 `External`**
   （“External” 现在藏在这里；`Internal` 仅 Google Workspace 组织账号才有）→ 填联系邮箱 →
   同意 → 创建。完成后到左侧 **Audience → Test users → Add users**，把你管理扩展的那个
   Google 账号加进去（Testing 模式下只有测试用户能完成下一步授权）。
4. 左侧 **Clients → Create client** → Application type 选 **Desktop app** → 创建 →
   记下 **Client ID** 和 **Client secret**。

   > **别选 "Chrome Extension"**——名字最像，用途完全不同：那个是给扩展内部用
   > `chrome.identity` 让**终端用户**登录 Google 的，绑定 extension ID 且不给 client secret。
   > 这里要的是 CI 以**你自己开发者身份**调 API，必须是 **Desktop app**（带 secret，
   > 且默认允许 loopback 回调，下一步的取 token 工具正是靠这个）。
   >
   > Google 官方文档里写的是 "Web application"，那是配合 OAuth Playground 手动换 token 的
   > 另一条路线，需要注册固定 redirect URI，跟这里用的工具对不上，别混着抄。

5. **把 OAuth 应用发布到生产**（别跳过，否则 token 一周就废）：
   左侧 **Audience** → **Publish app**，把 Publishing status 从 `Testing` 改成 `In production`。

   > Google 的规则：**External + Testing** 状态下签发的 refresh token **7 天后过期**。
   > 只发过一次版就再也传不上去，基本都是这个原因。改成 In production 后 token 不再定期过期
   > （除非你主动撤销、连续 6 个月未使用、或同一账号对同一 client 的 token 超过 100 个）。
   >
   > 这个扩展只有你自己在用这套凭据，所以**不需要**走 Google 的应用验证（verification）。
   > 未验证应用在授权时会多一屏 “Google hasn't verified this app”，点
   > **Advanced → Go to ... (unsafe)** 继续即可，不影响使用。

6. 换取 **refresh token**——最省事的方式，本地跑官方助手按提示操作：

   ```bash
   npx -y chrome-webstore-upload-keys
   ```

   它会引导你用浏览器授权，最后把 **client ID / client secret / refresh token 三个值一起打印**。

   > refresh token 是**绑定在特定 OAuth client 上**的。如果这轮你新建了 client，
   > 那 `CHROME_CLIENT_ID` 和 `CHROME_CLIENT_SECRET` 也得跟着一起换，
   > 只更新 refresh token 照样会 `invalid_grant`。拿不准就三个一起更新。

### 2. 拿到 extension id

Chrome Web Store 开发者后台 → 选中你的扩展 → URL 里 `.../detail/<这一长串>` 就是 extension id。

### 3. 写入 GitHub Secrets

仓库 **Settings → Secrets and variables → Actions → New repository secret**，加 4 个：

| Secret 名              | 值                         |
| ---------------------- | -------------------------- |
| `CHROME_EXTENSION_ID`  | 扩展 id                    |
| `CHROME_CLIENT_ID`     | OAuth client id            |
| `CHROME_CLIENT_SECRET` | OAuth client secret        |
| `CHROME_REFRESH_TOKEN` | 上一步拿到的 refresh token |

---

## 二、每次发版

1. 改完词典后，**只改 `package.json` 的 `version`**（版本唯一来源；`wxt.config.ts` 会把它写进
   manifest，不再有 manifest / dictionary.source.json 双写不变量）。
2. 提交并打 tag（tag 号要和 version 对上，带 `v` 前缀）：
   ```bash
   git commit -am "release: v1.9.1"
   git tag v1.9.1
   git push && git push --tags
   ```
3. CI 自动跑：校验 tag == package.json → `bun run release:build`（`wxt build` → `verify-dist` 安全检查 → `wxt zip`）→ **上传为草稿** → 把 zip 附到 GitHub Release。
4. 去 [开发者后台](https://chrome.google.com/webstore/devconsole) 看一眼新版本，点 **Publish** 提交审核。

> **本地想走同一条路**：`bun run release:build`，产物在 `dist/`（`*-chrome.zip` 里 manifest.json 已在根目录）。

> **想跳过手动点发布**：在 Actions 页手动运行本工作流（workflow_dispatch），勾上 `publish=true`，
> CI 会直接提交审核。**但**这会把内容直接送审/上线，建议仅在你已本地 `git diff` 过词典后使用。

---

## 排障

### CI 报 `invalid_grant` / `Error: Bad Request`

refresh token 失效了。工作流有一步「预检 refresh token」会提前拦下并打印这条错误，
构建不会白跑。修法：

1. 先确认 OAuth 应用的 Publishing status 是 **In production** 而不是 Testing
   （Google Auth Platform → Audience）。Testing 状态签发的 token **7 天就过期**，
   不改这里，换多少次新 token 都是一周后再挂一次。
2. 重新换一个 token 并更新 Secret `CHROME_REFRESH_TOKEN`：
   ```bash
   npx -y chrome-webstore-upload-keys
   ```
3. 回 Actions 页面 **Re-run failed jobs**（tag 已经在，不用重新打 tag）。

其他会让 refresh token 失效的情况：手动撤销了应用授权、连续 6 个月没用过、
同一 Google 账号对同一 OAuth client 的 token 超过 100 个（最旧的会被静默作废）。

### 上传挂了但我想先手动传

不用重跑构建。打包好的 zip 在 **Actions run 页面底部的 Artifacts**
（`xianyu-slang-helper-v<版本>`，保留 30 天），下载后直接传开发者后台即可 ——
它的 `manifest.json` 已经在 zip 根目录，符合商店要求。

---

## 注意

- **审核仍在**：API 的「发布」只是自动提交，Google 照样人工审，通常几小时到几天，不是秒上线。
- **草稿是默认**：tag 触发永远只上传草稿，正是为了防止擦边词未经过目直接推给用户。
- **安全加固（可选）**：把 `mnao305/chrome-webstore-upload@v5`、`softprops/action-gh-release@v2`
  这类第三方 action 钉到具体 commit SHA，可防上游被篡改。
- **Edge 商店**：另有一套 Partner Center API，需要可再加一个 job，本工作流暂只发 Chrome。
