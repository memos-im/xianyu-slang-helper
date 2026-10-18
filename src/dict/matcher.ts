/**
 * 暗语匹配器：trie 逐位置最长匹配。
 *
 * 取代原先「把全部变体拼成一个巨型 alternation 正则」的做法。原因是那个方案撞上了
 * 算法的扩展性天花板：V8 面对 3322 个变长、无公共前缀的 CJK/英数混合字面量时建不出
 * 紧凑的 DFA/trie，退化成每个字符位置逐分支试探，复杂度接近 O(文本长度 × 分支数)。
 * 实测（400 节点 / 35k 字）：896 变体 29ms → 3322 变体 266ms，已经会阻塞主线程。
 *
 * 本实现退化为 O(文本长度)，与词条数解耦。
 *
 * 语义必须与旧正则逐位一致（`tools/verify-matcher.ts` 会守住这一点）：
 *   1. **非重叠最左最长**：等价于「alternation 按长度降序 + /g 继续匹配」。
 *   2. **大小写不敏感**：等价于 /i。
 *   3. **返回原文切片**（保留原大小写），而不是词典里的规范写法 —— 调用方会把它写回 DOM，
 *      用规范写法会把页面上的 `iP` 静默改写成 `ip`。
 *
 * 实现要点：全程按 **UTF-16 码元**（`text[i]` / `charCodeAt`）而不是码点。
 * 建树用码点、扫描用码元会让所有非 BMP 字符（emoji）永远匹配不上 —— 词典里确实有
 * `🐧` / `🪜` / `小🍠` 这类变体。两边单位一致，emoji 就只是两条边而已。
 */

export interface SlangMatch {
  /** 起始下标（UTF-16 码元，与 `String.prototype.slice` 一致） */
  start: number;
  /** 结束下标，不含 */
  end: number;
  /** 原文切片（保留原大小写） */
  word: string;
}

/** 子节点 key = parentId * STRIDE + 码元，用数字 key 避免每次查表拼字符串 */
const CHILD_STRIDE = 65536;

/** 小写折叠；某些字符（如 U+0130）小写后长度会变，会让下标错位，故做退化处理 */
function foldCase(text: string): string {
  const lower = text.toLowerCase();
  if (lower.length === text.length) return lower;
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === undefined) continue;
    const folded = ch.toLowerCase();
    out += folded.length === 1 ? folded : ch;
  }
  return out.length === text.length ? out : text;
}

export class SlangMatcher {
  /** 边的集合：parent * CHILD_STRIDE + 码元 -> 子节点 id（0 是根） */
  private readonly edges = new Map<number, number>();
  /** 每个节点是否是一个完整词条的结尾 */
  private readonly ends: number[] = [0];
  /** 最长词条的码元长度，用于提前收敛内层循环 */
  private readonly maxLen: number;

  constructor(words: Iterable<string>) {
    let maxLen = 0;
    for (const word of words) {
      if (!word) continue;
      const folded = foldCase(word);
      let node = 0;
      for (let i = 0; i < folded.length; i++) {
        const code = folded.charCodeAt(i);
        const key = node * CHILD_STRIDE + code;
        let next = this.edges.get(key);
        if (next === undefined) {
          next = this.ends.length;
          this.edges.set(key, next);
          this.ends.push(0);
        }
        node = next;
      }
      this.ends[node] = 1;
      if (word.length > maxLen) maxLen = word.length;
    }
    this.maxLen = maxLen;
  }

  /** 非重叠最左最长匹配 */
  match(text: string): SlangMatch[] {
    const n = text.length;
    if (n === 0 || this.maxLen === 0) return [];
    const lower = foldCase(text);
    const out: SlangMatch[] = [];
    let i = 0;
    while (i < n) {
      let node = 0;
      let j = i;
      let best = 0;
      const limit = Math.min(n, i + this.maxLen);
      while (j < limit) {
        const next = this.edges.get(node * CHILD_STRIDE + lower.charCodeAt(j));
        if (next === undefined) break;
        node = next;
        j++;
        if (this.ends[node]) best = j;
      }
      if (best > 0) {
        out.push({ start: i, end: best, word: text.slice(i, best) });
        i = best; // 非重叠：从匹配末尾继续
      } else {
        i++;
      }
    }
    return out;
  }
}
