// AI 复核: 判定导入候选里的"模板化噪音"变体 (可选步骤)
//
// 背景: awesome-chinese-secondhand-slang 的变体里有一部分是把同一批后缀/前缀
// (如 包激活 / 诚心出 / 学习位 / 全新 / 包邮) 批量拼到不同概念上生成的, 语义上
// 是"真词", 但对高亮/搜索毫无增量, 还会把词典撑大。规则很难判这类噪音, 交给模型更合适。
//
// 用法: 一般不由人直接调, 而是被 sync-awesome.ts --ai-review 调用。
//
// 只用 System One 判别模型 (TypeSafe Jev; 自托管 DiffusionGemma 走同一 API)。
// 判别模型不生成文本, 只对 typed questions 返回校准概率 —— 因此这里没有 prompt/解析,
// 每个候选变体问一个 Noul 问题, 取概率 >= 阈值即判为噪音。
//
// 配置 (环境变量):
//   TYPESAFE_API_KEY   托管 Jev 必填; 自托管本地端点 (localhost/127.0.0.1) 可留空
//   TYPESAFE_BASE_URL  可选, 默认 https://api.typesafe.ai
//   TYPESAFE_MODEL     可选, 默认 jev-latest
//   AI_NOISE_THRESHOLD 可选, 默认 0.5 (概率越高越激进)
//
// 设计取向: "复核"只做剔除建议, 结果索引做边界校验; 任何网络/解析失败都不抛给
// 调用方去中断导入 —— 复核是增益步骤, 不是硬依赖。

import { isJsonObject } from "./dict-shared";

const DEFAULT_BASE_URL = "https://api.typesafe.ai";
const DEFAULT_MODEL = "jev-latest";
const DEFAULT_THRESHOLD = 0.5;

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
  const threshold = Number(env.AI_NOISE_THRESHOLD ?? DEFAULT_THRESHOLD);
  return {
    apiKey: env.TYPESAFE_API_KEY || "",
    baseUrl,
    model: env.TYPESAFE_MODEL || DEFAULT_MODEL,
    threshold: Number.isFinite(threshold) ? threshold : DEFAULT_THRESHOLD,
    requiresKey: !isLocalBase(baseUrl),
  };
}

export function aiConfigured(env: EnvMap = process.env): boolean {
  const cfg = aiConfig(env);
  return cfg.requiresKey ? Boolean(cfg.apiKey) : true;
}

// ============ 判定噪音 ============
//
// 一个候选变体 = 一个 Noul 问题 ("该变体是不是模板化噪音"), 同一批共用一份 state。
// 判别模型不支持生成理由, 所以 verdict.reason 是概率而不是文本。

const NOISE_DEFINITION = [
  "模板化噪音 = 把通用交易后缀/前缀(包激活/诚心出/学习位/全新/包邮/现货/秒发/带教程/稳定版/急出/可刀/一手/自用 等)",
  "机械拼到任意概念上得到的词: 脱离该概念后毫无区分度, 几乎可以被任何商品共用。",
  "不是噪音 = 有真实语义映射的谐音/缩写/错别字/行业黑话 (如 克劳格/哈基米/cld/战损成色/伊拉克成色) —— 这些是词典的核心价值, 必须保留。",
].join("\n");

export interface ReviewItem {
  name: string;
  variant: string;
}

function buildQuestions(items: ReviewItem[]): Record<string, { type: string; instructions: string }> {
  const questions: Record<string, { type: string; instructions: string }> = {};
  items.forEach((it, i) => {
    questions[`q${i}`] = {
      type: "noul",
      instructions:
        `候选变体「${it.variant}」属于模板化噪音：它脱离「${it.name}」这个概念后没有任何区分度，` +
        `只是通用交易词缀的机械拼接，而不是该概念特有的谐音、缩写或行业黑话。`,
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
          task: "判断候选暗语变体是否为模板化噪音",
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

interface NoiseDrop {
  i: number;
  reason: string;
  score: number;
}

function parseAnswers(answers: unknown, batchLen: number, threshold: number): { drops: NoiseDrop[]; missing: number } {
  const pool: Record<string, unknown> = isJsonObject(answers) ? answers : {};
  const drops: NoiseDrop[] = [];
  let missing = 0;
  for (let i = 0; i < batchLen; i++) {
    const entry: unknown = pool[`q${i}`];
    const noul = Number(isJsonObject(entry) ? entry.noul : undefined);
    if (!Number.isFinite(noul)) {
      missing++;
      continue;
    }
    if (noul >= threshold) drops.push({ i, reason: `noul=${noul.toFixed(2)}（≥${threshold} 判为噪音）`, score: noul });
  }
  return { drops, missing };
}

// ============ 批处理 ============

export interface ReviewVerdict {
  index: number;
  drop: boolean;
  reason: string;
  score?: number;
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
  const threshold =
    typeof opts.threshold === "number" && Number.isFinite(opts.threshold) ? opts.threshold : cfg.threshold;

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
      let drops: NoiseDrop[] | null = null;
      let lastErr: unknown = null;
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const { answers, usage: u } = await callSystemOne(batchItems, cfg, fetchImpl, timeoutMs);
          if (u) {
            usage = usage || {};
            const acc: Record<string, number> = usage;
            for (const k of Object.keys(u)) acc[k] = (acc[k] || 0) + (Number(u[k]) || 0);
          }
          const parsed = parseAnswers(answers, batchItems.length, threshold);
          if (parsed.missing === batchItems.length) throw new Error("响应缺少全部 noul 答案");
          drops = parsed.drops;
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
      if (drops) {
        okBatches++;
        for (const d of drops) {
          const item = batchItems[d.i];
          if (!item) continue;
          verdicts.push({ index: start + d.i, drop: true, reason: d.reason, score: d.score, item });
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
  return { verdicts, errors, usage, aborted, model: cfg.model };
}
