// 词典工具共享模块 —— 供导入管线 (sync-*.ts) 与审计工具 (audit-dict.ts) 复用.
//
// 为什么单独抽出: 政策黑名单 / 风险变体判定 / source.json 序列化 曾经各写一份,
// 任何一处漏改都会让"该拦的没拦"静默发生. 单一定义点是安全边界, 不是洁癖.
//
// 本模块不读写文件, 纯函数 + 常量, 便于测试与复用.

import type { DictSource } from "../../src/dict/types";

// ============ 政策黑名单 ============
// 分两档, 因为"违法内容"与"商店政策灰色内容"的处置不该一样:
//
//   HARD = 违法/高危题材 (色情服务/毒品/武器/赌博/盗号洗钱/涉未成年).
//          默认仍然**整条排除**, 需要时用 --allow-hard-policy 显式放行。
//          理由: 这类词的泄露风险是法律责任, 不是商店审核; 默认放行的代价不可逆。
//   GREY = 商店政策/平台风控敏感的"灰色"题材 (假货仿品/黄牛代抢/引流养号/
//          社保代缴/活体宠物/医疗减肥). 这些本身多为合法商品, 只是擦边。
//          默认**允许写入**并单独报告, 需要时用 --deny-grey 排除.
//
// 取向: 宁可错杀 —— HARD 档漏网的代价远大于误杀一个正经词。
export interface PolicyRule {
  label: string;
  re: RegExp;
}

export type PolicyLevel = "hard" | "grey";

export interface PolicyFinding {
  level: PolicyLevel;
  label: string;
}

export const POLICY_HARD: PolicyRule[] = [
  {
    label: "色情/特殊服务",
    re: /色情|约炮|约啪|裸聊|援交|楼凤|小姐|性服务|一夜情|上门服务|特殊服务|可骑|骑\s*\d|贴身衣物|私密物品|原味|穿过的|esc(?:ort)?|啪啪/i,
  },
  {
    label: "毒品/管制药",
    re: /大麻|可卡因|冰毒|摇头丸|迷药|listen水|听话水|笑气|飞叶子|嗑药|kush|weed|\bmdma\b|\blsd\b|特殊货|外烟特殊/i,
  },
  { label: "武器弹药", re: /枪支|手枪|步枪|弹药|子弹|管制刀具|甩棍|电棍|弩箭|爆炸物/i },
  { label: "赌博", re: /赌博|博彩|私彩|六合彩|外围盘|时时彩/i },
  { label: "盗号/洗钱/黑产", re: /盗号|社工库|黑客服务|四件套|洗钱|发卡网|秒u|跑分/i },
  { label: "涉未成年/年龄硬币", re: /未成年|萝莉|幼\s*女|稚嫩|硬币年份|\d{2}年硬币|年份硬币/i },
];

export const POLICY_GREY: PolicyRule[] = [
  {
    label: "假货/仿品",
    re: /高仿|仿冒|复刻|精仿|超A|A货|莆田|莞顶|原单|尾单|厂货|公司级|纯原|打板|裁片|过验|渠道货|老鼠货|流出/i,
  },
  {
    label: "违禁品/医疗减肥",
    re: /社保|公积金|挂靠|代缴|断缴|补缴|活体|领养|星期宠|减肥|掉称|甩肉|轻态生活|身材管理|处方药/i,
  },
  {
    label: "黑产工具/批量养号",
    re: /引流|矩阵|养号|协议号|云控|群控|批量去重|去水印|涨粉|刷单|代练|引流脚本|外挂|辅助器|破解器/i,
  },
  { label: "黄牛/代抢实名", re: /黄牛|代抢|实名录入|内场邀请函/i },
];

// 返回 { level: "hard"|"grey", label } 或 null (first match, HARD 优先).
export function classifyPolicy(tokens: string[]): PolicyFinding | null {
  for (const rule of POLICY_HARD) {
    if (tokens.some((t) => rule.re.test(t))) return { level: "hard", label: rule.label };
  }
  for (const rule of POLICY_GREY) {
    if (tokens.some((t) => rule.re.test(t))) return { level: "grey", label: rule.label };
  }
  return null;
}

// 命中任意一档返回规则 label, 否则返回 null (保守用法: search-sharp 等噪音源仍用此函数全拦).
export function policyHit(tokens: string[]): string | null {
  const hit = classifyPolicy(tokens);
  return hit ? hit.label : null;
}

