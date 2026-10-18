import { browser } from "wxt/browser";
import { xyDict } from "@/dict/loader";
import type { BrowseCategory, DecodeHit, DictMeta, Suggestion } from "@/dict/types";

// Chrome 内置 AI（Gemini Nano）最小类型声明 —— 保持原 popup.js 的调用方式，只做类型化。
type AiStatus = "available" | "downloadable" | "downloading" | "unavailable";
type AiDirection = "to-slang" | "to-normal";

interface AiDownloadProgress {
  loaded: number;
}

interface AiMonitor {
  addEventListener(type: "downloadprogress", listener: (e: AiDownloadProgress) => void): void;
}

interface AiSession {
  promptStreaming(prompt: string): AsyncIterable<string>;
  destroy(): void;
}

interface AiLanguageModel {
  availability(): Promise<AiStatus>;
  create(options: {
    temperature: number;
    topK: number;
    initialPrompts: { role: string; content: string }[];
    monitor: (m: AiMonitor) => void;
  }): Promise<AiSession>;
}

declare const LanguageModel: AiLanguageModel | undefined;

type MetaWithCount = DictMeta & { categoryCount: number };

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`[xianyu-slang] 缺少元素 #${id}`);
  return node as T;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

let META: MetaWithCount | null = null;
let CACHED_BROWSE: BrowseCategory[] | null = null; // 懒加载：仅在词典页第一次切入时获取
let activeCategory = "__all__";

// Built-in AI (Gemini Nano) 状态
let AI_STATUS: AiStatus | "unavailable" | null = null;

function escapeHtml(s: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return String(s).replace(/[&<>"']/g, (c) => map[c] ?? c);
}

// ============ Tab switching ============
const tabs = document.querySelectorAll<HTMLButtonElement>(".tab");
const panels = document.querySelectorAll<HTMLElement>(".panel");
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.tab ?? "";
    tabs.forEach((t) => {
      t.classList.toggle("active", t === tab);
    });
    panels.forEach((p) => {
      p.classList.toggle("active", p.id === `panel-${target}`);
    });
    if (target === "dict") void ensureDictRendered();
    if (target === "custom") void renderCustomPanel();
  });
});

// ============ Translate panel ============
const input = el<HTMLTextAreaElement>("translate-input");
const clearBtn = el<HTMLButtonElement>("clear-btn");
const resultArea = el<HTMLDivElement>("result-area");

let translateDebounceTimer: number | null = null;

async function performTranslate(text: string, forceDirection?: "to-slang" | "to-normal"): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) {
    resultArea.innerHTML = '<div class="empty-state">输入关键词或粘贴商品文本，自动双向识别</div>';
    return;
  }

  // 如果强制指定方向
  if (forceDirection === "to-slang") {
    const matches = await xyDict.suggestSlangsFor(trimmed);
    if (matches.length === 0) {
      resultArea.innerHTML = renderEmptyWithAI(
        `词典中没有找到 "${escapeHtml(trimmed)}" 的暗语`,
        '试试更通用的词，或在"词典"页浏览所有分类',
        trimmed,
        "to-slang",
      );
      bindAIButton(trimmed, "to-slang");
      return;
    }
    renderSlangMatches(matches);
    return;
  }

  if (forceDirection === "to-normal") {
    const found = await xyDict.decodeText(trimmed);
    if (found.length === 0) {
      resultArea.innerHTML = renderEmptyWithAI(
        "未在文本中检测到已知暗语",
        "可能是新词或词典暂未收录",
        trimmed,
        "to-normal",
      );
      bindAIButton(trimmed, "to-normal");
      return;
    }
    renderDecodedMatches(found);
    return;
  }

  // 智能双向解析：长句或包含空格标点时优先解读；短词优先正向查暗语，同时互相兜底
  const isLikelyLongSentence = trimmed.length > 12 || /[\n，。！？,!?]/.test(trimmed);
  if (isLikelyLongSentence) {
    const found = await xyDict.decodeText(trimmed);
    if (found.length > 0) {
      renderDecodedMatches(found);
      return;
    }
    const matches = await xyDict.suggestSlangsFor(trimmed);
    if (matches.length > 0) {
      renderSlangMatches(matches);
      return;
    }
  } else {
    const matches = await xyDict.suggestSlangsFor(trimmed);
    if (matches.length > 0) {
      renderSlangMatches(matches);
      return;
    }
    const found = await xyDict.decodeText(trimmed);
    if (found.length > 0) {
      renderDecodedMatches(found);
      return;
    }
  }

  // 两侧都没命中时提供本地 AI 兜底
  resultArea.innerHTML = renderEmptyWithAI(
    `词典中未收录 "${escapeHtml(trimmed)}"`,
    '可点击上方"转暗语"或"解读暗语"单独查询，或在"词典"中浏览',
    trimmed,
    "to-slang",
  );
  bindAIButton(trimmed, "to-slang");
}

