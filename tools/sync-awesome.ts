// 从 Domainsun/awesome-chinese-secondhand-slang 同步开源暗语词典
//   https://github.com/Domainsun/awesome-chinese-secondhand-slang
//
// 用法:
//   bun run tools/sync-awesome.ts                    # 预览: 抓取+过滤+暂存, 不改 source
//   bun run tools/sync-awesome.ts --apply            # 把过滤后的新词并入 dictionary.source.json
//   bun run tools/sync-awesome.ts --active-only      # 只收 liveness=active 的条目
//   bun run tools/sync-awesome.ts --include-risky    # 放行"高风险变体"(单字/短缩写/日常词)
//   bun run tools/sync-awesome.ts --deny-grey        # GREY 政策档改为排除 (默认写入)
//   bun run tools/sync-awesome.ts --allow-hard-policy # 连 HARD 政策档也写入 (默认排除, 慎用)
//   bun run tools/sync-awesome.ts --ai-review        # 用 TypeSafe System One (Jev) 复核"模板化噪音" (见 tools/lib/ai-review.ts)
//   bun run tools/sync-awesome.ts --source-url <url> # 换数据源 (默认 main 分支 raw JSON)
//
// 与 sync-searchsharp.ts 的设计差异:
//   - 该仓库不是众包投票站, 而是一个人工维护的 GitHub 数据仓 (data/slang-dictionary.json),
//     每条 entry 结构化为 { standardName, category, slangVariants[], riskLevel, liveness, ... }.
//   - 没有"赞数"维度, 但有 liveness (active / watching / killed) 与 riskLevel (safe/warning/danger).
//   - 政策黑名单分两档 (见 tools/lib/dict-shared.ts): HARD (违法) 默认排除, GREY (假货/黄牛/
//     引流等商店政策灰色题材) 默认写入并单独报告.
//
// 数据流: raw.githubusercontent --(抓取)--> 归一化 --(过滤: 政策/风险/去重[/AI])--> awesome.staged.json
//         --(--apply)--> dictionary.source.json (新概念进「社区补充」分类待人工细分)

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { DictCategory, DictSource } from "../src/dict/types";
import { aiConfig, aiConfigured, reviewItems } from "./lib/ai-review";
import type { PolicyLevel } from "./lib/dict-shared";
import {
  buildLocalIndex,
  classifyPolicy,
  isJsonObject,
  mergeVariants,
  riskyVariant,
  stringifyDict,
} from "./lib/dict-shared";
import { SOURCE_PATH, AWESOME_STAGED_PATH as STAGED_PATH } from "./lib/paths";

const DEFAULT_URL =
  "https://raw.githubusercontent.com/Domainsun/awesome-chinese-secondhand-slang/main/data/slang-dictionary.json";

// 新概念落脚分类 (该仓库分类体系与本插件 21 分类未一一对应, 先统一进「社区补充」,
// 报告里保留原始 category, 供人工细分).
const COMMUNITY_CATEGORY: { id: string; name: string; icon: string } = {
  id: "community",
  name: "社区补充",
  icon: "🌐",
};

// ============ CLI 参数 ============
const argv: string[] = process.argv.slice(2);
const hasFlag = (f: string): boolean => argv.includes(f);
const flagVal = (f: string, dflt: string): string => {
  const i = argv.indexOf(f);
  return i >= 0 ? (argv[i + 1] ?? dflt) : dflt;
};
const APPLY: boolean = hasFlag("--apply");
const ACTIVE_ONLY: boolean = hasFlag("--active-only");
const INCLUDE_RISKY: boolean = hasFlag("--include-risky");
const ALLOW_HARD_POLICY: boolean = hasFlag("--allow-hard-policy"); // 连 HARD 档也写入 (默认排除)
const DENY_GREY: boolean = hasFlag("--deny-grey"); // GREY 档改为排除 (默认写入)
const AI_REVIEW: boolean = hasFlag("--ai-review"); // 用 System One (Jev) 剔除模板化噪音
const SOURCE_URL: string = flagVal("--source-url", DEFAULT_URL);

// ============ 类型 ============
interface AwesomeEntry {
  standardName?: string;
  category?: string | null;
  slangVariants?: string[];
  riskLevel?: string | null;
  liveness?: string | null;
  explanation?: string | null;
}

interface PolicyFlag {
  level: PolicyLevel;
  label: string;
}

