/**
 * 词典加载与查询 API —— 唯一的词典数据入口。
 *
 * 设计要点（与旧 data/dict-loader.js 一致，务必保持）：
 *   1. 明文 categories 只存在本模块的闭包变量里，永不挂到 window/self；
 *      ES module 的顶层绑定天然不可枚举、不可写，比旧 IIFE 的 defineProperty 更严。
 *   2. 对外只导出「按需查询」的函数（suggestSlangsFor / decodeText / …），
 *      不存在「一次性拿到整本词典」的接口。
 *   3. 整体导出为一个 Object.freeze 的命名空间对象。
 *
 * 数据来源自动选择：
 *   - 开发期：wxt.config.ts 在 build:publicAssets 里注入 dictionary.source.json（明文），直接读。
 *   - 发布期：只剩 dictionary.enc.json（AES-GCM 密文），走 src/dict/crypto.ts 解密。
 */

import { browser } from "wxt/browser";
import { ENC_PATH, PLAIN_PATH } from "./constants";
import { countStats, loadEncrypted } from "./crypto";
import { SlangMatcher } from "./matcher";
import type {
  AiContext,
  AiContextEntry,
  BrowseCategory,
  CategoryEntries,
  CategorySummary,
  CustomDict,
  DecodeHit,
  DictCategory,
  DictMeta,
  DictSource,
  EntryMap,
  ScanIndexes,
  Suggestion,
} from "./types";

// ============ 内部状态（闭包私有） ============
let _meta: DictMeta | null = null;
let _categories: DictCategory[] | null = null;
let _loadPromise: Promise<void> | null = null;

let _flatDict: Record<string, string[]> | null = null;
let _reverse: Record<string, string[]> | null = null;
let _matcher: SlangMatcher | null = null;

let _customEntries: EntryMap | null = null;
let _customSlangSet = new Set<string>();

const CUSTOM_STORAGE_KEY = "customDict";

function buildIndexes(categories: DictCategory[]) {
  const flat: Record<string, string[]> = {};
  const reverse: Record<string, string[]> = {};
  for (const cat of categories) {
    for (const [normal, slangs] of Object.entries(cat.entries)) {
      // 同一个 normal 在不同分类下合并（理论上分类隔离，实际罕见）
      if (!flat[normal]) flat[normal] = [];
      for (const s of slangs) {
        if (!flat[normal].includes(s)) flat[normal].push(s);
        if (!reverse[s]) reverse[s] = [];
        if (!reverse[s].includes(normal)) reverse[s].push(normal);
      }
    }
  }
  const matcher = new SlangMatcher(Object.keys(reverse));
  return { flat, reverse, matcher };
}

/** 开发期：读明文 source（发布包里不存在，必然 404 → 回落加密路径）。 */
async function tryLoadPlaintext(): Promise<{ meta: DictMeta; categories: DictCategory[] } | null> {
  try {
    const resp = await fetch(browser.runtime.getURL(PLAIN_PATH), { cache: "no-store" });
    if (!resp.ok) return null;
    const src = (await resp.json()) as DictSource;
    if (!Array.isArray(src?.categories)) return null;
    return {
      meta: { version: __APP_VERSION__, updatedAt: src.updatedAt, stats: countStats(src.categories) },
      categories: src.categories,
    };
  } catch {
    return null;
  }
}

async function loadCustomEntries(): Promise<void> {
  const stored = await browser.storage.local.get(CUSTOM_STORAGE_KEY);
  const dict = stored?.[CUSTOM_STORAGE_KEY] as CustomDict | undefined;
  _customEntries = sanitize(dict).entries;
  _customSlangSet = new Set<string>();
  for (const list of Object.values(_customEntries)) {
    for (const s of list) _customSlangSet.add(s);
  }
}

async function ensureLoaded(): Promise<void> {
  if (_categories) return;
  if (!_loadPromise) {
    _loadPromise = (async () => {
      const plain = await tryLoadPlaintext();
      let baseCategories: DictCategory[];
      if (plain) {
        _meta = plain.meta;
        baseCategories = plain.categories;
      } else {
        const loaded = await loadEncrypted(browser.runtime.getURL(ENC_PATH));
        _meta = loaded.meta;
        baseCategories = loaded.categories;
      }

      await loadCustomEntries();
      if (_customEntries && Object.keys(_customEntries).length > 0) {
        baseCategories = [
          ...baseCategories,
          { id: "custom", name: "我的词典", icon: "📝", entries: { ..._customEntries }, isCustom: true },
        ];
      }
      _categories = baseCategories;

      const idx = buildIndexes(_categories);
      _flatDict = idx.flat;
      _reverse = idx.reverse;
      _matcher = idx.matcher;
    })();
  }
  return _loadPromise;
}