function renderSlangMatches(matches: Suggestion[]): void {
  let html = "";
  for (const { normal, slangs, exact } of matches) {
    html += `
        <div class="result-normal">${exact ? "✓ 精确匹配: " : ""}<strong>${escapeHtml(normal)}</strong></div>
        <div class="result-tags">
          ${slangs
            .map(
              (s) => `
            <div class="result-tag-wrap">
              <span class="result-tag" data-copy="${escapeHtml(s)}" title="点击复制">${escapeHtml(s)}</span>
              <a class="btn-search-goofish" href="https://www.goofish.com/search?q=${encodeURIComponent(s)}" target="_blank" rel="noopener noreferrer" title="去闲鱼搜此暗语">↗</a>
            </div>`,
            )
            .join("")}
        </div>
      </div>`;
  }
  resultArea.innerHTML = html;
  bindCopyTags(resultArea, ".result-tag");
}

function renderDecodedMatches(found: DecodeHit[]): void {
  let html = "";
  for (const { slang, meanings } of found) {
    html += `
        <div class="result-normal">暗语: <strong>${escapeHtml(slang)}</strong></div>
        <div class="result-tags">
          ${meanings
            .map(
              (s) => `
            <div class="result-tag-wrap">
              <span class="result-tag" data-copy="${escapeHtml(s)}" title="点击复制">${escapeHtml(s)}</span>
              <a class="btn-search-goofish" href="https://www.goofish.com/search?q=${encodeURIComponent(s)}" target="_blank" rel="noopener noreferrer" title="去闲鱼搜此词">↗</a>
            </div>`,
            )
            .join("")}
        </div>
      </div>`;
  }
  resultArea.innerHTML = html;
  bindCopyTags(resultArea, ".result-tag");
}

input.addEventListener("input", () => {
  clearBtn.style.display = input.value ? "flex" : "none";
  if (translateDebounceTimer) window.clearTimeout(translateDebounceTimer);
  translateDebounceTimer = window.setTimeout(() => {
    void performTranslate(input.value);
  }, 200);
});

clearBtn.addEventListener("click", () => {
  input.value = "";
  clearBtn.style.display = "none";
  if (translateDebounceTimer) window.clearTimeout(translateDebounceTimer);
  resultArea.innerHTML = '<div class="empty-state">输入关键词或粘贴商品文本，自动双向识别</div>';
  input.focus();
});

el<HTMLButtonElement>("btn-to-slang").addEventListener("click", () => {
  const text = input.value.trim();
  if (!text) {
    resultArea.innerHTML = '<div class="empty-state">请先输入要转换的关键词</div>';
    return;
  }
  void performTranslate(text, "to-slang");
});

el<HTMLButtonElement>("btn-to-normal").addEventListener("click", () => {
  const text = input.value.trim();
  if (!text) {
    resultArea.innerHTML = '<div class="empty-state">请先粘贴要解读的文本</div>';
    return;
  }
  void performTranslate(text, "to-normal");
});
// ============ Built-in AI fallback ============
function renderEmptyWithAI(title: string, hint: string, _text: string, _direction: AiDirection): string {
  const base = `
    <div class="empty-state">
      ${title}<br/>
      <small style="color:#bbb">${hint}</small>
    </div>`;
  if (AI_STATUS === "available") {
    return (
      base +
      `
      <div class="ai-fallback">
        <button class="btn btn-ai" id="btn-ai-try">
          🤖 用本地 AI 试试解读
        </button>
        <div class="ai-hint">本地运行 · 无需联网 · 推测结果仅供参考</div>
      </div>`
    );
  }
  if (AI_STATUS === "downloadable" || AI_STATUS === "downloading") {
    return (
      base +
      `
      <div class="ai-fallback">
        <button class="btn btn-ai" id="btn-ai-try">
          🤖 ${AI_STATUS === "downloading" ? "AI 模型下载中..." : "下载本地 AI 模型"}
        </button>
        <div class="ai-hint">首次需下载 ~4GB Gemini Nano 模型, 之后离线可用</div>
      </div>`
    );
  }
  return base;
}

