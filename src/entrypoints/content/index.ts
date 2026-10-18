import "./style.css";
import { browser } from "wxt/browser";
import { xyDict } from "@/dict/loader";
import type { ScanIndexes } from "@/dict/types";
import type { SlangMatcher } from "@/dict/matcher";

export default defineContentScript({
  matches: ["*://*.goofish.com/*", "*://*.xianyu.com/*", "*://2.taobao.com/*"],
  runAt: "document_idle",
  cssInjectionMode: "manifest",
  async main() {
    // 闭包内持有解密后的索引，不挂任何 window
    let _reverse: Record<string, string[]> = {};
    let _matcher: SlangMatcher | null = null;
    let _customSlangs: Set<string> = new Set();
    let decodeEnabled = true;

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

    // ============ 搜索词推荐面板 ============
    let searchPanel: HTMLDivElement | null = null;
    let currentInput: HTMLInputElement | HTMLElement | null = null;

    function createSearchPanel(): HTMLDivElement {
      const panel = document.createElement("div");
      panel.id = "xy-slang-panel";
      panel.style.display = "none";
      panel.innerHTML = `
      <div class="xy-panel-header">
        <span class="xy-panel-title">闲鱼词典</span>
        <span class="xy-panel-close">×</span>
      </div>
      <div class="xy-panel-body">
        <div class="xy-panel-hint">点击下方暗语替换搜索词</div>
        <div class="xy-slang-list"></div>
      </div>
    `;
      document.body.appendChild(panel);
      panel.querySelector(".xy-panel-close")?.addEventListener("click", () => {
        panel.style.display = "none";
      });
      document.addEventListener("mousedown", (e) => {
        if (panel.style.display === "none") return;
        const target = e.target as Node | null;
        if (target && !panel.contains(target) && (!currentInput || !currentInput.contains(target))) {
          panel.style.display = "none";
        }
      });
      return panel;
    }

    async function showSlangSuggestions(input: HTMLInputElement | HTMLElement): Promise<void> {
      const rawValue = input instanceof HTMLInputElement ? input.value : (input.textContent ?? "");
      const value = rawValue.trim();
      if (!value) {
        if (searchPanel) searchPanel.style.display = "none";
        return;
      }
      const matches = await xyDict.suggestSlangsFor(value);
      if (matches.length === 0) {
        if (searchPanel) searchPanel.style.display = "none";
        return;
      }

      if (!searchPanel) searchPanel = createSearchPanel();
      currentInput = input;

      const list = searchPanel.querySelector(".xy-slang-list");
      if (!list) return;
      list.innerHTML = "";

      matches.slice(0, 8).forEach(({ normal, slangs, exact }) => {
        const group = document.createElement("div");
        group.className = "xy-slang-group";
        group.innerHTML = `
        <div class="xy-slang-normal">${exact ? "✓ " : ""}${escapeHtml(normal)}</div>
        <div class="xy-slang-tags"></div>
      `;
        const tagsDiv = group.querySelector(".xy-slang-tags");
        if (!tagsDiv) return;
        slangs.forEach((slang) => {
          const tag = document.createElement("span");
          tag.className = "xy-slang-tag";
          tag.textContent = slang;
          tag.title = `点击替换为 "${slang}"`;
          tag.addEventListener("mousedown", (e) => {
            e.preventDefault();
            replaceSearchValue(slang);
          });
          tagsDiv.appendChild(tag);
        });
        list.appendChild(group);
      });

      const rect = input.getBoundingClientRect();
      const minWidth = Math.max(rect.width, 280);
      let left = window.scrollX + rect.left;
      const maxLeft = window.scrollX + document.documentElement.clientWidth - minWidth - 12;
      if (left > maxLeft) left = Math.max(window.scrollX + 12, maxLeft);

      searchPanel.style.top = `${window.scrollY + rect.bottom + 6}px`;
      searchPanel.style.left = `${left}px`;
      searchPanel.style.minWidth = `${minWidth}px`;
      searchPanel.style.display = "block";
    }

    function replaceSearchValue(newValue: string): void {
      if (!currentInput) return;
      if (currentInput instanceof HTMLInputElement) {
        const proto = Object.getPrototypeOf(currentInput) as HTMLInputElement;
        const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
        if (setter) setter.call(currentInput, newValue);
        else currentInput.value = newValue;
        currentInput.dispatchEvent(new Event("input", { bubbles: true }));
        currentInput.dispatchEvent(new Event("change", { bubbles: true }));
        currentInput.focus();
      } else if (currentInput.isContentEditable) {
        currentInput.textContent = newValue;
        currentInput.dispatchEvent(new Event("input", { bubbles: true }));
        (currentInput as HTMLElement).focus();
      }
      if (searchPanel) searchPanel.style.display = "none";
    }

    // 判断是否目标输入：排除密码/隐藏/checkbox/radio/submit 等明显非搜索的
    const NON_TEXT_TYPES: Record<string, true> = {
      hidden: true,
      checkbox: true,
      radio: true,
      submit: true,
      button: true,
      reset: true,
      password: true,
      file: true,
      image: true,
      color: true,
      range: true,
      date: true,
      "datetime-local": true,
      month: true,
      time: true,
      week: true,
    };

    function isSearchableInput(el: EventTarget | Element | null): el is HTMLInputElement | HTMLElement {
      if (!el || !(el instanceof Element)) return false;
      const htmlEl = el as HTMLElement;
      if (htmlEl.tagName === "INPUT") {
        const input = htmlEl as HTMLInputElement;
        const t = (input.type || "").toLowerCase();
        if (NON_TEXT_TYPES[t]) return false;
        if (input.readOnly || input.disabled) return false;
        return true;
      }
      if (htmlEl.tagName === "TEXTAREA") return false;
      if (htmlEl.getAttribute("role") === "searchbox") return true;
      if (htmlEl.getAttribute("role") === "combobox" && htmlEl.isContentEditable) return true;
      return false;
    }

    function bindOneInput(input: HTMLInputElement | HTMLElement): void {
      if (input.dataset.xySlangBound) return;
      input.dataset.xySlangBound = "1";
      let debounceId: number | undefined;
      input.addEventListener("input", () => {
        clearTimeout(debounceId);
        debounceId = window.setTimeout(() => void showSlangSuggestions(input), 80);
      });
      input.addEventListener("focus", () => {
        const v = input instanceof HTMLInputElement ? input.value : (input.textContent ?? "");
        if (v?.trim()) void showSlangSuggestions(input);
      });
      input.addEventListener("click", () => {
        const v = input instanceof HTMLInputElement ? input.value : (input.textContent ?? "");
        if (v?.trim()) void showSlangSuggestions(input);
      });
      input.addEventListener("blur", () => {
        setTimeout(() => {
          if (searchPanel && !searchPanel.matches(":hover")) {
            searchPanel.style.display = "none";
          }
        }, 200);
      });
    }

    function bindSearchInputs(): void {
      // 1) 静态扫描（兜底）
      document.querySelectorAll("input, [role='searchbox'], [role='combobox']").forEach((el) => {
        if (isSearchableInput(el)) bindOneInput(el);
      });
      // 2) 事件代理——抓后续动态插入的 input
      if (document.body.dataset.xySlangDelegated) return;
      document.body.dataset.xySlangDelegated = "1";
      document.addEventListener(
        "focusin",
        (e: FocusEvent) => {
          const t = e.target;
          if (isSearchableInput(t)) bindOneInput(t);
        },
        true,
      );
    }

    // ============ 暗语解读 Tooltip ============
    let tooltip: HTMLDivElement | null = null;

    function createTooltip(): HTMLDivElement {
      const t = document.createElement("div");
      t.id = "xy-slang-tooltip";
      t.style.display = "none";
      document.body.appendChild(t);
      return t;
    }

    function showTooltip(target: Element, text: string): void {
      if (!tooltip) tooltip = createTooltip();
      tooltip.textContent = text;
      tooltip.style.display = "block";
      tooltip.style.visibility = "hidden";

      const rect = target.getBoundingClientRect();
      const tooltipHeight = tooltip.offsetHeight;
      const tooltipWidth = tooltip.offsetWidth;
      const viewportWidth = document.documentElement.clientWidth;

      // 上方空间不足时向下翻转
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;
      let top = window.scrollY + rect.top - tooltipHeight - 8;
      if (spaceAbove < tooltipHeight + 12 && spaceBelow > spaceAbove) {
        top = window.scrollY + rect.bottom + 8;
      }

      // 水平方向视口 clamp 限制
      let left = window.scrollX + rect.left;
      const maxLeft = window.scrollX + viewportWidth - tooltipWidth - 12;
      const minLeft = window.scrollX + 12;
      if (left > maxLeft) left = maxLeft;
      if (left < minLeft) left = minLeft;

      tooltip.style.top = `${top}px`;
      tooltip.style.left = `${left}px`;
      tooltip.style.visibility = "visible";
    }

    function hideTooltip(): void {
      if (tooltip) tooltip.style.display = "none";
    }

    const CJK_RE = /[㐀-鿿]/;
    const ASCII_LETTER_RE = /[A-Za-z]/;
    const ASCII_ALNUM_RE = /[A-Za-z0-9]/;

    // 精准上下文边界检测：跳过明显是正常单词子串或特定上下文的部分匹配
    // 1. 纯英文字母/拼音暗语（如 by, ip, wtb, lol, mha, ys, ns, sup）：
    //    前后不能紧挨其他英文字母（防止匹配 standby, copy, laptop, iPhone 等正常单词子串）
    // 2. 字母+数字型号暗语（如 a73, p5, bf4, 4o, o1）：
    //    前后不能紧挨字母或数字（防止 a73 误伤 a7300, p5 误伤 p50）
    // 3. 符号类暗号（如 a/）：
    //    避免在 URL / 路径中误报（如 https://... 或 /a/b）
    // 4. 单字 CJK（如用户自定义词条）：
    //    前后若为连续汉字则跳过复合词
    function shouldSkipMatch(text: string, idx: number, slang: string): boolean {
      const before = idx > 0 ? (text[idx - 1] ?? "") : "";
      const after = idx + slang.length < text.length ? (text[idx + slang.length] ?? "") : "";

      // 纯字母缩写
      if (/^[A-Za-z]+$/.test(slang)) {
        if (ASCII_LETTER_RE.test(before) || ASCII_LETTER_RE.test(after)) return true;
      } else if (/^[A-Za-z0-9]+$/.test(slang)) {
        // 字母数字混合型号
        if (ASCII_ALNUM_RE.test(before) || ASCII_ALNUM_RE.test(after)) return true;
      }

      // URL / 文件路径防护（如 a/）
      if (slang.includes("/")) {
        if (before === "/" || before === ":" || before === "." || after === "/" || after === "\\") {
          return true;
        }
      }

      // 单字汉字复合词防护（兜底保护）
      if (slang.length === 1 && CJK_RE.test(slang)) {
        if (CJK_RE.test(before) || CJK_RE.test(after)) return true;
      }

      return false;
    }

    function annotateNode(textNode: Text): void {
      if (!_matcher || !_reverse) return;
      const text = textNode.nodeValue;
      if (!text || text.length < 1) return;
      const matches = _matcher.match(text);
      if (matches.length === 0) return;

      const frag = document.createDocumentFragment();
      let lastIndex = 0;
      let hadAny = false;
      for (const match of matches) {
        if (shouldSkipMatch(text, match.start, match.word)) continue;
        if (match.start > lastIndex) {
          frag.appendChild(document.createTextNode(text.slice(lastIndex, match.start)));
        }
        const slang = match.word;
        const meanings = _reverse[slang] ?? _reverse[slang.toLowerCase()] ?? [];
        const isCustom = _customSlangs.has(slang);
        const span = document.createElement("span");
        span.className = isCustom ? "xy-slang-mark xy-slang-mark-custom" : "xy-slang-mark";
        span.textContent = slang;
        span.addEventListener("mouseenter", () => {
          const prefix = isCustom ? "我的词典: " : "暗语: ";
          showTooltip(span, `${prefix}${slang} → ${meanings.join(" / ")}`);
        });
        span.addEventListener("mouseleave", hideTooltip);
        frag.appendChild(span);
        lastIndex = match.end;
        hadAny = true;
      }
      if (!hadAny) return; // 所有匹配都被跳过，别替换 text 节点
      if (lastIndex < text.length) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex)));
      }
      textNode.parentNode?.replaceChild(frag, textNode);
    }

    const SKIP_TAGS: Record<string, true> = {
      SCRIPT: true,
      STYLE: true,
      INPUT: true,
      TEXTAREA: true,
      SELECT: true,
      CODE: true,
      PRE: true,
      NOSCRIPT: true,
    };

    function walkAndAnnotate(root: Node | null): void {
      if (!decodeEnabled || !_matcher) return;
      if (!root || root.nodeType !== Node.ELEMENT_NODE) return;
      const rootEl = root as Element;
      if (rootEl.id === "xy-slang-panel" || rootEl.id === "xy-slang-tooltip") return;

      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node: Node): number {
          const p = node.parentNode as HTMLElement | null;
          if (!p) return NodeFilter.FILTER_REJECT;
          if (SKIP_TAGS[p.tagName]) return NodeFilter.FILTER_REJECT;
          if (p.classList?.contains("xy-slang-mark")) return NodeFilter.FILTER_REJECT;
          if (p.closest?.("#xy-slang-panel")) return NodeFilter.FILTER_REJECT;
          if (!node.nodeValue?.trim()) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      const nodes: Text[] = [];
      let n: Node | null;
      while ((n = walker.nextNode())) nodes.push(n as Text);
      nodes.forEach(annotateNode);
      if (nodes.length > 0) updateFab();
    }

    function removeAllMarks(): void {
      document.querySelectorAll(".xy-slang-mark").forEach((span) => {
        const parent = span.parentNode;
        if (parent) {
          parent.replaceChild(document.createTextNode(span.textContent ?? ""), span);
          parent.normalize();
        }
      });
      updateFab();
    }

    // ============ 详情页解读浮层（FAB + 侧滑） ============
    interface PageSlangInfo {
      count: number;
      meanings: string[];
      samples: string[];
    }

    let fab: HTMLDivElement | null = null;
    let detailPanel: HTMLDivElement | null = null;
    let updateFabScheduled = false;

    function ensureFab(): void {
      if (fab) return;
      fab = document.createElement("div");
      fab.id = "xy-fab";
      fab.title = "查看本页全部暗语";
      fab.innerHTML = `
      <span class="xy-fab-icon">🔍</span>
      <span class="xy-fab-count">0</span>
    `;
      fab.addEventListener("click", () => toggleDetailPanel());
      document.body.appendChild(fab);

      detailPanel = document.createElement("div");
      detailPanel.id = "xy-detail-panel";
      detailPanel.innerHTML = `
      <div class="xy-detail-header">
        <span class="xy-detail-title">本页暗语解读</span>
        <span class="xy-detail-close">×</span>
      </div>
      <div class="xy-detail-stats"></div>
      <div class="xy-detail-body"></div>
    `;
      detailPanel.querySelector(".xy-detail-close")?.addEventListener("click", () => {
        detailPanel?.classList.remove("xy-open");
      });
      document.body.appendChild(detailPanel);
    }

    function collectSlangsInPage(): Map<string, PageSlangInfo> {
      const map = new Map<string, PageSlangInfo>(); // slang -> { count, meanings, samples: [snippet...] }
      document.querySelectorAll(".xy-slang-mark").forEach((span) => {
        const slang = span.textContent ?? "";
        const meanings = _reverse[slang] ?? _reverse[slang.toLowerCase()] ?? [];
        if (!map.has(slang)) {
          map.set(slang, { count: 0, meanings, samples: [] });
        }
        const entry = map.get(slang);
        if (!entry) return;
        entry.count++;
        // 收集上下文片段（前后各 10 字）
        if (entry.samples.length < 2) {
          const parent = span.parentNode;
          if (parent) {
            const full = parent.textContent || "";
            const idx = full.indexOf(slang);
            if (idx >= 0) {
              const start = Math.max(0, idx - 10);
              const end = Math.min(full.length, idx + slang.length + 10);
              entry.samples.push(full.slice(start, end).trim());
            }
          }
        }
      });
      return map;
    }

    function renderDetailPanel(): void {
      if (!detailPanel) return;
      const map = collectSlangsInPage();
      const items = [...map.entries()].toSorted((a, b) => b[1].count - a[1].count);

      const statsEl = detailPanel.querySelector(".xy-detail-stats");
      const bodyEl = detailPanel.querySelector(".xy-detail-body");
      if (!statsEl || !bodyEl) return;

      if (items.length === 0) {
        statsEl.textContent = "未在本页检测到暗语";
        bodyEl.innerHTML = "<div class='xy-detail-empty'>把鼠标移到页面上其它有下划线的词查看含义</div>";
        return;
      }
      const totalUnique = items.length;
      const totalHits = items.reduce((s, [, v]) => s + v.count, 0);
      statsEl.textContent = `共 ${totalUnique} 个暗语 / ${totalHits} 处出现`;

      bodyEl.innerHTML = items
        .map(([slang, info]) => {
          const sample = info.samples[0]
            ? `<div class="xy-detail-sample">"…${escapeHtml(info.samples[0])}…"</div>`
            : "";
          return `
        <div class="xy-detail-entry" data-slang="${escapeHtml(slang)}">
          <div class="xy-detail-row">
            <span class="xy-detail-slang">${escapeHtml(slang)}</span>
            <span class="xy-detail-arrow">→</span>
            <span class="xy-detail-meaning">${escapeHtml(info.meanings.join(" / "))}</span>
            <span class="xy-detail-count">${info.count}</span>
          </div>
          ${sample}
        </div>`;
        })
        .join("");

      // 点击条目滚动到第一处出现位置
      bodyEl.querySelectorAll(".xy-detail-entry").forEach((row) => {
        row.addEventListener("click", () => {
          const slang = (row as HTMLElement).dataset.slang;
          const target = [...document.querySelectorAll(".xy-slang-mark")].find((m) => m.textContent === slang) as
            | HTMLElement
            | undefined;
          if (target) {
            target.scrollIntoView({ behavior: "smooth", block: "center" });
            target.classList.add("xy-slang-flash");
            setTimeout(() => target.classList.remove("xy-slang-flash"), 1200);
          }
        });
      });
    }

    function updateFab(): void {
      if (updateFabScheduled) return;
      updateFabScheduled = true;
      requestAnimationFrame(() => {
        updateFabScheduled = false;
        const count = document.querySelectorAll(".xy-slang-mark").length;
        if (count === 0) {
          if (fab) fab.style.display = "none";
          return;
        }
        ensureFab();
        if (!fab) return;
        fab.style.display = "flex";
        const countEl = fab.querySelector(".xy-fab-count");
        if (countEl) countEl.textContent = String(Math.min(99, count));
        // 若面板开着，实时刷新
        if (detailPanel?.classList.contains("xy-open")) {
          renderDetailPanel();
        }
      });
    }

    function toggleDetailPanel(): void {
      ensureFab();
      if (!detailPanel) return;
      const isOpen = detailPanel.classList.toggle("xy-open");
      if (isOpen) renderDetailPanel();
    }

    async function reloadIndexes(): Promise<void> {
      const indexes: ScanIndexes = await xyDict.getScanIndexes();
      _matcher = indexes.matcher;
      _reverse = indexes.reverse;
      _customSlangs = indexes.customSlangs ?? new Set<string>();
    }

    // ============ 初始化 ============
    async function init(): Promise<void> {
      try {
        await reloadIndexes();
      } catch (err) {
        console.warn("[xianyu-slang] 词典解密失败", err);
        return;
      }

      const settings = await browser.storage.local.get(["decodeEnabled"]);
      const record = settings as Record<string, unknown>;
      decodeEnabled = record.decodeEnabled !== false;

      bindSearchInputs();
      walkAndAnnotate(document.body);

      // 无限滚动时每个新卡片都会触发一次 mutation。原先是在回调里同步 walkAndAnnotate，
      // 一帧内插入 N 个卡片就串行扫 N 次，把主线程占满。改成攒到下一帧一次性处理。
      let pendingRoots: Node[] = [];
      let scanRaf = 0;
      const scheduleAnnotate = (root: Node): void => {
        pendingRoots.push(root);
        if (scanRaf) return;
        scanRaf = requestAnimationFrame(() => {
          scanRaf = 0;
          const batch = pendingRoots;
          pendingRoots = [];
          for (const r of batch) walkAndAnnotate(r);
        });
      };

      const observer = new MutationObserver((mutations: MutationRecord[]) => {
        let needBind = false;
        mutations.forEach((m) => {
          m.addedNodes.forEach((node) => {
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            const el = node as Element;
            if (el.tagName === "INPUT" || el.querySelector?.("input")) {
              needBind = true;
            }
            scheduleAnnotate(node);
          });
        });
        if (needBind) bindSearchInputs();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    browser.storage.onChanged.addListener(async (changes) => {
      if (changes.decodeEnabled) {
        decodeEnabled = changes.decodeEnabled.newValue !== false;
        if (!decodeEnabled) removeAllMarks();
        else walkAndAnnotate(document.body);
      }
      if (changes.customDict) {
        // 自定义词典变化 -> 重建索引，清掉旧高亮再重扫
        try {
          await reloadIndexes();
          removeAllMarks();
          if (decodeEnabled) walkAndAnnotate(document.body);
        } catch (err) {
          console.warn("[xianyu-slang] 自定义词典重载失败", err);
        }
      }
    });

    await init();
  },
});
