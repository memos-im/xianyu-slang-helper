/**
 * 词典数据模型。
 *
 * 唯一的版本来源是 package.json —— 词典数据本身不再携带 version，
 * 避免此前 "manifest.version 必须 == dictionary.source.json.version" 的双写不变量。
 */

/** 一个词条：normal 是标准词，值是它的全部暗语变体 */
import type { SlangMatcher } from "./matcher";

export type EntryMap = Record<string, string[]>;

export interface DictCategory {
  id: string;
  name: string;
  icon: string;
  /** 敏感分类的提示文案（目前仅用于历史 grey-area 分类） */
  warning?: string;
  entries: EntryMap;
  /** 运行时合并进来的用户自定义分类标记 */
  isCustom?: boolean;
}

/** data/dictionary.source.json 的形状 */
export interface DictSource {
  updatedAt: string;
  notes?: string;
  categories: DictCategory[];
}

export interface DictStats {
  categories: number;
  entries: number;
  slangs: number;
}

/** 加密 bundle（data/*.enc.json / 构建期注入的 dictionary.enc.json） */
export interface EncBundle {
  v: 2;
  version: string;
  updatedAt: string;
  alg: string;
  kdf: string;
  stats: DictStats;
  checksum: string;
  iv: string;
  ct: string;
}

export interface DictMeta {
  version: string;
  updatedAt: string;
  stats: DictStats;
}

export interface Suggestion {
  normal: string;
  slangs: string[];
  exact: boolean;
  viaSlang?: string;
}

export interface DecodeHit {
  slang: string;
  meanings: string[];
}

export interface ScanIndexes {
  matcher: SlangMatcher | null;
  reverse: Record<string, string[]>;
  customSlangs: Set<string>;
}

export interface AiContext {
  related: AiContextEntry[];
  samples: AiContextEntry[];
}

export interface AiContextEntry {
  category: string;
  normal: string;
  slangs: string[];
}

export interface BrowseCategory {
  id: string;
  name: string;
  icon: string;
  entries: { normal: string; slangs: string[] }[];
}

export interface CategorySummary {
  id: string;
  name: string;
  icon: string;
  entryCount: number;
}

export interface CategoryEntries {
  id: string;
  name: string;
  icon: string;
  entries: { normal: string; slangs: string[] }[];
}

export interface CustomDict {
  entries: EntryMap;
}
