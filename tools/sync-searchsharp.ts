// 从 search-sharp.com 抓取众包暗语, 质量/政策过滤后并入本项目词典
// 用法:
//   bun run tools/sync-searchsharp.ts                 # 预览: 只抓取+过滤+暂存, 不改 source
//   bun run tools/sync-searchsharp.ts --apply         # 把过滤后的新词并入 dictionary.source.json
//   bun run tools/sync-searchsharp.ts --max-pages 2   # 只抓前 2 页 (调试/限流)
//   bun run tools/sync-searchsharp.ts --min-score 3   # 提高保留门槛 (净赞数, 默认 1)
//
// 设计:
//   - search-sharp.com 是一个 React SPA, 数据来自公开只读 API:
//       GET /api/products?q=&sort=new&offset=<N>  ->  { products:[{name, aliases[], keywords[{text,up,down}]}], hasMore }
//     offset 以"记录"为单位 (页大小 20), hasMore=false 时停止.
//   - 它是众包站点 (投票 / 待审核 / Google 登录提交), 所以数据里混着玩梗与违规词,
//     不能直接照搬. 本脚本做三层过滤: 质量(净赞) -> 政策(违规黑名单) -> 去重(本地已有).
//   - 默认只"暂存"到 tools/searchsharp.staged.json + 打印报告, 不动 source;
//     人工/Claude 审过报告后再 --apply 或手工归类. (政策命中项永远不会被 --apply 写入.)
//
// 数据流: search-sharp.com/api --(抓取)--> 归一化 --(过滤)--> staged.json --(--apply)--> dictionary.source.json

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { DictCategory, DictSource } from "../src/dict/types";
import { buildLocalIndex, isJsonObject, mergeVariants, policyHit, stringifyDict } from "./lib/dict-shared";
import { SOURCE_PATH, SEARCHSHARP_STAGED_PATH as STAGED_PATH } from "./lib/paths";

const BASE = "https://search-sharp.com";
const PAGE_SIZE = 20;
const REQUEST_DELAY_MS = 400; // 礼貌限流: 站点在 Cloudflare 后面, 别打太猛

// 投放到 source.json 的"新概念"落脚分类 (SearchSharp 没有可用分类, 全是"用户添加").
// 先统一进这个分类, 之后可在 source.json 内手工细分到 15 个正式分类。
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
const MAX_PAGES: number = parseInt(flagVal("--max-pages", "0"), 10) || Infinity;
const MIN_SCORE: number = parseInt(flagVal("--min-score", "1"), 10);

// ============ 类型 ============
interface SearchSharpVote {
  text?: string;
  up?: number | null;
  down?: number | null;
}

interface SearchSharpProduct {
  id?: number | string | null;
  name?: string;
  aliases?: Array<string | SearchSharpVote>;
  keywords?: SearchSharpVote[];
  category?: string | null;
}

interface ScoredVariant {
  text: string;
  score: number | null;
}

interface SearchSharpNewEntry {
  name: string;
  ssCategory: string | null;
  variants: ScoredVariant[];
}

interface SearchSharpNewVariants {
  existingNormal: string;
  category: string;
  newVariants: ScoredVariant[];
}

interface SearchSharpFiltered {
  name: string;
  reason: string;
  variants: string[];
}

interface SearchSharpStats {
  productsFetched: number;
  newEntries: number;
  newVariantsForExisting: number;
  variantsAddedToExisting: number;
  productsFilteredPolicy: number;
  variantsDroppedLowScore: number;
  productsAlreadyHave: number;
}

interface SearchSharpResult {
  newEntries: SearchSharpNewEntry[];
  newVariantsForExisting: SearchSharpNewVariants[];
  filteredForPolicy: SearchSharpFiltered[];
  stats: SearchSharpStats;
}

// ============ 抓取 ============
async function fetchAll(): Promise<SearchSharpProduct[]> {
  if (typeof fetch !== "function") {
    throw new Error("需要 Node 18+ (内置 fetch)");
  }
  const products: SearchSharpProduct[] = [];
  const seenIds = new Set<number | string>(); // 去重兜底, 防 offset 抖动
  let offset = 0;
  let page = 0;
  while (page < MAX_PAGES) {
    const url = `${BASE}/api/products?q=&sort=new&offset=${offset}`;
    const resp = await fetch(url, { headers: { accept: "application/json" } });
    if (!resp.ok) throw new Error(`抓取失败 HTTP ${resp.status} @ offset=${offset}`);
    // 外部应答不信任其形状: 先收敛为 unknown, 确认对象性后再 tolerant 读取
    // (缺 products 视为空批次, 与旧逻辑一致).
    const body: unknown = await resp.json();
    const data: Record<string, unknown> = isJsonObject(body) ? body : {};
    const batch: SearchSharpProduct[] = Array.isArray(data.products) ? data.products : [];
    for (const p of batch) {
      if (p && p.id != null && !seenIds.has(p.id)) {
        seenIds.add(p.id);
        products.push(p);
      }
    }
    page++;
    process.stdout.write(`\r  已抓取 ${products.length} 条 (第 ${page} 页)...`);
    if (!data.hasMore || batch.length === 0) break;
    offset += PAGE_SIZE;
    const { promise, resolve } = Promise.withResolvers<void>();
    setTimeout(resolve, REQUEST_DELAY_MS);
    await promise;
  }
  process.stdout.write("\n");
  return products;
}

