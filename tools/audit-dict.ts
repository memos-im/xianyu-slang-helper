// 词典误报与高危冲突扫描工具
// 用法: bun run tools/audit-dict.ts
//
// 检测逻辑:
// 1. 极短单字符 (<=1 字符): 在长文本正文中极易造成灾难级假阳性 (例如 '米', 'V', '劳')
// 2. 纯英文字母短缩写 (<=3 字符，无边界匹配时容易匹配到日常单词内部，如 'op' 命中 'laptop')
// 3. 通用高频日常词 (自然语言基础词汇，如 '大作', '水果', '那个')
// 4. 重复/自相矛盾 (同一个暗语映射到不同的正常词)

import { readFileSync } from "node:fs";
import type { DictSource } from "../src/dict/types";
import { COMMON_CHINESE_WORDS } from "./lib/dict-shared";
import { SOURCE_PATH } from "./lib/paths";

// source.json 由本管线读写: 断言已知形状 (结构异常时由后继访问自然抛错, encrypt-dict.ts 另有显式校验).
const source = JSON.parse(readFileSync(SOURCE_PATH, "utf8")) as DictSource;

interface RiskItem {
  slang: string;
  normal: string;
  category: string;
  reason: string;
}

interface DuplicateSlang {
  slang: string;
  conflict: Array<{ normal: string; category: string }>;
}

interface RiskReport {
  singleChar: RiskItem[];
  commonWordCollision: RiskItem[];
  shortAsciiRisk: RiskItem[];
  duplicateSlangs: DuplicateSlang[];
}

const report: RiskReport = {
  singleChar: [],
  commonWordCollision: [],
  shortAsciiRisk: [],
  duplicateSlangs: [],
};

const slangToNormalMap = new Map<string, { normal: string; category: string }>();

const totalCategories = source.categories.length;
let totalEntries = 0;
let totalSlangs = 0;

for (const cat of source.categories) {
  for (const [normal, slangs] of Object.entries(cat.entries)) {
    totalEntries++;
    for (const slang of slangs) {
      totalSlangs++;
      const s = slang.trim();

      // 1. 重复暗语冲突
      const prev = slangToNormalMap.get(s);
      if (prev) {
        report.duplicateSlangs.push({
          slang: s,
          conflict: [prev, { normal, category: cat.id }],
        });
      } else {
        slangToNormalMap.set(s, { normal, category: cat.id });
      }

      // 2. 单字符 (无论中文英文符号)
      if (s.length === 1) {
        report.singleChar.push({
          slang: s,
          normal,
          category: cat.id,
          reason: "单字匹配：在无上下文时长文本中极易误伤普通商品",
        });
      }

      // 3. 通用高频词命中
      if (COMMON_CHINESE_WORDS.has(s)) {
        report.commonWordCollision.push({
          slang: s,
          normal,
          category: cat.id,
          reason: "现代汉语高频词：单独出现时大概率代表原本字面含义",
        });
      }

      // 4. 短 ASCII 缩写 (2-3 字母，如果在中文或英文句子中无 word boundary 界定)
      if (/^[a-zA-Z0-9]{1,3}$/.test(s)) {
        report.shortAsciiRisk.push({
          slang: s,
          normal,
          category: cat.id,
          reason: "短英文/数字：易匹配到品牌型号或正常英文单词子串 (如 op -> laptop, by -> standby)",
        });
      }
    }
  }
}

console.log("================ 词典误报与冲突审计报告 ================");
console.log(`统计: ${totalCategories} 个分类 | ${totalEntries} 个概念 | ${totalSlangs} 个暗语变体\n`);

console.log(`🚨 【高危】单字符暗语 (${report.singleChar.length} 个):`);
console.log("   问题：当前正则为全局匹配，任何包含该字的商品标题都会被错误高亮！");
for (const item of report.singleChar) {
  console.log(`   - '${item.slang}' -> ${item.normal} [${item.category}]`);
}

console.log(`\n⚠️  【高危】通用日常词碰撞 (${report.commonWordCollision.length} 个):`);
console.log("   问题：日常商品词，极易产生假阳性高亮");
for (const item of report.commonWordCollision) {
  console.log(`   - '${item.slang}' -> ${item.normal} [${item.category}]`);
}

console.log(`\n⚠️  【中危】短字母/拼音缩写 (${report.shortAsciiRisk.length} 个):`);
console.log("   问题：英文大小写不敏感且无单词边界时，易命中其他单词子串");
for (const item of report.shortAsciiRisk) {
  console.log(`   - '${item.slang}' -> ${item.normal} [${item.category}]`);
}

if (report.duplicateSlangs.length > 0) {
  console.log(`\n⚠️  【冲突】重复暗语映射 (${report.duplicateSlangs.length} 个):`);
  for (const item of report.duplicateSlangs) {
    console.log(
      `   - '${item.slang}' 同时映射到:`,
      item.conflict.map((c) => `${c.normal}(${c.category})`).join(" VS "),
    );
  }
}

console.log("\n========================================================");