interface NewEntryMeta {
  awesomeCategory: string | null;
  riskLevel: string | null;
  liveness: string | null;
  explanation: string | null;
  policy: PolicyFlag | null;
}

interface NewEntry {
  name: string;
  variants: string[];
  meta: NewEntryMeta;
}

interface NewVariantsForExisting {
  existingNormal: string;
  category: string;
  newVariants: string[];
}

interface FlaggedEntry {
  name: string;
  level: PolicyLevel;
  reason: string;
  category: string | null;
  liveness: string | null;
  variants: string[];
}

interface RiskyVariantEntry {
  name: string;
  variant: string;
  reason: string;
}

interface AwesomeStats {
  entriesFetched: number;
  newEntries: number;
  newVariantsForExisting: number;
  variantsAddedToExisting: number;
  variantsAddedNew: number;
  variantsSkippedKnown: number;
  entriesFilteredPolicy: number;
  entriesPolicyFlagged: number;
  entriesPolicyFlaggedGrey: number;
  entriesPolicyFlaggedHard: number;
  variantsDroppedRisky: number;
  skippedLiveness: number;
  entriesAlreadyHave: number;
  variantsDroppedAi?: number;
}

interface AwesomeResult {
  newEntries: NewEntry[];
  newVariantsForExisting: NewVariantsForExisting[];
  filteredForPolicy: FlaggedEntry[];
  policyFlagged: FlaggedEntry[];
  riskyVariants: RiskyVariantEntry[];
  stats: AwesomeStats;
}

// ============ 抓取 ============
async function fetchDataset(): Promise<{ entries: AwesomeEntry[]; stats?: unknown }> {
  if (typeof fetch !== "function") throw new Error("需要 Node 18+ (内置 fetch)");
  const resp = await fetch(SOURCE_URL, {
    headers: { accept: "application/json", "user-agent": "xianyu-slang-helper-sync" },
  });
  if (!resp.ok) throw new Error(`抓取失败 HTTP ${resp.status} @ ${SOURCE_URL}`);
  // 外部应答不信任其形状: 先收敛为 unknown, 确认顶层是对象且 entries 是数组才读取, 否则 fail-fast.
  const body: unknown = await resp.json();
  if (!isJsonObject(body) || !Array.isArray(body.entries)) throw new Error("数据格式异常: 缺少 entries 数组");
  return { entries: body.entries, stats: body.stats };
}