// 自定义词典变更 → 失效缓存重建索引
browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[CUSTOM_STORAGE_KEY]) {
    _categories = null;
    _loadPromise = null;
    _flatDict = null;
    _reverse = null;
    _matcher = null;
    _customEntries = null;
    _customSlangSet = new Set();
  }
});

// ============ 受控查询 API ============

async function getMeta(): Promise<DictMeta & { categoryCount: number }> {
  await ensureLoaded();
  return { ...(_meta as DictMeta), categoryCount: (_categories as DictCategory[]).length };
}

async function getCategorySummaries(): Promise<CategorySummary[]> {
  await ensureLoaded();
  return (_categories as DictCategory[]).map((c) => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
    entryCount: Object.keys(c.entries).length,
  }));
}

async function getCategoryEntries(categoryId: string): Promise<CategoryEntries | null> {
  await ensureLoaded();
  const cat = (_categories as DictCategory[]).find((c) => c.id === categoryId);
  if (!cat) return null;
  return {
    id: cat.id,
    name: cat.name,
    icon: cat.icon,
    entries: Object.entries(cat.entries).map(([normal, slangs]) => ({ normal, slangs: [...slangs] })),
  };
}

async function suggestSlangsFor(query: string): Promise<Suggestion[]> {
  await ensureLoaded();
  const lower = query.trim().toLowerCase();
  if (!lower) return [];

  const flat = _flatDict as Record<string, string[]>;
  const reverse = _reverse as Record<string, string[]>;

  const seen = new Set<string>();
  const out: Suggestion[] = [];
  const pushOnce = (normal: string, exact: boolean, viaSlang?: string) => {
    if (seen.has(normal)) return;
    const slangs = flat[normal];
    if (!slangs) return;
    const entry: Suggestion = { normal, slangs: [...slangs], exact };
    if (viaSlang) entry.viaSlang = viaSlang;
    out.push(entry);
    seen.add(normal);
  };

  // 1) normal 精确匹配
  for (const normal of Object.keys(flat)) {
    if (normal.toLowerCase() === lower) pushOnce(normal, true);
  }

  // 2) 用户输入正好是某个暗语 → 返回其归属的所有 normal
  for (const slang of Object.keys(reverse)) {
    if (slang.toLowerCase() === lower) {
      for (const normal of reverse[slang] ?? []) pushOnce(normal, false, slang);
    }
  }

  // 3) normal 含输入 / 输入含 normal
  for (const normal of Object.keys(flat)) {
    const ln = normal.toLowerCase();
    if (ln.includes(lower) || (lower.length >= 2 && lower.includes(ln))) pushOnce(normal, false);
  }

  // 4) 任何暗语含输入 / 输入含某暗语 → 关联到对应 normal
  for (const slang of Object.keys(reverse)) {
    const sl = slang.toLowerCase();
    if (sl.includes(lower) || (lower.length >= 2 && lower.includes(sl))) {
      for (const normal of reverse[slang] ?? []) pushOnce(normal, false, slang);
    }
  }

  return out.slice(0, 12);
}

async function decodeSlang(slang: string): Promise<string[] | null> {
  await ensureLoaded();
  const reverse = _reverse as Record<string, string[]>;
  return reverse[slang] || reverse[slang.toLowerCase()] || null;
}

async function decodeText(text: string): Promise<DecodeHit[]> {
  await ensureLoaded();
  const reverse = _reverse as Record<string, string[]>;
  if (!_matcher || !text) return [];
  const found = new Map<string, string[]>();
  for (const m of _matcher.match(text)) {
    const key = m.word;
    const meanings = reverse[key] || reverse[key.toLowerCase()];
    if (meanings && !found.has(key)) found.set(key, [...meanings]);
  }
  return [...found.entries()].map(([slang, meanings]) => ({ slang, meanings }));
}