function bindAIButton(text: string, direction: AiDirection): void {
  const btn = document.getElementById("btn-ai-try");
  if (!btn) return;
  btn.addEventListener("click", () => void runAIFallback(text, direction));
}

async function runAIFallback(text: string, direction: AiDirection): Promise<void> {
  if (typeof LanguageModel === "undefined") return;

  // 清空结果区，显示 AI 处理中
  resultArea.innerHTML = `
    <div class="result-group ai-group" id="ai-result">
      <div class="ai-badge">🤖 AI 推测 (Gemini Nano · 本地)</div>
      <div class="ai-text" id="ai-text"><span class="ai-cursor">▌</span></div>
      <div class="ai-disclaimer">⚠️ AI 推测仅供参考, 准确度低于词典</div>
    </div>`;
  const textEl = el<HTMLDivElement>("ai-text");

  try {
    const status = await LanguageModel.availability();
    AI_STATUS = status;
    if (status === "unavailable") {
      textEl.innerHTML = '<span style="color:#c62828">当前设备不支持 Built-in AI</span>';
      return;
    }

    // 拼接词典上下文（相关条目 + 风格样本）
    const ctx = await xyDict.getAIContext(text);
    const ctxBlock = [
      ctx.related.length
        ? `【与输入相关的词典条目】\n${ctx.related.map((e) => `${e.normal} = ${e.slangs.slice(0, 5).join("/")}  [${e.category}]`).join("\n")}`
        : "",
      `【词典样例 (学习这种风格)】\n${ctx.samples
        .slice(0, 24)
        .map((e) => `${e.normal} = ${e.slangs.slice(0, 5).join("/")}  [${e.category}]`)
        .join("\n")}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const sysPrompt =
      direction === "to-slang"
        ? `你是闲鱼二手交易平台的暗语翻译助手。用户给你一个正常关键词, 参考下面的内置词典, 给出在闲鱼上卖家会用到的 1-5 个隐晦同义词/谐音/缩写, 用顿号分隔, 不要解释。如果词典里已有, 优先复用词典里的写法; 没有时按词典风格扩展。\n\n${ctxBlock}`
        : `你是闲鱼二手交易平台的暗语解读助手。用户给你一段商品文字或暗语词, 参考下面的内置词典, 用一句话指出其中可疑/隐晦词的真实含义。如果词典里有, 直接引用词典释义; 词典里没有但风格相似, 按词典逻辑推测。完全是正常用语就回答"没有可疑暗语"。\n\n${ctxBlock}`;

    const session = await LanguageModel.create({
      temperature: 0.4,
      topK: 3,
      initialPrompts: [{ role: "system", content: sysPrompt }],
      monitor(m) {
        m.addEventListener("downloadprogress", (e) => {
          textEl.innerHTML = `<span style="color:#888">模型下载中 ${(e.loaded * 100).toFixed(0)}%...</span>`;
        });
      },
    });

    const userPrompt = direction === "to-slang" ? `关键词: ${text}` : `请解读: ${text}`;

    textEl.innerHTML = '<span class="ai-cursor">▌</span>';
    let buffer = "";
    const stream = session.promptStreaming(userPrompt);
    for await (const chunk of stream) {
      buffer += chunk;
      textEl.innerHTML = `${escapeHtml(buffer)}<span class="ai-cursor">▌</span>`;
    }
    textEl.innerHTML = escapeHtml(buffer);
    session.destroy();
  } catch (err) {
    textEl.innerHTML = `<span style="color:#c62828">调用失败: ${escapeHtml(errorMessage(err))}</span>`;
  }
}

async function probeAIStatus(): Promise<void> {
  try {
    if (typeof LanguageModel === "undefined") {
      AI_STATUS = "unavailable";
      return;
    }
    AI_STATUS = await LanguageModel.availability();
  } catch {
    AI_STATUS = "unavailable";
  }
}

function bindCopyTags(container: ParentNode, selector: string): void {
  container.querySelectorAll<HTMLElement>(selector).forEach((tag) => {
    tag.addEventListener("click", () => {
      const text = tag.dataset.copy ?? tag.textContent ?? "";
      void navigator.clipboard.writeText(text).then(() => {
        tag.classList.add("copied");
        setTimeout(() => tag.classList.remove("copied"), 1200);
      });
    });
  });
}

// ============ Dict panel ============
const dictList = el<HTMLDivElement>("dict-list");
const dictSearch = el<HTMLInputElement>("dict-search");
const dictStats = el<HTMLDivElement>("dict-stats");
const categoryChips = el<HTMLDivElement>("category-chips");
let dictRendered = false;

async function ensureDictRendered(): Promise<void> {
  if (!dictRendered) {
    // 懒加载分类全量数据
    CACHED_BROWSE = await xyDict.getAllForBrowse();
    renderCategoryChips();
    dictRendered = true;
  }
  renderDict();
}

function renderCategoryChips(): void {
  if (!CACHED_BROWSE) return;
  const browse = CACHED_BROWSE;
  let html = `<span class="cat-chip ${activeCategory === "__all__" ? "active" : ""}" data-cat="__all__">全部 <span class="chip-count">${browse.reduce(
    (s, c) => s + c.entries.length,
    0,
  )}</span></span>`;
  for (const cat of browse) {
    html += `<span class="cat-chip ${activeCategory === cat.id ? "active" : ""}" data-cat="${cat.id}">${cat.icon} ${escapeHtml(cat.name)} <span class="chip-count">${cat.entries.length}</span></span>`;
  }
  categoryChips.innerHTML = html;
  categoryChips.querySelectorAll<HTMLElement>(".cat-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      activeCategory = chip.dataset.cat ?? "__all__";
      categoryChips.querySelectorAll<HTMLElement>(".cat-chip").forEach((c) => {
        c.classList.toggle("active", c === chip);
      });
      renderDict();
    });
  });
}

function renderDict(): void {
  if (!CACHED_BROWSE) return;
  const filter = dictSearch.value.trim().toLowerCase();
  let html = "";
  let total = 0;
  let shown = 0;

  const cats = activeCategory === "__all__" ? CACHED_BROWSE : CACHED_BROWSE.filter((c) => c.id === activeCategory);

  for (const cat of cats) {
    const matched = cat.entries.filter((e) => {
      total++;
      if (!filter) return true;
      return e.normal.toLowerCase().includes(filter) || e.slangs.some((s) => s.toLowerCase().includes(filter));
    });
    if (matched.length === 0) continue;
    shown += matched.length;
    if (activeCategory === "__all__") {
      html += `<div class="dict-cat-header">${cat.icon} ${escapeHtml(cat.name)} · ${matched.length}</div>`;
    }
    for (const e of matched) {
      html += `
        <div class="dict-entry">
          <div class="dict-entry-normal">${escapeHtml(e.normal)}</div>
          <div class="dict-entry-slangs">
            ${e.slangs.map((s) => `<span class="dict-entry-slang" data-copy="${escapeHtml(s)}">${escapeHtml(s)}</span>`).join("")}
          </div>
        </div>`;
    }
  }

  dictList.innerHTML = html || '<div class="empty-state">没有匹配的词条</div>';
  dictStats.textContent = filter ? `显示 ${shown} / ${total} 条` : `共 ${total} 条`;
  bindCopyTags(dictList, ".dict-entry-slang");
}

dictSearch.addEventListener("input", () => {
  if (dictRendered) renderDict();
});

// ============ About panel - meta ============
async function renderMeta(): Promise<void> {
  META = await xyDict.getMeta();
  el<HTMLElement>("meta-version").textContent = META.version || "-";
  el<HTMLElement>("meta-updated").textContent = META.updatedAt || "-";
  el<HTMLElement>("meta-categories").textContent = String(META.stats?.categories ?? "-");
  el<HTMLElement>("meta-entries").textContent = `${META.stats?.entries ?? "-"} (${META.stats?.slangs ?? "-"} 个变体)`;
  el<HTMLElement>("title-sub").textContent = `v${META.version} · ${META.stats?.entries ?? "?"} 条`;
}

// ============ Decode toggle ============
const decodeToggle = el<HTMLInputElement>("setting-decode");
void (async () => {
  const data = (await browser.storage.local.get("decodeEnabled")) as Record<string, unknown>;
  decodeToggle.checked = data.decodeEnabled !== false;
})();
decodeToggle.addEventListener("change", () => {
  void browser.storage.local.set({ decodeEnabled: decodeToggle.checked });
});

// ============ Custom dict panel ============
const customNormal = el<HTMLInputElement>("custom-normal");
const customSlangs = el<HTMLInputElement>("custom-slangs");
const customAddBtn = el<HTMLButtonElement>("btn-custom-add");
const customCancelBtn = el<HTMLButtonElement>("btn-custom-cancel");
const customMsg = el<HTMLDivElement>("custom-form-msg");
const customStats = el<HTMLSpanElement>("custom-stats");
const customList = el<HTMLDivElement>("custom-list");
const customImportFile = el<HTMLInputElement>("custom-import-file");
let editingKey: string | null = null; // null = adding, string = editing this normal

function parseSlangs(raw: string): string[] {
  return raw
    .split(/[,，\s、；;|]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function showCustomMsg(text: string, kind?: string): void {
  customMsg.textContent = text;
  customMsg.className = `custom-form-msg ${kind ?? ""}`;
  if (text) {
    setTimeout(() => {
      if (customMsg.textContent === text) customMsg.textContent = "";
    }, 2500);
  }
}

function resetCustomForm(): void {
  customNormal.value = "";
  customSlangs.value = "";
  customNormal.disabled = false;
  customAddBtn.textContent = "+ 添加";
  customCancelBtn.style.display = "none";
  editingKey = null;
}

function startEditing(normal: string, slangs: string[]): void {
  editingKey = normal;
  customNormal.value = normal;
  customNormal.disabled = true; // normal 是 key，编辑时不允许改
  customSlangs.value = slangs.join(", ");
  customAddBtn.textContent = "保存修改";
  customCancelBtn.style.display = "";
  customNormal.scrollIntoView({ behavior: "smooth", block: "nearest" });
  customSlangs.focus();
}

customCancelBtn.addEventListener("click", () => {
  resetCustomForm();
  showCustomMsg("已取消", "info");
});

customAddBtn.addEventListener("click", async () => {
  const normal = customNormal.value.trim();
  const slangs = parseSlangs(customSlangs.value);
  if (!normal) {
    showCustomMsg("请填写正常词", "error");
    customNormal.focus();
    return;
  }
  if (slangs.length === 0) {
    showCustomMsg("请填写至少一个暗语变体", "error");
    customSlangs.focus();
    return;
  }
  try {
    await xyDict.upsertCustomEntry(normal, slangs);
    showCustomMsg(editingKey ? "已保存修改" : `已添加 ${slangs.length} 个变体`, "success");
    resetCustomForm();
    await renderCustomPanel();
  } catch (err) {
    showCustomMsg(`保存失败: ${errorMessage(err)}`, "error");
  }
});

// Enter 触发添加
for (const node of [customNormal, customSlangs]) {
  node.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      customAddBtn.click();
    }
  });
}

// 导出
el<HTMLButtonElement>("btn-custom-export").addEventListener("click", async () => {
  const dict = await xyDict.getCustomDict();
  const count = Object.keys(dict.entries).length;
  if (count === 0) {
    showCustomMsg("词典为空, 无可导出", "info");
    return;
  }
  const payload = {
    type: "xianyu-slang-helper-custom",
    version: 1,
    exportedAt: new Date().toISOString(),
    entries: dict.entries,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  a.download = `xianyu-custom-dict-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showCustomMsg(`已导出 ${count} 条`, "success");
});

// 导入
el<HTMLButtonElement>("btn-custom-import").addEventListener("click", () => {
  customImportFile.value = "";
  customImportFile.click();
});

customImportFile.addEventListener("change", async (e) => {
  const target = e.target;
  if (!(target instanceof HTMLInputElement)) return;
  const file = target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data: unknown = JSON.parse(text);
    let entries: Record<string, unknown> | null = null;
    if (data !== null && typeof data === "object") {
      const obj = data as Record<string, unknown>;
      const raw = obj.entries ?? obj;
      if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
        entries = raw as Record<string, unknown>;
      }
    }
    if (!entries) {
      throw new Error("JSON 格式应为 {entries: {...}} 或直接的 {正常词: [暗语]} 对象");
    }
    const existing = (await xyDict.getCustomDict()).entries;
    const hasExisting = Object.keys(existing).length > 0;
    let merged: Record<string, string[]>;
    if (hasExisting) {
      const choice = confirm("已存在自定义词条。\n确认 = 合并 (相同正常词的暗语取并集)\n取消 = 不导入");
      if (!choice) return;
      merged = { ...existing };
      for (const [k, v] of Object.entries(entries)) {
        const cur = merged[k] ?? [];
        const incoming = Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
        merged[k] = [...new Set([...cur, ...incoming])];
      }
    } else {
      merged = {};
      for (const [k, v] of Object.entries(entries)) {
        merged[k] = Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
      }
    }
    await xyDict.setCustomDict({ entries: merged });
    const count = Object.keys(merged).length;
    showCustomMsg(`导入成功, 共 ${count} 条`, "success");
    await renderCustomPanel();
  } catch (err) {
    showCustomMsg(`导入失败: ${errorMessage(err)}`, "error");
  }
});