// ============ 风险变体判定 ============
// 与 audit-dict.ts 同源: 这些变体在"全局无边界正则"下会造成灾难级误报,
// 导入时默认剔除 (落在报告的 risky 桶), 需要时用 --include-risky 显式放行.
export const COMMON_CHINESE_WORDS: Set<string> = new Set([
  "米",
  "劳",
  "咽",
  "盐",
  "燕",
  "谷",
  "罐",
  "推",
  "担",
  "肾",
  "捆",
  "粥",
  "白菜",
  "水果",
  "那个",
  "大作",
  "箱说",
  "成色",
  "毕业",
  "下水",
  "上车",
  "车位",
  "刀",
  "骨折",
  "包邮",
  "自提",
  "秒了",
  "传家宝",
  "老哥",
  "学生",
  "捡漏",
  "正规",
  "好女孩",
  "成功",
  "上班",
  "坐牢",
  "打工",
  "真理",
  "酒",
  "谁",
  "黑洞",
  "攻",
  "大果",
  "典",
  "卫星",
  "国内",
  "暗网",
  "路由器",
  "高尔夫",
  "群主",
]);

// 返回风险原因字符串, 安全则返回 null.
export function riskyVariant(slang: string): string | null {
  const s = String(slang || "").trim();
  if (!s) return "空变体";
  if ([...s].length === 1) return "单字符: 长文本中必误伤普通商品";
  if (/^[a-zA-Z0-9]{1,3}$/.test(s)) return "短英文/数字: 无边界时易命中单词/型号子串";
  if (COMMON_CHINESE_WORDS.has(s)) return "通用日常词: 单独出现大概率是字面义";
  return null;
}

// ============ source.json 序列化 ============
// 保持手写格式 (对象多行/2 空格, 纯标量数组单行 ["a", "b"]),
// 这样 --apply 后 git diff 只显示真正新增的行, 而不是整文件重排.
export function stringifyDict(obj: unknown): string {
  const ser = (v: unknown, ind: number): string => {
    const pad = "  ".repeat(ind);
    const pad1 = "  ".repeat(ind + 1);
    if (Array.isArray(v)) {
      if (v.every((x) => x === null || typeof x !== "object")) {
        return "[" + v.map((x) => JSON.stringify(x)).join(", ") + "]";
      }
      return "[\n" + v.map((x) => pad1 + ser(x, ind + 1)).join(",\n") + "\n" + pad + "]";
    }
    if (isJsonObject(v)) {
      const ks = Object.keys(v);
      if (!ks.length) return "{}";
      return "{\n" + ks.map((k) => pad1 + JSON.stringify(k) + ": " + ser(v[k], ind + 1)).join(",\n") + "\n" + pad + "}";
    }
    return JSON.stringify(v);
  };
  return ser(obj, 0) + "\n";
}

// ============ 本地词典索引 ============
// normalIndex: lower(normal) -> {catId, normalKey}
// known:       lower(全部 normal + 全部变体)
export interface NormalIndexEntry {
  catId: string;
  normalKey: string;
}

export interface LocalIndex {
  normalIndex: Map<string, NormalIndexEntry>;
  known: Set<string>;
}

export function buildLocalIndex(source: DictSource): LocalIndex {
  const normalIndex = new Map<string, NormalIndexEntry>();
  const known = new Set<string>();
  for (const cat of source.categories) {
    for (const [normal, slangs] of Object.entries(cat.entries)) {
      normalIndex.set(normal.toLowerCase(), { catId: cat.id, normalKey: normal });
      known.add(normal.toLowerCase());
      for (const s of slangs) known.add(String(s).toLowerCase());
    }
  }
  return { normalIndex, known };
}

/** mergeVariants 接受的变体输入: 纯字符串, 或带 text 的计分对象 (search-sharp 管线). */
export type VariantInput = string | { text: string };

// 在指定分类下把变体并入 normal 词条 (并集去重, 保序). 返回实际新增的变体数组.
export function mergeVariants(
  source: DictSource,
  categoryId: string,
  normal: string,
  variants: VariantInput[],
): string[] {
  const cat = source.categories.find((c) => c.id === categoryId);
  if (!cat) return [];
  let arr = cat.entries[normal];
  if (!arr) {
    arr = [];
    cat.entries[normal] = arr;
  }
  const seen = new Set(arr.map((s) => s.toLowerCase()));
  const added: string[] = [];
  for (const v of variants) {
    const t = typeof v === "string" ? v : v.text;
    if (!t || seen.has(t.toLowerCase())) continue;
    arr.push(t);
    seen.add(t.toLowerCase());
    added.push(t);
  }
  return added;
}

// ============ JSON 边界守卫 ============
// 外部 JSON (网络应答 / 解析后的配置文件) 不信任其形状: 先用此守卫确认"可按对象读取",
// 再对关心的字段做各自的运行时确认 (Array.isArray / Number.isFinite / 缺失计数).
// 只做对象性确认, 不排除数组 —— 调用方按需另行区分 (stringifyDict 的数组分支在前,
// 因此对象分支里不会见到数组; 网络边界由调用方再做字段级确认).
export function isJsonObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object";
}