// 把一条 SearchSharp 产品的变体收集出来 (aliases + keywords), 应用质量门槛.
// keyword 形如 {text, up, down}; alias 可能是字符串或 {text,...}. 二者都并入"暗语".
function collectVariants(product: SearchSharpProduct): { variants: ScoredVariant[]; lowScore: ScoredVariant[] } {
  const out: ScoredVariant[] = [];
  const lowScore: ScoredVariant[] = [];
  const pushVariant = (text: string | null | undefined, up?: number | null, down?: number | null): void => {
    const t = String(text || "").trim();
    if (!t) return;
    const score = (up || 0) - (down || 0);
    if (up == null && down == null) {
      out.push({ text: t, score: null }); // alias 无投票 -> 视为已审, 保留
    } else if (score >= MIN_SCORE && (up || 0) > (down || 0)) {
      out.push({ text: t, score });
    } else {
      lowScore.push({ text: t, score });
    }
  };
  for (const a of product.aliases || []) {
    if (typeof a === "string") pushVariant(a, null, null);
    else pushVariant(a.text, a.up, a.down);
  }
  for (const k of product.keywords || []) pushVariant(k.text, k.up, k.down);
  return { variants: out, lowScore };
}

// ============ 与本地词典对比, 分类暂存 ============
function categorize(products: SearchSharpProduct[], source: DictSource): SearchSharpResult {
  const { normalIndex, known } = buildLocalIndex(source);
  const newEntries: SearchSharpNewEntry[] = [];
  const newVariantsForExisting: SearchSharpNewVariants[] = [];
  const filteredForPolicy: SearchSharpFiltered[] = [];
  let droppedLowScore = 0;
  let alreadyHave = 0;

  for (const p of products) {
    const name = String(p.name || "").trim();
    if (!name) continue;
    const { variants, lowScore } = collectVariants(p);
    droppedLowScore += lowScore.length;

    // 政策检查: 产品名 + 全部变体 (含被低分淘汰的, 以免漏判)
    const allTokens = [name, ...variants.map((v) => v.text), ...lowScore.map((v) => v.text)];
    const hit = policyHit(allTokens);
    if (hit) {
      filteredForPolicy.push({ name, reason: hit, variants: variants.map((v) => v.text) });
      continue;
    }

    // 只保留本地还没有的变体
    const fresh = variants.filter((v) => !known.has(v.text.toLowerCase()));

    const match = normalIndex.get(name.toLowerCase());
    if (match) {
      if (fresh.length) {
        newVariantsForExisting.push({
          existingNormal: match.normalKey,
          category: match.catId,
          newVariants: fresh,
        });
      } else {
        alreadyHave++;
      }
    } else if (fresh.length) {
      // 全新概念: 名字本地没有, 且至少有一个新变体才值得收
      newEntries.push({ name, ssCategory: p.category || null, variants: fresh });
    } else {
      // 名字是新的, 但变体本地都已有 -> 没有新信息, 跳过
      alreadyHave++;
    }
  }

  return {
    newEntries,
    newVariantsForExisting,
    filteredForPolicy,
    stats: {
      productsFetched: products.length,
      newEntries: newEntries.length,
      newVariantsForExisting: newVariantsForExisting.length,
      variantsAddedToExisting: newVariantsForExisting.reduce((s, e) => s + e.newVariants.length, 0),
      productsFilteredPolicy: filteredForPolicy.length,
      variantsDroppedLowScore: droppedLowScore,
      productsAlreadyHave: alreadyHave,
    },
  };
}

