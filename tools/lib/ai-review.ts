// AI 复核: 判定导入候选里的"模板化噪音"变体 (可选步骤)
//
// 背景: awesome-chinese-secondhand-slang 的变体里有一部分是把同一批后缀/前缀
// (如 包激活 / 诚心出 / 学习位 / 全新 / 包邮) 批量拼到不同概念上生成的, 语义上
// 是"真词", 但对高亮/搜索毫无增量, 还会把词典撑大。规则很难判这类噪音, 交给模型更合适。
//
// 用法: 一般不由人直接调, 而是被 sync-awesome.ts --ai-review 调用。
//
// 只用 System One 判别模型 (TypeSafe Jev; 自托管 DiffusionGemma 走同一 API)。
// 判别模型不生成文本, 只对 typed questions 返回校准概率 —— 因此这里没有 prompt/解析。
// 每个候选变体问一个 Noul 原子问题: 「变体里是否含有通用交易词缀」, 概率 >= 阈值即剔除。
//
// 配置 (环境变量):
//   TYPESAFE_API_KEY     托管 Jev 必填; 自托管本地端点 (localhost/127.0.0.1) 可留空
//   TYPESAFE_BASE_URL    可选, 默认 https://api.typesafe.ai
//   TYPESAFE_MODEL       可选, 默认 jev-latest
//   AI_NOISE_THRESHOLD   可选, 默认 0.7 (调低 = 剔得更多)
//
// 设计取向: "复核"只做剔除建议, 结果索引做边界校验; 任何网络/解析失败都不抛给
// 调用方去中断导入 —— 复核是增益步骤, 不是硬依赖。

import { isJsonObject } from "./dict-shared";

const DEFAULT_BASE_URL = "https://api.typesafe.ai";
const DEFAULT_MODEL = "jev-latest";
// 0.7 而非 0.5: 实测 filler>=0.5 的误杀约 31 条, 0.7 降到 3 条, 只多留 140 个冗余变体。
const DEFAULT_NOISE_THRESHOLD = 0.7;

export interface AiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  threshold: number;
  requiresKey: boolean;
}

export type EnvMap = Record<string, string | undefined>;

// 自托管 DiffusionGemma 走 IAP 隧道 / localhost, 免鉴权。
function isLocalBase(url: string): boolean {
  return /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\]|0\.0\.0\.0)(:|\/|$)/.test(url || "");
}

