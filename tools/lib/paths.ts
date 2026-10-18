// 工具脚本共用路径与版本 —— 版本唯一来源是 package.json.
//
// 注意: 不要用 JSON import assertion 读 package.json (Bun 运行时与类型检查的
// 行为不一致), 一律用 readFileSync 解析, 通过这里的 PKG_VERSION 取用.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url)); // tools/lib
export const TOOLS_DIR: string = dirname(HERE); // tools/
export const ROOT: string = join(TOOLS_DIR, ".."); // 仓库根

/** 词典明文源 (已从 tools/ 搬到 data/) */
export const SOURCE_PATH: string = join(ROOT, "data", "dictionary.source.json");
/** 加密词典输出 (已加入 .gitignore; 构建期由 wxt.config.ts 另行注入) */
export const ENC_OUT_PATH: string = join(ROOT, "data", "dictionary.enc.json");
/** 同步管线暂存产物 (已加入 .gitignore) */
export const AWESOME_STAGED_PATH: string = join(TOOLS_DIR, "awesome.staged.json");
export const SEARCHSHARP_STAGED_PATH: string = join(TOOLS_DIR, "searchsharp.staged.json");

interface PkgJson {
  version: string;
}

// package.json 由本仓库维护: 只取 version 字段.
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as PkgJson;

/** 版本唯一来源: package.json (source.json 里不再设 version 字段) */
export const PKG_VERSION: string = pkg.version;