// 清空
el<HTMLButtonElement>("btn-custom-clear").addEventListener("click", async () => {
  const dict = await xyDict.getCustomDict();
  const count = Object.keys(dict.entries).length;
  if (count === 0) {
    showCustomMsg("已经是空的", "info");
    return;
  }
  if (!confirm(`确认清空全部 ${count} 条自定义词条? 此操作不可撤销 (建议先导出备份)`)) return;
  await xyDict.clearCustomDict();
  resetCustomForm();
  showCustomMsg("已清空", "success");
  await renderCustomPanel();
});

async function renderCustomPanel(): Promise<void> {
  const dict = await xyDict.getCustomDict();
  const entries = Object.entries(dict.entries);
  customStats.textContent = `${entries.length} 条`;

  if (entries.length === 0) {
    customList.innerHTML = `
      <div class="empty-state">
        还没有自定义词条<br/>
        <small style="color:#bbb">在上方表单添加，例如 "<b>路由器</b>" → "<b>路油器, 网卡子</b>"</small>
      </div>`;
    return;
  }

  customList.innerHTML = entries
    .map(
      ([normal, slangs]) => `
    <div class="custom-entry" data-normal="${escapeHtml(normal)}">
      <div class="custom-entry-head">
        <span class="custom-entry-normal">${escapeHtml(normal)}</span>
        <div class="custom-entry-actions">
          <button class="btn-mini" data-action="edit">编辑</button>
          <button class="btn-mini btn-danger" data-action="delete">删除</button>
        </div>
      </div>
      <div class="custom-entry-slangs">
        ${slangs.map((s) => `<span class="custom-chip">${escapeHtml(s)}</span>`).join("")}
      </div>
    </div>
  `,
    )
    .join("");

  customList.querySelectorAll<HTMLElement>(".custom-entry").forEach((row) => {
    const normal = row.dataset.normal ?? "";
    const slangs = dict.entries[normal] ?? [];
    row.querySelector<HTMLButtonElement>('[data-action="edit"]')?.addEventListener("click", () => {
      startEditing(normal, slangs);
    });
    row.querySelector<HTMLButtonElement>('[data-action="delete"]')?.addEventListener("click", async () => {
      if (!confirm(`删除 "${normal}" 及其 ${slangs.length} 个变体?`)) return;
      await xyDict.deleteCustomEntry(normal);
      if (editingKey === normal) resetCustomForm();
      await renderCustomPanel();
      showCustomMsg(`已删除 "${normal}"`, "success");
    });
  });
}

// 监听 storage 变化，自动刷新词典面板和我的面板
browser.storage.onChanged.addListener((changes) => {
  if (changes.customDict) {
    // 词典页（浏览全部）也要重新拉
    dictRendered = false;
    CACHED_BROWSE = null;
    // 如果当前在显示这两个面板，立刻刷新
    const activePanel = document.querySelector(".panel.active")?.id;
    if (activePanel === "panel-custom") void renderCustomPanel();
    if (activePanel === "panel-dict") void ensureDictRendered();
  }
});

// ============ Init ============
void (async function init() {
  try {
    await Promise.all([renderMeta(), probeAIStatus()]);
  } catch (err) {
    console.warn("[xianyu-slang] popup 初始化失败", err);
    el<HTMLElement>("title-sub").textContent = "词典加载失败";
  }
  input.focus();
})();
