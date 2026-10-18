// 发布安全检查: 对 WXT 构建产物 (dist/chrome-mv3) 做旧 package.mjs 的安全检查.
//
// 用法: 先 `bun run build`, 再 `bun run tools/verify-dist.ts`
//
// 检查项 (与旧流程一致, 只换目标目录):
//   1. 构建产物里不含 tools/ (开发用脚本绝不能进发布包)
//   2. 构建产物里不含明文 dictionary.source.json (只允许加密 bundle)
//   3. 抽样关键词在任何产物文件里都不以明文出现
// 通过后打印版本 / 文件数 / 词条数 / 分类数统计.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { DictSource } from "../src/dict/types";
import { PKG_VERSION, ROOT, SOURCE_PATH } from "./lib/paths";

const DIST_DIR = join(ROOT, "dist", "chrome-mv3");

// 抽样关键词: 从内置词典里挑几个高频词, 检查它们没有以明文出现在构建产物里.
// 注意: 改名/删词后要同步更新这个列表 (否则检查会漏检或误报).
const SAMPLE_KEYWORDS: string[] = ["茅台", "iPhone", "猫腻", "屠龙刀", "白菜价", "走咸鱼"];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...walk(full));
    } else if (e.isFile()) {
      out.push(full);
    }
  }
  return out;
}

if (!existsSync(DIST_DIR)) {
  console.error(`❌ 找不到构建产物: ${DIST_DIR}`);
  console.error("   请先运行 bun run build 生成 dist/chrome-mv3");
  process.exit(1);
}

const distFiles = walk(DIST_DIR).map((f) => relative(DIST_DIR, f));

// 1. tools/ 不应出现在构建产物里
const leakedTools = distFiles.filter((f) => f.startsWith("tools/") || f.startsWith("tools\\"));
if (leakedTools.length > 0) {
  console.error("❌ 构建产物中残留 tools/ 文件: " + leakedTools.join(", "));
  process.exit(1);
}

// 2. 不应有 source.json (明文词典)
const leakedSource = distFiles.filter((f) => f.includes("dictionary.source.json"));
if (leakedSource.length > 0) {
  console.error("❌ 构建产物中残留 source.json: " + leakedSource.join(", "));
  process.exit(1);
}

// 3. 抽样 grep: 几个高频词不应出现在任何产物文件里
const leakedKeywords: Array<{ rel: string; kw: string }> = [];
for (const rel of distFiles) {
  if (rel.endsWith(".png") || rel.endsWith(".jpg") || rel.endsWith(".ico")) continue;
  const content = readFileSync(join(DIST_DIR, rel), "utf8");
  for (const kw of SAMPLE_KEYWORDS) {
    if (content.includes(kw)) {
      leakedKeywords.push({ rel, kw });
    }
  }
}
if (leakedKeywords.length > 0) {
  console.error("❌ 构建产物文件含明文词条:");
  for (const { rel, kw } of leakedKeywords) {
    console.error(`   ${rel} <- "${kw}"`);
  }
  process.exit(1);
}

console.log("  ✓ 无 tools/ 残留");
console.log("  ✓ 无 source.json 残留");
console.log(`  ✓ 抽样 ${SAMPLE_KEYWORDS.length} 个关键词均无明文泄漏`);

// ============ 统计 ============
// source.json 由本管线读写: 断言已知形状, 结构异常时直接报错退出.
const source = JSON.parse(readFileSync(SOURCE_PATH, "utf8")) as DictSource;
if (!Array.isArray(source.categories)) {
  console.error("❌ source.json 结构异常: categories 不是数组");
  process.exit(1);
}
const entryCount = source.categories.reduce((s, c) => s + Object.keys(c.entries).length, 0);

console.log(`\n✅ 安全检查通过: ${DIST_DIR}`);
console.log(`   版本: v${PKG_VERSION}`);
console.log(`   文件: ${distFiles.length}`);
console.log(`   词条: ${entryCount} (跨 ${source.categories.length} 分类)`);