export function aiConfig(env: EnvMap = process.env): AiConfig {
  const baseUrl = (env.TYPESAFE_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const threshold = Number(env.AI_NOISE_THRESHOLD ?? DEFAULT_NOISE_THRESHOLD);
  return {
    apiKey: env.TYPESAFE_API_KEY || "",
    baseUrl,
    model: env.TYPESAFE_MODEL || DEFAULT_MODEL,
    threshold: Number.isFinite(threshold) ? threshold : DEFAULT_NOISE_THRESHOLD,
    requiresKey: !isLocalBase(baseUrl),
  };
}

export function aiConfigured(env: EnvMap = process.env): boolean {
  const cfg = aiConfig(env);
  return cfg.requiresKey ? Boolean(cfg.apiKey) : true;
}

// ============ 判定噪音 ============
//
// 只问一件事: 「变体里是否含有通用交易词缀」。为什么这一个问题就够了 ——
//
// 1. 本扩展的扫描正则是无边界子串匹配 (见 src/dict/loader.ts 的 buildIndexes):
//    「哈基米现货」本来就会被已有的「哈基米」条目命中, 单独收录只会撑大词典, 不会多出
//    任何可命中的东西。所以「含通用词缀」≈「对词典没有增量」, 这就是我们要判定的全部。
// 2. 实测对比过"再问一个 core 问题（去掉词缀后剩下的是不是独立暗语）当第二道闸":
//    core 的 noul 中位 0.60、>0.9 的只占 1%(基本是噪声, Jev 对这个问题没把握),
//    filler 中位 0.47、>0.9 的占 42%(双峰, 真有区分度)。加上 core 只是压低剔除量:
//    少 2 个误杀, 代价是多留约 270 个冗余变体 —— 不划算, 故删。

const NOISE_DEFINITION = [
  "这个词典做的是「暗语 → 正常词」的映射, 扫描页面时用无边界子串匹配。",
  "因此「已知暗语 + 通用交易词缀」(例: 哈基米现货 / 亮机卡可刀 / 买包烟成色包邮)",
  "不会比已有的核心暗语多命中任何东西 —— 它只是把同一件事说了两遍。",
  "通用交易词缀 = 任何品类都在用的措辞, 如 现货/包邮/包邮到家/秒发/急出/可刀/自用/全新/",
  "学习位/诚心出/包激活/带教程/稳定版/测试号/正品/原装/一手/车队/车位 等。",
  "核心暗语 = 概念特有的谐音/缩写/错别字/行业黑话, 如 克劳格/克牢弟/cld/哈基米/双子座/战损成色/伊拉克成色。",
].join("\n");

export interface ReviewItem {
  name: string;
  variant: string;
}

const FILLER_EXAMPLES = "现货/包邮/秒发/急出/可刀/自用/全新/学习位/诚心出/包激活/带教程/稳定版/测试号/正品/原装/一手";

function buildQuestions(items: ReviewItem[]): Record<string, { type: string; instructions: string }> {
  const questions: Record<string, { type: string; instructions: string }> = {};
  items.forEach((it, i) => {
    questions[`q${i}`] = {
      type: "noul",
      instructions:
        `候选变体「${it.variant}」里含有只起填充作用的通用交易词缀（${FILLER_EXAMPLES} 等之一）：` +
        `这类词缀任何品类都在用，不承载「${it.name}」的语义。`,
    };
  });
  return questions;
}

interface SystemOneResponse {
  answers: unknown;
  usage: Record<string, unknown> | null;
}

async function callSystemOne(
  items: ReviewItem[],
  cfg: AiConfig,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<SystemOneResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (cfg.apiKey) headers.authorization = `Bearer ${cfg.apiKey}`;
    const resp = await fetchImpl(`${cfg.baseUrl}/v1/systemone`, {
      method: "POST",
      signal: controller.signal,
      headers,
      body: JSON.stringify({
        model: cfg.model,
        state: {
          task: "判断候选暗语变体对词典是否有增量",
          concept: items[0]?.name || null,
          candidates: items.map((it, i) => ({ id: `q${i}`, text: it.variant })),
          noise_definition: NOISE_DEFINITION,
        },
        questions: buildQuestions(items),
      }),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    // 外部应答不信任其形状: 先收敛为 unknown, 确认顶层是对象才读取;
    // answers/usage 的细粒度确认由 parseAnswers (缺失计数) 与调用方 (非对象丢弃) 完成.
    const body: unknown = await resp.json();
    if (!isJsonObject(body)) throw new Error("System One 响应格式异常");
    return { answers: body.answers, usage: isJsonObject(body.usage) ? body.usage : null };
  } finally {
    clearTimeout(timer);
  }
}

interface NoiseScore {
  i: number;
  drop: boolean;
  reason: string;
  score?: number;
  filler?: number;
}

function noulOf(pool: Record<string, unknown>, key: string): number | null {
  const entry: unknown = pool[key];
  const noul = Number(isJsonObject(entry) ? entry.noul : undefined);
  return Number.isFinite(noul) ? noul : null;
}

// 返回**每一个**候选的评分与判定 (不只是剔除的), 便于把 core/filler 落到 staged.json
// 里离线扫阈值 —— 否则每次调参都要重打一遍 API, 还看不到"漏网"那一侧。
function parseAnswers(answers: unknown, batchLen: number, cfg: AiConfig): { scores: NoiseScore[]; missing: number } {
  const pool: Record<string, unknown> = isJsonObject(answers) ? answers : {};
  const scores: NoiseScore[] = [];
  let missing = 0;
  for (let i = 0; i < batchLen; i++) {
    const noul = noulOf(pool, `q${i}`);
    if (noul === null) {
      missing++;
      scores.push({ i, drop: false, reason: "未作答（保留）" });
      continue;
    }
    const drop = noul >= cfg.threshold;
    scores.push({
      i,
      drop,
      reason: `含通用词缀 p=${noul.toFixed(2)}`,
      score: noul,
      filler: noul,
    });
  }
  return { scores, missing };
}

// ============ 批处理 ============

export interface ReviewVerdict {
  index: number;
  drop: boolean;
  reason: string;
  /** min(core, filler): 越高越确定是"已知暗语 + 通用填充" */
  score?: number;
  /** 模型给出的「含通用交易词缀」概率 */
  filler?: number;
  item: ReviewItem;
}

export interface ReviewResult {
  verdicts: ReviewVerdict[];
  errors: string[];
  usage: Record<string, number> | null;
  aborted?: boolean;
  model?: string;
  skipped?: boolean;
}

export interface ReviewOptions {
  env?: EnvMap;
  cfg?: Partial<AiConfig>;
  fetchImpl?: typeof fetch;
  batchSize?: number;
  concurrency?: number;
  timeoutMs?: number;
  retries?: number;
  failFast?: boolean;
  onProgress?: (progress: { done: number; total: number }) => void;
  /** 细粒度覆盖, 一般用 env 的 AI_NOISE_THRESHOLD */
  threshold?: number;
}

// items: [{ name, variant }] -> { verdicts: [{ index, drop, reason, item, score }], errors, usage, aborted }
export async function reviewItems(items: ReviewItem[], opts: ReviewOptions = {}): Promise<ReviewResult> {
  const cfg: AiConfig = { ...aiConfig(opts.env || process.env), ...opts.cfg };
  const fetchImpl = opts.fetchImpl || fetch;
  const batchSize = opts.batchSize || 50; // 同请求多问并行求值, 加问题几乎不增加耗时
  const concurrency = Math.max(1, opts.concurrency || 4);
  const timeoutMs = opts.timeoutMs || 15000;
  const retries = opts.retries ?? 2;
  const failFast = opts.failFast !== false;
  const onProgress = opts.onProgress || ((): void => {});
  const resolved: AiConfig = {
    ...cfg,
    threshold: Number.isFinite(opts.threshold) ? (opts.threshold as number) : cfg.threshold,
  };

  if (cfg.requiresKey && !cfg.apiKey) {
    return { verdicts: [], errors: ["未配置 TYPESAFE_API_KEY"], usage: null, skipped: true };
  }
  if (typeof fetchImpl !== "function") return { verdicts: [], errors: ["缺少 fetch (需 Node 18+)"], usage: null };

  const batches: Array<{ start: number; items: ReviewItem[] }> = [];
  for (let start = 0; start < items.length; start += batchSize) {
    batches.push({ start, items: items.slice(start, start + batchSize) });
  }

  const verdicts: ReviewVerdict[] = [];
  const errors: string[] = [];
  let usage: Record<string, number> | null = null;
  let done = 0;
  let cursor = 0;
  let okBatches = 0;
  let failedBatches = 0;
  let aborted = false;

  async function worker(): Promise<void> {
    while (cursor < batches.length && !aborted) {
      const batch = batches[cursor++];
      if (!batch) break;
      const start = batch.start;
      const batchItems = batch.items;
      let scores: NoiseScore[] | null = null;
      let lastErr: unknown = null;
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const { answers, usage: u } = await callSystemOne(batchItems, resolved, fetchImpl, timeoutMs);
          if (u) {
            usage = usage || {};
            const acc: Record<string, number> = usage;
            for (const k of Object.keys(u)) acc[k] = (acc[k] || 0) + (Number(u[k]) || 0);
          }
          const parsed = parseAnswers(answers, batchItems.length, resolved);
          if (parsed.missing === batchItems.length) throw new Error("响应缺少全部 noul 答案");
          scores = parsed.scores;
          break;
        } catch (err) {
          lastErr = err;
          if (attempt < retries) {
            const { promise, resolve } = Promise.withResolvers<void>();
            setTimeout(resolve, 500 * (attempt + 1));
            await promise;
          }
        }
      }
      if (scores) {
        okBatches++;
        for (const s of scores) {
          const item = batchItems[s.i];
          if (!item) continue;
          verdicts.push({
            index: start + s.i,
            drop: s.drop,
            reason: s.reason,
            score: s.score,
            filler: s.filler,
            item,
          });
        }
      } else {
        failedBatches++;
        errors.push(
          `批次 ${start}~${start + batchItems.length - 1} 失败: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`,
        );
        if (failFast && okBatches === 0 && failedBatches >= 3) {
          aborted = true;
          errors.push("连续多批失败, 判定 System One 接口不可用, 已提前中止 (其余变体全部保留)");
        }
      }
      done += batchItems.length;
      onProgress({ done: Math.min(done, items.length), total: items.length });
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, batches.length) }, () => worker()));
  verdicts.sort((a, b) => a.index - b.index);
  return { verdicts, errors, usage, aborted, model: resolved.model };
}