// ============ 归一化 + 过滤 ============
// 返回 { newEntries, newVariantsForExisting, filteredForPolicy, riskyVariants, stats }
function categorize(entries: AwesomeEntry[], source: DictSource): AwesomeResult {
  const { normalIndex, known } = buildLocalIndex(source); // known 为运行中去重集合 (会随后续步骤增长)
  const newEntries: NewEntry[] = [];
  const newVariantsForExisting: NewVariantsForExisting[] = [];
  const filteredForPolicy: FlaggedEntry[] = [];
  const policyFlagged: FlaggedEntry[] = [];
  const riskyVariants: RiskyVariantEntry[] = [];
  let variantsSkippedKnown = 0;
  let alreadyHave = 0;
  let skippedLiveness = 0;

  for (const e of entries) {
    const name = String(e.standardName || "").trim();
    if (!name) continue;

    if (ACTIVE_ONLY && e.liveness && e.liveness !== "active") {
      skippedLiveness++;
      continue;
    }

    const variants = (e.slangVariants || []).map((v) => String(v || "").trim()).filter(Boolean);

    // 政策检查: 概念名 + 全部变体 (在剔除风险变体之前, 以免漏判).
    //   HARD 档默认排除; GREY 档默认写入但标记 (见 tools/lib/dict-shared.ts 的分档说明).
    const pol = classifyPolicy([name, ...variants]);
    let policyFlag: PolicyFlag | null = null;
    if (pol) {
      const blocked = (pol.level === "hard" && !ALLOW_HARD_POLICY) || (pol.level === "grey" && DENY_GREY);
      if (blocked) {
        filteredForPolicy.push({
          name,
          level: pol.level,
          reason: pol.label,
          category: e.category || null,
          liveness: e.liveness || null,
          variants: variants.slice(0, 8),
        });
        continue;
      }
      policyFlag = { level: pol.level, label: pol.label };
      policyFlagged.push({
        name,
        level: pol.level,
        reason: pol.label,
        category: e.category || null,
        liveness: e.liveness || null,
        variants: variants.slice(0, 8),
      });
    }

    // 变体逐一过质量闸: 风险变体出局 (除非显式放行), 已收录的丢弃
    const fresh: string[] = [];
    for (const v of variants) {
      const risk = riskyVariant(v);
      if (risk) {
        riskyVariants.push({ name, variant: v, reason: risk });
        if (!INCLUDE_RISKY) continue;
      }
      const key = v.toLowerCase();
      if (known.has(key)) {
        variantsSkippedKnown++;
        continue;
      } // 本地已有 或 本轮已收 -> 去重
      known.add(key);
      fresh.push(v);
    }

    const meta: NewEntryMeta = {
      awesomeCategory: e.category || null,
      riskLevel: e.riskLevel || null,
      liveness: e.liveness || null,
      explanation: e.explanation || null,
      policy: policyFlag,
    };

    const match = normalIndex.get(name.toLowerCase());
    if (match) {
      if (fresh.length) {
        newVariantsForExisting.push({ existingNormal: match.normalKey, category: match.catId, newVariants: fresh });
      } else {
        alreadyHave++;
      }
    } else if (fresh.length) {
      newEntries.push({ name, variants: fresh, meta });
    } else {
      alreadyHave++;
    }
  }

  return {
    newEntries,
    newVariantsForExisting,
    filteredForPolicy,
    policyFlagged,
    riskyVariants,
    stats: {
      entriesFetched: entries.length,
      newEntries: newEntries.length,
      newVariantsForExisting: newVariantsForExisting.length,
      variantsAddedToExisting: newVariantsForExisting.reduce((s, e) => s + e.newVariants.length, 0),
      variantsAddedNew: newEntries.reduce((s, e) => s + e.variants.length, 0),
      variantsSkippedKnown,
      entriesFilteredPolicy: filteredForPolicy.length,
      entriesPolicyFlagged: policyFlagged.length,
      entriesPolicyFlaggedGrey: policyFlagged.filter((f) => f.level === "grey").length,
      entriesPolicyFlaggedHard: policyFlagged.filter((f) => f.level === "hard").length,
      variantsDroppedRisky: riskyVariants.length,
      skippedLiveness,
      entriesAlreadyHave: alreadyHave,
    },
  };
}

// ============ --apply: 写回 source.json ============
function applyToSource(source: DictSource & { version?: unknown }, result: AwesomeResult): void {
  // 1) 给已有词条补充变体
  for (const item of result.newVariantsForExisting) {
    mergeVariants(source, item.category, item.existingNormal, item.newVariants);
  }

  // 2) 新概念统一进「社区补充」分类 (之后可手工细分到正式分类)
  if (result.newEntries.length) {
    let community: DictCategory | undefined = source.categories.find((c) => c.id === COMMUNITY_CATEGORY.id);
    if (!community) {
      community = { ...COMMUNITY_CATEGORY, entries: {} };
      source.categories.push(community);
    }
    for (const e of result.newEntries) {
      mergeVariants(source, COMMUNITY_CATEGORY.id, e.name, e.variants);
    }
  }

  // 3) 只更新日期 —— version 字段已废弃, 版本唯一来源是 package.json (见 tools/lib/paths.ts),
  //    发布前由人工显式 bump package.json.
  if ("version" in source) delete source.version;
  source.updatedAt = new Date().toISOString().slice(0, 10);
  writeFileSync(SOURCE_PATH, stringifyDict(source), "utf8");
}

