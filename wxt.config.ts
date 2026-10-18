import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "wxt";
import { DICT_MATCHES, ENC_FILE, PLAIN_FILE } from "./src/dict/constants";
import { encryptSource } from "./src/dict/crypto";
import type { DictSource } from "./src/dict/types";

const pkg = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf8")) as { version: string };
const sourcePath = resolve(__dirname, "data/dictionary.source.json");

export default defineConfig({
  srcDir: "src",
  // 默认是隐藏的 ".output/", 而 macOS Finder / Chrome 的目录选择器默认不显示隐藏目录,
  // 「加载已解压的扩展程序」时选不中。换成非隐藏的 dist/（已在 .gitignore 里）。
  outDir: "dist",
  manifest: {
    name: "闲鱼词典",
    description: "在闲鱼搜索时自动建议暗语；浏览时自动解读商品标题/描述中的暗语；词典分类整理 + 加密打包",
    version: pkg.version,
    permissions: ["storage", "activeTab"],
    host_permissions: DICT_MATCHES,
    action: { default_title: "闲鱼词典" },
    icons: {
      16: "icon/icon16.png",
      32: "icon/icon32.png",
      48: "icon/icon48.png",
      128: "icon/icon128.png",
      512: "icon/icon512.png",
    },
    web_accessible_resources: [{ resources: [ENC_FILE, PLAIN_FILE], matches: DICT_MATCHES }],
  },
  vite: () => ({
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    optimizeDeps: {
      // 默认扫描会 glob 整个项目根的 **/*.html，把构建产物也算进去。
      // 原来的输出目录是隐藏的 .output/，被 glob 的 dot:false 顺带排除了；
      // 改成非隐藏的 dist/ 后，dist/chrome-mv3-dev/popup.html 会被扫描，而 WXT 正在
      // 并发重写它 -> [UNRESOLVED_ENTRY] Cannot resolve entry module dist/chrome-mv3-dev/popup.html。
      // 显式限定入口，顺带把 docs/（Jekyll 站点）也排除在扫描之外。
      entries: ["src/entrypoints/**/*.{html,ts}"],
    },
  }),
  hooks: {
    // 词典不进版本控制也不用落在 public/：构建/开发时按需注入。
    //  - 开发期注入明文，loader 直接读（免解密，改词典即刻生效）
    //  - 发布期注入密文，loader 走 AES-GCM 解密
    "build:publicAssets": async (wxt, files) => {
      const raw = readFileSync(sourcePath, "utf8");
      if (wxt.config.mode === "development") {
        files.push({ relativeDest: PLAIN_FILE, absoluteSrc: sourcePath });
        return;
      }
      const source = JSON.parse(raw) as DictSource;
      const bundle = await encryptSource(source, pkg.version);
      files.push({ relativeDest: ENC_FILE, contents: `${JSON.stringify(bundle, null, 2)}\n` });
    },
    // 让 browser.runtime.getURL(DICT_FILE) 通过类型检查
    "prepare:publicPaths": (_wxt, paths) => {
      paths.push(ENC_FILE, PLAIN_FILE);
    },
  },
});