/** 给 content script 扫描整页用：返回匹配器 + reverse 快照。 */
async function getScanIndexes(): Promise<ScanIndexes> {
  await ensureLoaded();
  return {
    matcher: _matcher,
    reverse: _reverse as Record<string, string[]>,
    customSlangs: new Set(_customSlangSet), // 副本，防外部修改
  };
}

/** 给 AI 用：抽取与 query 相关的条目 + 每分类 1–2 个代表条目作为风格样本。 */
async function getAIContext(query: string, maxRelated = 8): Promise<AiContext> {
  await ensureLoaded();
  const lower = String(query || "")
    .trim()
    .toLowerCase();
  const categories = _categories as DictCategory[];

  const related: AiContextEntry[] = [];
  const seen = new Set<string>();
  if (lower) {
    for (const cat of categories) {
      for (const [normal, slangs] of Object.entries(cat.entries)) {
        if (seen.has(normal)) continue;
        const allTokens = [normal, ...slangs].map((t) => t.toLowerCase());
        if (allTokens.some((t) => t.includes(lower) || lower.includes(t))) {
          related.push({ category: cat.name, normal, slangs: [...slangs] });
          seen.add(normal);
          if (related.length >= maxRelated) break;
        }
      }
      if (related.length >= maxRelated) break;
    }
  }

  const samples: AiContextEntry[] = [];
  for (const cat of categories) {
    for (const [normal, slangs] of Object.entries(cat.entries).slice(0, 2)) {
      if (seen.has(normal)) continue;
      samples.push({ category: cat.name, normal, slangs: [...slangs] });
    }
  }

  return { related, samples };
}

/** 全词典浏览（仅 popup 内部用）。 */
async function getAllForBrowse(): Promise<BrowseCategory[]> {
  await ensureLoaded();
  return (_categories as DictCategory[]).map((c) => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
    entries: Object.entries(c.entries).map(([normal, slangs]) => ({ normal, slangs: [...slangs] })),
  }));
}

// ============ 自定义词典 CRUD ============

function sanitize(newDict: unknown): CustomDict {
  const clean: CustomDict = { entries: {} };
  const input = newDict as { entries?: unknown } | null | undefined;
  if (!input || typeof input.entries !== "object" || input.entries === null) return clean;
  for (const [rawNormal, rawSlangs] of Object.entries(input.entries as Record<string, unknown>)) {
    const normal = String(rawNormal).trim();
    if (!normal) continue;
    const slangs = (Array.isArray(rawSlangs) ? rawSlangs : []).map((s) => String(s).trim()).filter((s) => s.length > 0);
    const unique = [...new Set(slangs)];
    if (unique.length === 0) continue;
    clean.entries[normal] = unique;
  }
  return clean;
}

async function getCustomDict(): Promise<CustomDict> {
  await ensureLoaded();
  return { entries: _customEntries ? { ..._customEntries } : {} };
}

async function setCustomDict(newDict: unknown): Promise<CustomDict> {
  const clean = sanitize(newDict);
  await browser.storage.local.set({ [CUSTOM_STORAGE_KEY]: clean });
  return clean;
}

async function upsertCustomEntry(normal: string, slangs: string[]): Promise<CustomDict> {
  const dict = await getCustomDict();
  dict.entries[normal] = slangs;
  return setCustomDict(dict);
}

async function deleteCustomEntry(normal: string): Promise<CustomDict> {
  const dict = await getCustomDict();
  delete dict.entries[normal];
  return setCustomDict(dict);
}

async function clearCustomDict(): Promise<CustomDict> {
  return setCustomDict({ entries: {} });
}

function isSlangCustom(slang: string): boolean {
  return _customSlangSet.has(slang);
}

/** 冻结的命名空间对象 —— 外部只能按需调用，拿不到整本词典。 */
export const xyDict = Object.freeze({
  getMeta,
  getCategorySummaries,
  getCategoryEntries,
  suggestSlangsFor,
  decodeSlang,
  decodeText,
  getScanIndexes,
  getAllForBrowse,
  getAIContext,
  getCustomDict,
  setCustomDict,
  upsertCustomEntry,
  deleteCustomEntry,
  clearCustomDict,
  isSlangCustom,
});
