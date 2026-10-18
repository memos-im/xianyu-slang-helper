/**
 * 词典加解密（WebCrypto，浏览器与 Node 20+ 通用）。
 *
 * === 给 Chrome Web Store 审核员的说明 ===
 * 本扩展把内置词典用 AES-GCM 加密后随包分发，目的【不是】隐藏任何代码逻辑或调用，
 * 而仅仅是防止外部爬虫脚本用 `curl + grep` 静态抓取这份公开整理的暗语词条列表。
 *
 * 解密口令以明文常量保存在 src/dict/constants.ts（PASSPHRASE），没有混淆，
 * 审核员可以一眼看到口令是什么、解密后的数据结构是什么。
 * 解密后的明文只在模块作用域内用于词典查找，不挂任何 window/self 全局对象，
 * 也不发往任何外部服务器。
 *
 * 词典明文源文件也在仓库内：data/dictionary.source.json
 *
 * 算法：AES-256-GCM + PBKDF2-SHA256(100k, 固定 salt)，12 字节随机 IV（每次构建生成）。
 */

import { KEY_LEN, PASSPHRASE, PBKDF2_ITERS, SALT_HEX } from "./constants";
import type { DictCategory, DictMeta, DictSource, DictStats, EncBundle } from "./types";

const subtle = globalThis.crypto.subtle;

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
  }
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(usage: KeyUsage[]): Promise<CryptoKey> {
  const baseKey = await subtle.importKey("raw", new TextEncoder().encode(PASSPHRASE), { name: "PBKDF2" }, false, [
    "deriveKey",
  ]);
  return subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: hexToBytes(SALT_HEX),
      iterations: PBKDF2_ITERS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: KEY_LEN },
    false,
    usage,
  );
}

export function countStats(categories: DictCategory[]): DictStats {
  let entries = 0;
  let slangs = 0;
  for (const cat of categories) {
    for (const list of Object.values(cat.entries)) {
      entries++;
      slangs += list.length;
    }
  }
  return { categories: categories.length, entries, slangs };
}

async function checksum(payload: string): Promise<string> {
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

/** 构建期：把词典明文加密成 bundle。 */
export async function encryptSource(source: DictSource, version: string): Promise<EncBundle> {
  const payload = JSON.stringify({ categories: source.categories });
  const key = await deriveKey(["encrypt"]);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const combined = new Uint8Array(
    await subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(payload)),
  );
  return {
    v: 2,
    version,
    updatedAt: source.updatedAt,
    alg: "AES-256-GCM",
    kdf: "PBKDF2-SHA256-100000",
    stats: countStats(source.categories),
    checksum: await checksum(payload),
    iv: bytesToBase64(iv),
    ct: bytesToBase64(combined),
  };
}

/** 运行时：解密 bundle，返回 categories。 */
export async function decryptBundle(bundle: EncBundle): Promise<DictCategory[]> {
  if (bundle?.v !== 2 || !bundle.iv || !bundle.ct) {
    throw new Error("加密词典格式无效");
  }
  const key = await deriveKey(["decrypt"]);
  const plainBuf = await subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(bundle.iv) },
    key,
    base64ToBytes(bundle.ct),
  );
  const parsed = JSON.parse(new TextDecoder().decode(plainBuf)) as { categories?: DictCategory[] };
  if (!Array.isArray(parsed.categories)) throw new Error("解密结果结构异常");
  return parsed.categories;
}

/** 运行时：抓取加密词典并解密。 */
export async function loadEncrypted(url: string): Promise<{ meta: DictMeta; categories: DictCategory[] }> {
  const resp = await fetch(url, { cache: "no-store" });
  if (!resp.ok) throw new Error(`无法加载加密词典: HTTP ${resp.status}`);
  const bundle = (await resp.json()) as EncBundle;
  const categories = await decryptBundle(bundle);
  return {
    meta: { version: bundle.version, updatedAt: bundle.updatedAt, stats: bundle.stats },
    categories,
  };
}
