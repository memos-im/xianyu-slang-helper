// 加密词典构建脚本
// 用法: bun run tools/encrypt-dict.ts
// 输入: data/dictionary.source.json (plaintext, 人类可读)
// 输出: data/dictionary.enc.json (AES-GCM 密文 base64)
//
// 加密目的: 防止外部爬虫脚本静态抓取黑话词条列表.
// 注意这不是代码混淆, 解密口令在 src/dict/constants.ts 是明文常量,
// 审核员可以直接读到. 加密实现与运行时共用同一份代码 (src/dict/crypto.ts),
// 行为与 wxt.config.ts 的构建期注入逻辑一致. 版本唯一来源是 package.json.

import { readFileSync, writeFileSync } from "node:fs";
import { encryptSource } from "../src/dict/crypto";
import type { DictSource } from "../src/dict/types";
import { ENC_OUT_PATH, PKG_VERSION, SOURCE_PATH } from "./lib/paths";

// ============ Build ============
async function build(): Promise<void> {
  // source.json 由本管线读写: 断言已知形状, 下面逐项做显式结构校验.
  const source = JSON.parse(readFileSync(SOURCE_PATH, "utf8")) as DictSource;

  // 校验结构
  if (!Array.isArray(source.categories)) {
    throw new Error("source.categories 必须是数组");
  }

  let entryCount = 0;
  let slangCount = 0;
  for (const cat of source.categories) {
    if (!cat.id || !cat.name || typeof cat.entries !== "object") {
      throw new Error(`分类 "${cat.id || cat.name || "?"}" 结构不完整`);
    }
    for (const [normal, slangs] of Object.entries(cat.entries)) {
      if (!Array.isArray(slangs) || slangs.length === 0) {
        throw new Error(`词条 "${normal}" (分类 ${cat.id}) 的值必须是非空数组`);
      }
      entryCount++;
      slangCount += slangs.length;
    }
  }

  // 加密 (与运行时同一份实现; 版本取 package.json, 不再读 source.version)
  const bundle = await encryptSource(source, PKG_VERSION);
  writeFileSync(ENC_OUT_PATH, JSON.stringify(bundle, null, 2) + "\n", "utf8");

  console.log("✓ 加密成功");
  console.log(`  版本: ${bundle.version} (${bundle.updatedAt})`);
  console.log(`  分类: ${bundle.stats.categories}`);
  console.log(`  词条: ${bundle.stats.entries} (${bundle.stats.slangs} 个黑话变体)`);
  console.log(`  输出: ${ENC_OUT_PATH}`);
  console.log(`  校验: ${bundle.checksum}`);
}

build().catch((err: unknown) => {
  console.error("❌ " + (err instanceof Error ? err.stack || err.message : String(err)));
  process.exit(1);
});