// ============ --apply: 写回 source.json ============
function applyToSource(source: DictSource & { version?: unknown }, result: SearchSharpResult): void {
  // 1) 给已有词条补充变体 (并集去重, 保序)
  for (const item of result.newVariantsForExisting) {
    mergeVariants(
      source,
      item.category,
      item.existingNormal,
      item.newVariants.map((v) => v.text),
    );
  }

  // 2) 新概念统一进"社区补充"分类 (之后可手工细分)
  if (result.newEntries.length) {
    let community: DictCategory | undefined = source.categories.find((c) => c.id === COMMUNITY_CATEGORY.id);
    if (!community) {
      community = { ...COMMUNITY_CATEGORY, entries: {} };
      source.categories.push(community);
    }
    for (const e of result.newEntries) {
      mergeVariants(
        source,
        COMMUNITY_CATEGORY.id,
        e.name,
        e.variants.map((v) => v.text),
      );
    }
  }

  // 3) 只更新日期 —— version 字段已废弃, 版本唯一来源是 package.json (见 tools/lib/paths.ts).
  if ("version" in source) delete source.version;
  source.updatedAt = new Date().toISOString().slice(0, 10);
  writeFileSync(SOURCE_PATH, stringifyDict(source), "utf8");
}

// ============ 报告 ============
function printReport(result: SearchSharpResult, applied: boolean): void {
  const s = result.stats;
  console.log("\n================ SearchSharp 同步报告 ================");
  console.log(`抓取产品总数      : ${s.productsFetched}`);
  console.log(`新概念 (待归类)    : ${s.newEntries}`);
  console.log(`给已有词条补变体    : ${s.newVariantsForExisting} 个词条 / ${s.variantsAddedToExisting} 个变体`);
  console.log(`本地已收录(跳过)   : ${s.productsAlreadyHave}`);
  console.log(`质量过滤(低分丢弃)  : ${s.variantsDroppedLowScore} 个变体  (门槛 净赞≥${MIN_SCORE})`);
  console.log(`⚠️  政策过滤(已排除) : ${s.productsFilteredPolicy} 个产品  (绝不写入发布包)`);

  if (result.filteredForPolicy.length) {
    console.log("\n  被政策黑名单排除的产品 (人工复核, 默认不收录):");
    for (const f of result.filteredForPolicy.slice(0, 30)) {
      console.log(`    [${f.reason}] ${f.name}  ${f.variants.slice(0, 4).join("、")}`);
    }
    if (result.filteredForPolicy.length > 30) {
      console.log(`    ... 其余 ${result.filteredForPolicy.length - 30} 个见 staged.json`);
    }
  }

  if (result.newVariantsForExisting.length) {
    console.log("\n  给已有词条新增的变体 (样例):");
    for (const e of result.newVariantsForExisting.slice(0, 12)) {
      console.log(`    ${e.existingNormal} (${e.category}) += ${e.newVariants.map((v) => v.text).join("、")}`);
    }
  }

  if (result.newEntries.length) {
    console.log("\n  全新概念 (样例, --apply 后进入「社区补充」分类待细分):");
    for (const e of result.newEntries.slice(0, 15)) {
      console.log(
        `    ${e.name}  →  ${e.variants
          .map((v) => v.text)
          .slice(0, 6)
          .join("、")}`,
      );
    }
    if (result.newEntries.length > 15) {
      console.log(`    ... 其余 ${result.newEntries.length - 15} 个见 staged.json`);
    }
  }

  console.log("\n=====================================================");
  if (applied) {
    console.log("✅ 已写入 data/dictionary.source.json");
    console.log("   下一步: git diff 复核 → (发布则 bump package.json 的 version)");
  } else {
    console.log(`📋 已暂存到 ${STAGED_PATH} (未改动 source)`);
    console.log("   复核无误后, 重跑加 --apply 写入词典; 或据 staged.json 手工归类。");
  }
}

// ============ 主流程 ============
async function main(): Promise<void> {
  if (!existsSync(SOURCE_PATH)) {
    throw new Error(`找不到 ${SOURCE_PATH} — 请在项目根目录运行`);
  }
  // source.json 由本管线读写: 断言已知形状 (结构异常时由后继访问自然抛错, encrypt-dict.ts 另有显式校验).
  const source = JSON.parse(readFileSync(SOURCE_PATH, "utf8")) as DictSource;

  console.log(`抓取 ${BASE} ...`);
  const products = await fetchAll();
  const result = categorize(products, source);

  // 暂存产物 (无论是否 apply 都写, 便于审计/手工归类)
  const staged = {
    fetchedAt: new Date().toISOString(),
    source: BASE,
    params: { minScore: MIN_SCORE, maxPages: MAX_PAGES === Infinity ? null : MAX_PAGES },
    stats: result.stats,
    newVariantsForExisting: result.newVariantsForExisting,
    newEntries: result.newEntries,
    filteredForPolicy: result.filteredForPolicy,
  };
  writeFileSync(STAGED_PATH, JSON.stringify(staged, null, 2) + "\n", "utf8");

  if (APPLY) applyToSource(source, result);
  printReport(result, APPLY);
}

main().catch((err: unknown) => {
  console.error("\n❌ " + (err instanceof Error ? err.stack || err.message : String(err)));
  process.exit(1);
});
