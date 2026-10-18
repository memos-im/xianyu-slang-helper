// 匹配器等价性测试
// 用法: bun run tools/verify-matcher.ts
//
// 为什么需要它: 用 trie 替换「单个巨型 alternation 正则」是本仓库唯一一次改动匹配内核。
// trie 与正则在**边界语义**上必须逐位对齐 —— 非重叠最左最长、大小写不敏感、返回原文切片、
// 以及非 BMP（emoji）字符的下标 —— 这些靠"耗时基准"是发现不了的（性能测试只比时间，
// 不比结果）。所以这里用参考实现（正则）+ 固定语料 + 全词典语料逐条比对匹配序列。
//
// 参考实现刻意保留旧正则写法，作为"旧行为的规范"：它被删掉之前的行为就记在这里。

import { readFileSync } from "node:fs";
import { SlangMatcher, type SlangMatch } from "../src/dict/matcher";
import type { DictSource } from "../src/dict/types";
import { SOURCE_PATH } from "./lib/paths";

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** 旧实现：全部变体按长度降序拼成一个 alternation，/gi 全局匹配 */
function referenceScan(text: string, keys: string[]): SlangMatch[] {
  const re = new RegExp(keys.map(escapeRegex).join("|"), "gi");
  const out: SlangMatch[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ start: m.index, end: m.index + m[0].length, word: m[0] });
  }
  return out;
}

const source = JSON.parse(readFileSync(SOURCE_PATH, "utf8")) as DictSource;
const keys = [...new Set(source.categories.flatMap((c) => Object.values(c.entries).flat()))]
  .filter(Boolean)
  .toSorted((a, b) => b.length - a.length);
if (keys.length === 0) throw new Error("词典为空, 无法测试");

const matcher = new SlangMatcher(keys);

// 定点用例：每条都对应一个具体的语义约束
const CASES: Array<{ what: string; text: string }> = [
  { what: "常规中文 + 英文混排", text: "iPhone 15 艾疯 全绿 蕉果 可小刀 猫腻价 克劳格会员 cld直充" },
  { what: "大小写不敏感 + 结果是原文切片", text: "小i 与 小I 都要命中" },
  { what: "非 BMP（emoji）变体与下标", text: "出 QQ 号 🐧 和 VPN 🪜 还有小红书 小🍠" },
  { what: "同一位置取最长", text: "大矿卡 与 矿卡 同现" },
  { what: "重叠候选只取最左最长", text: "16美版卡贴机 真的重叠吗" },
  { what: "跨词边界不误切", text: "eduolingo 不是词" },
  { what: "重复命中逐次返回", text: "全绿 全绿 全绿" },
  { what: "常规文案（命中词典里的成色词）", text: "九成新 包邮 支持验货 深圳发货 有意私聊" },
  { what: "空串与纯标点", text: "　，。！？ " },
];

// 全词典语料：拿词典自身造交叉文本，覆盖大量变体组合
const sample = keys.filter((_, i) => i % 7 === 0);
const corpus: string[] = [];
for (let i = 0; i + 3 < sample.length; i += 4) {
  corpus.push(`【商品 ${i}】${sample[i]} ${sample[i + 1]}，${sample[i + 2]} 现货 包邮 ${sample[i + 3] ?? ""}`);
}

const diffs: string[] = [];
const check = (label: string, text: string) => {
  const expected = referenceScan(text, keys);
  const actual = matcher.match(text);
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    diffs.push(
      `  [${label}] ${JSON.stringify(text)}\n    参考(正则): ${JSON.stringify(expected)}\n    trie      : ${JSON.stringify(actual)}`,
    );
  }
};

for (const c of CASES) check(c.what, c.text);
for (const t of corpus) check("语料", t);

console.log("=== 匹配器等价性 ===");
console.log(`  词典变体     : ${keys.length}`);
console.log(`  定点用例     : ${CASES.length}`);
console.log(`  语料条目     : ${corpus.length}`);

// 定点用例的匹配明细（人眼复核用）
console.log("\n  定点用例命中:");
for (const c of CASES) {
  const hits = matcher.match(c.text).map((m) => `${m.word}@${m.start}`);
  console.log(`    ${c.what.padEnd(24)} ${hits.length ? hits.join(" ") : "（无）"}`);
}

if (diffs.length > 0) {
  console.error(`\n❌ 与参考实现不一致 ${diffs.length} 处:`);
  for (const d of diffs.slice(0, 10)) console.error(d);
  process.exit(1);
}
console.log(`\n✅ 全部一致（${CASES.length + corpus.length} 条文本, 匹配序列逐位相同）`);