// ============ 报告 ============
function printReport(result: AwesomeResult, applied: boolean): void {
  const s = result.stats;
  console.log("\n============== Awesome-Slang 同步报告 ==============");
  console.log(`数据源            : ${SOURCE_URL}`);
  console.log(`条目总数          : ${s.entriesFetched}${ACTIVE_ONLY ? `  (跳过非 active: ${s.skippedLiveness})` : ""}`);
  console.log(`新概念 (待归类)    : ${s.newEntries}   (变体 ${s.variantsAddedNew})`);
  console.log(`给已有词条补变体    : ${s.newVariantsForExisting} 个词条 / ${s.variantsAddedToExisting} 个变体`);
  console.log(`本地已收录(跳过)   : ${s.entriesAlreadyHave} 个条目  / 变体去重跳过 ${s.variantsSkippedKnown} 个`);
  console.log(
    `风险变体剔除       : ${s.variantsDroppedRisky} 个  (单字/短缩写/日常词${INCLUDE_RISKY ? ", 已强制放行" : ""})`,
  );
  console.log(
    `政策 HARD 排除     : ${s.entriesFilteredPolicy} 个条目  (违法题材${ALLOW_HARD_POLICY ? ", 已 --allow-hard-policy 放行" : ""})`,
  );
  console.log(
    `政策 GREY 放行     : ${s.entriesPolicyFlaggedGrey} 个条目  (假货/黄牛/引流等, 默认写入${DENY_GREY ? ", 已 --deny-grey 排除" : ", 发布前留意商店政策"})`,
  );
  if (AI_REVIEW) console.log(`AI 复核剔除        : ${s.variantsDroppedAi || 0} 个模板化噪音变体`);

  if (result.filteredForPolicy.length) {
    console.log("\n  被 HARD 政策档排除的条目 (违法题材, 人工复核):");
    for (const f of result.filteredForPolicy.slice(0, 30)) {
      console.log(`    [${f.reason}] ${f.name}  ${f.variants.slice(0, 4).join("、")}`);
    }
    if (result.filteredForPolicy.length > 30) {
      console.log(`    ... 其余 ${result.filteredForPolicy.length - 30} 个见 staged.json`);
    }
  }

  if (result.policyFlagged.length) {
    console.log("\n  政策 GREY 档放行的条目 (已/将写入, 发布前留意 Chrome Web Store 内容政策):");
    for (const f of result.policyFlagged.slice(0, 30)) {
      console.log(`    [${f.reason}] ${f.name}  ${f.variants.slice(0, 4).join("、")}`);
    }
    if (result.policyFlagged.length > 30) {
      console.log(`    ... 其余 ${result.policyFlagged.length - 30} 个见 staged.json`);
    }
  }

  if (result.riskyVariants.length) {
    console.log("\n  风险变体 (默认剔除, 需要时 --include-risky 放行):");
    for (const r of result.riskyVariants.slice(0, 20)) {
      console.log(`    '${r.variant}'  ← ${r.name}  [${r.reason}]`);
    }
    if (result.riskyVariants.length > 20) {
      console.log(`    ... 其余 ${result.riskyVariants.length - 20} 个见 staged.json`);
    }
  }

  if (result.newVariantsForExisting.length) {
    console.log("\n  给已有词条新增的变体 (样例):");
    for (const e of result.newVariantsForExisting.slice(0, 12)) {
      console.log(`    ${e.existingNormal} (${e.category}) += ${e.newVariants.slice(0, 6).join("、")}`);
    }
  }

  if (result.newEntries.length) {
    console.log("\n  全新概念 (样例, --apply 后进入「社区补充」分类待细分):");
    for (const e of result.newEntries.slice(0, 15)) {
      const tag = [e.meta?.awesomeCategory, e.meta?.liveness, e.meta?.riskLevel].filter(Boolean).join("/");
      console.log(`    ${e.name}  [${tag}]  →  ${e.variants.slice(0, 6).join("、")}`);
    }
    if (result.newEntries.length > 15) {
      console.log(`    ... 其余 ${result.newEntries.length - 15} 个见 staged.json`);
    }
  }

  console.log("\n=====================================================");
  if (applied) {
    console.log("✅ 已写入 data/dictionary.source.json");
    console.log("   下一步: git diff 复核 → 运行 bun run tools/audit-dict.ts → (发布则 bump package.json 的 version)");
  } else {
    console.log(`📋 已暂存到 ${STAGED_PATH} (未改动 source)`);
    console.log("   复核无误后, 重跑加 --apply 写入词典; 或据 staged.json 手工归类。");
  }
}

// ============ AI 复核: 剔除模板化噪音 ============
// 返回 [{ name, variant, reason, scope }]; 失败时返回 [] 并打印告警 (不阻断导入).
interface AiDroppedVariant {
  scope: string;
  name: string;
  variant: string;
  reason: string;
  score?: number;
}

async function runAiReview(result: AwesomeResult): Promise<AiDroppedVariant[]> {
  if (!aiConfigured()) {
    console.warn(
      "⚠️  --ai-review 已指定, 但未配置 TYPESAFE_API_KEY —— 跳过 AI 复核 (自托管本地端点可用 TYPESAFE_BASE_URL 免鉴权)",
    );
    return [];
  }
  const cfg = aiConfig();
  console.log(`  AI 复核: ${cfg.model} @ ${cfg.baseUrl} (阈值 ${cfg.threshold})`);
  const items: Array<{ name: string; variant: string }> = [];
  const scopes: Array<{ scope: string; name: string }> = [];
  for (const e of result.newEntries) {
    for (const v of e.variants) {
      items.push({ name: e.name, variant: v });
      scopes.push({ scope: "new", name: e.name });
    }
  }
  for (const e of result.newVariantsForExisting) {
    for (const v of e.newVariants) {
      items.push({ name: e.existingNormal, variant: v });
      scopes.push({ scope: "existing", name: e.existingNormal });
    }
  }
  if (!items.length) return [];

  let last = 0;
  const { verdicts, errors, usage, aborted } = await reviewItems(items, {
    onProgress: ({ done, total }) => {
      if (done - last >= 60 || done === total) {
        last = done;
        process.stdout.write(`\r  AI 复核 ${done}/${total}...   `);
      }
    },
  });
  process.stdout.write("\n");

  const dropped: AiDroppedVariant[] = [];
  for (const v of verdicts) {
    const scope = scopes[v.index];
    const item = items[v.index];
    if (!scope || !item) continue;
    dropped.push({
      ...scope,
      variant: item.variant,
      reason: v.reason,
      ...(v.score != null ? { score: v.score } : {}),
    });
  }

  if (errors.length) {
    console.warn(
      `⚠️  AI 复核有 ${errors.length} 条问题${aborted ? " (已提前中止, 剩余变体全部保留)" : ', 失败批次按"全部保留"处理'}:`,
    );
    for (const e of errors.slice(0, 5)) console.warn(`   - ${e}`);
  }
  if (usage) console.log(`  AI 用量: ${JSON.stringify(usage)}`);

  // 套用剔除
  const dropKey = new Set(dropped.map((d) => `${d.name} ${d.variant}`));
  result.newEntries = result.newEntries
    .map((e) => ({ ...e, variants: e.variants.filter((v) => !dropKey.has(`${e.name} ${v}`)) }))
    .filter((e) => e.variants.length);
  result.newVariantsForExisting = result.newVariantsForExisting
    .map((e) => ({ ...e, newVariants: e.newVariants.filter((v) => !dropKey.has(`${e.existingNormal} ${v}`)) }))
    .filter((e) => e.newVariants.length);

  // 同步统计
  result.stats.newEntries = result.newEntries.length;
  result.stats.newVariantsForExisting = result.newVariantsForExisting.length;
  result.stats.variantsAddedNew = result.newEntries.reduce((s, e) => s + e.variants.length, 0);
  result.stats.variantsAddedToExisting = result.newVariantsForExisting.reduce((s, e) => s + e.newVariants.length, 0);
  result.stats.variantsDroppedAi = dropped.length;
  return dropped;
}

// ============ 主流程 ============
async function main(): Promise<void> {
  if (!existsSync(SOURCE_PATH)) throw new Error(`找不到 ${SOURCE_PATH} — 请在项目根目录运行`);
  // source.json 由本管线读写: 断言已知形状 (结构异常时由后继访问自然抛错, encrypt-dict.ts 另有显式校验).
  const source = JSON.parse(readFileSync(SOURCE_PATH, "utf8")) as DictSource;

  console.log(`抓取 ${SOURCE_URL} ...`);
  const dataset = await fetchDataset();
  const result = categorize(dataset.entries, source);

  const aiDropped = AI_REVIEW ? await runAiReview(result) : [];

  const staged = {
    fetchedAt: new Date().toISOString(),
    source: SOURCE_URL,
    sourceStats: dataset.stats || null,
    params: {
      activeOnly: ACTIVE_ONLY,
      includeRisky: INCLUDE_RISKY,
      allowHardPolicy: ALLOW_HARD_POLICY,
      denyGrey: DENY_GREY,
      aiReview: AI_REVIEW,
    },
    stats: result.stats,
    newVariantsForExisting: result.newVariantsForExisting,
    newEntries: result.newEntries,
    filteredForPolicy: result.filteredForPolicy,
    policyFlagged: result.policyFlagged,
    riskyVariants: result.riskyVariants,
    aiDropped,
  };
  writeFileSync(STAGED_PATH, JSON.stringify(staged, null, 2) + "\n", "utf8");

  if (APPLY) applyToSource(source, result);
  printReport(result, APPLY);
}

main().catch((err: unknown) => {
  console.error("\n❌ " + (err instanceof Error ? err.stack || err.message : String(err)));
  process.exit(1);
});
