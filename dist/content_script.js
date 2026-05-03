"use strict";
(() => {
  // src/content_script/domExtractor.ts
  function debug(...args) {
    console.log("[DeepSeek Exporter]", ...args);
  }
  function getChatScrollContainer() {
    const selectors = [
      ".dad65929",
      ".e1f93b07",
      "main",
      '[class*="chat"][class*="container"]',
      '[class*="conversation"]'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.scrollHeight > el.clientHeight) return el;
    }
    for (const sel of [".ds-message", ".fbb737a4", '[class*="message"]']) {
      const first = document.querySelector(sel);
      if (first) {
        let node = first.parentElement;
        while (node && node !== document.body) {
          const style = window.getComputedStyle(node);
          if ((style.overflowY === "auto" || style.overflowY === "scroll") && node.scrollHeight > node.clientHeight) {
            return node;
          }
          node = node.parentElement;
        }
      }
    }
    debug("No scroll container found, using documentElement");
    return document.documentElement;
  }
  function getScrollTop(el) {
    if (el === document.documentElement || el === document.body) {
      return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    }
    return el.scrollTop;
  }
  function setScrollTop(el, val) {
    if (el === document.documentElement || el === document.body) {
      window.scrollTo(0, Math.max(0, val));
      return;
    }
    el.scrollTop = Math.max(0, val);
  }
  function getScrollHeight(el) {
    if (el === document.documentElement || el === document.body) {
      return Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    }
    return el.scrollHeight;
  }
  function getClientHeight(el) {
    if (el === document.documentElement || el === document.body) {
      return window.innerHeight || document.documentElement.clientHeight || 0;
    }
    return el.clientHeight;
  }
  async function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
  async function scrollStep(container, targetTop, settleMs = 600) {
    setScrollTop(container, targetTop);
    const start = Date.now();
    while (Date.now() - start < settleMs) {
      await delay(80);
    }
    await delay(100);
  }
  function getConversationTitle() {
    const nodes = [
      document.querySelector(".f8d1e4c0 .afa34042"),
      document.querySelector(".f8d1e4c0"),
      document.querySelector('[class*="title"]'),
      document.querySelector("h1")
    ];
    for (const node of nodes) {
      if (!node) continue;
      const text = (node.textContent || "").trim();
      if (text && text.length > 2) return text;
    }
    return (document.title || "").trim() || "Untitled";
  }
  function messageSignature(role, content) {
    return `${role}::${content.replace(/\s+/g, " ").trim().slice(0, 200)}`;
  }
  function extractVisibleMessages(title, container) {
    const messages = [];
    const root = container || document;
    const userSelectors = [".fbb737a4", '[class*="user-question"]', '[class*="user_question"]', '.ds-message[class*="user"]'];
    const aiSelectors = [".ds-message .ds-markdown", ".ds-markdown", '[class*="message-content"]'];
    const cotSelectors = [".ds-message .ds-think-content", ".ds-think-content", '[class*="think-content"]'];
    let userBlocks = root.querySelectorAll(userSelectors[0]);
    if (userBlocks.length === 0) {
      for (let i = 1; i < userSelectors.length; i++) {
        userBlocks = root.querySelectorAll(userSelectors[i]);
        if (userBlocks.length > 0) break;
      }
    }
    let aiBlocks = root.querySelectorAll(aiSelectors[0]);
    if (aiBlocks.length === 0) {
      for (let i = 1; i < aiSelectors.length; i++) {
        aiBlocks = root.querySelectorAll(aiSelectors[i]);
        if (aiBlocks.length > 0) break;
      }
    }
    let cotBlocks = root.querySelectorAll(cotSelectors[0]);
    if (cotBlocks.length === 0) {
      for (let i = 1; i < cotSelectors.length; i++) {
        cotBlocks = root.querySelectorAll(cotSelectors[i]);
        if (cotBlocks.length > 0) break;
      }
    }
    if (userBlocks.length === 0 && aiBlocks.length === 0) {
      debug("No messages found with any selector. user:", userSelectors[0], "ai:", aiSelectors[0]);
      return [];
    }
    const entries = [];
    userBlocks.forEach((el) => entries.push({ el, type: "user" }));
    aiBlocks.forEach((el) => entries.push({ el, type: "ai" }));
    cotBlocks.forEach((el) => entries.push({ el, type: "cot" }));
    entries.sort((a, b) => {
      const pos = a.el.compareDocumentPosition(b.el);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });
    let pendingCot = null;
    let msgIndex = 0;
    let userCount = 0;
    let aiCount = 0;
    for (const entry of entries) {
      if (entry.type === "user") {
        const text = (entry.el.textContent || "").trim();
        if (!text) continue;
        messages.push({
          id: `u_${msgIndex}`,
          role: "user",
          content: text,
          create_time: Date.now(),
          conversationTitle: title
        });
        msgIndex++;
        userCount++;
      } else if (entry.type === "cot") {
        pendingCot = entry.el;
      } else if (entry.type === "ai") {
        let content = domToMarkdown(entry.el);
        if (!content.trim()) continue;
        if (pendingCot) {
          const cotText = (pendingCot.textContent || "").trim();
          if (cotText) {
            content = `> **Thinking:**
> ${cotText.replace(/\n/g, "\n> ")}

${content}`;
          }
          pendingCot = null;
        }
        messages.push({
          id: `a_${msgIndex}`,
          role: "assistant",
          content,
          create_time: Date.now(),
          conversationTitle: title
        });
        msgIndex++;
        aiCount++;
      }
    }
    debug(`Extracted ${userCount} user + ${aiCount} ai messages`);
    return messages;
  }
  function inlineContent(el) {
    let result = "";
    for (const child of el.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) result += child.textContent || "";
      else if (child.nodeType === Node.ELEMENT_NODE) {
        const childEl = child;
        if (isCoTElement(childEl)) continue;
        result += elementToMarkdown(childEl);
      }
    }
    return result;
  }
  function isCoTElement(el) {
    const selectors = [".ds-think-content", '[class*="think-content"]'];
    for (const sel of selectors) {
      if (el.matches(sel) || el.querySelector(sel)) return true;
    }
    return false;
  }
  function elementToMarkdown(el) {
    const tag = el.tagName.toLowerCase();
    if (isCoTElement(el)) return "";
    if (el.classList.contains("md-code-block")) return extractCodeBlock(el);
    if (el.classList.contains("katex")) return extractKatex(el);
    switch (tag) {
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6": {
        return `
${"#".repeat(parseInt(tag.charAt(1)))} ${inlineContent(el)}

`;
      }
      case "p":
        return `${inlineContent(el)}

`;
      case "br":
        return "  \n";
      case "hr":
        return "\n---\n\n";
      case "strong":
      case "b":
        return `**${inlineContent(el)}**`;
      case "em":
      case "i":
        return `*${inlineContent(el)}*`;
      case "code":
        if (!el.closest(".md-code-block")) return `\`${(el.textContent || "").trim()}\``;
        return el.textContent || "";
      case "a": {
        return inlineContent(el).trim();
      }
      case "img":
        return `![${el.getAttribute("alt") || ""}](${el.getAttribute("src") || ""})`;
      case "ul": {
        let out = "\n";
        el.querySelectorAll(":scope > li").forEach((li) => {
          out += `- ${domToMarkdown(li) || (li.textContent || "").trim()}
`;
        });
        return `${out}
`;
      }
      case "ol": {
        let out = "\n";
        let idx = 1;
        el.querySelectorAll(":scope > li").forEach((li) => {
          out += `${idx}. ${domToMarkdown(li) || (li.textContent || "").trim()}
`;
          idx++;
        });
        return `${out}
`;
      }
      case "blockquote": {
        let content = "";
        for (const child of el.childNodes) {
          if (child.nodeType === Node.TEXT_NODE) content += child.textContent || "";
          else if (child.nodeType === Node.ELEMENT_NODE) content += elementToMarkdown(child);
        }
        return `> ${content.trim().split("\n").join("\n> ")}

`;
      }
      case "pre": {
        const codeText = el.textContent || "";
        let lang = "";
        const parentEl = el.parentElement;
        if (parentEl) {
          const badge = parentEl.querySelector('[class*="language"], [data-language]');
          if (badge) lang = (badge.textContent || badge.getAttribute("data-language") || "").trim();
        }
        if (!lang && /(graph|flowchart|sequenceDiagram|classDiagram)/i.test(codeText)) lang = "mermaid";
        return `\`\`\`${lang}
${codeText}
\`\`\`

`;
      }
      case "table":
        return tableToMarkdown(el);
      default:
        return inlineContent(el);
    }
  }
  function domToMarkdown(el) {
    let result = "";
    for (const child of el.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) result += child.textContent || "";
      else if (child.nodeType === Node.ELEMENT_NODE) result += elementToMarkdown(child);
    }
    return result.trim();
  }
  function extractCodeBlock(el) {
    const cachedCode = el.getAttribute("data-export-code");
    const cachedLang = el.getAttribute("data-export-lang");
    if (cachedCode) return `\`\`\`${cachedLang || ""}
${cachedCode}
\`\`\`

`;
    const pre = el.querySelector("pre");
    if (pre && pre.textContent) {
      let lang = "";
      const langEl = el.querySelector(".d813de27, [data-language]");
      if (langEl) lang = (langEl.textContent || langEl.getAttribute("data-language") || "").trim();
      const text = (pre.textContent || "").replace(/ /g, " ").trim();
      if (text) return `\`\`\`${lang}
${text}
\`\`\`

`;
    }
    return "";
  }
  function extractKatex(el) {
    const annotation = el.querySelector('annotation[encoding="application/x-tex"]');
    if (!annotation) return el.textContent || "";
    const tex = (annotation.textContent || "").trim();
    if (!tex) return el.textContent || "";
    return `
$$
${tex}
$$
`;
  }
  function tableToMarkdown(table) {
    const rows = table.querySelectorAll("tr");
    if (rows.length === 0) return "";
    const headers = [];
    const headerCells = rows[0].querySelectorAll("th, td");
    headerCells.forEach((cell) => headers.push((cell.textContent || "").trim().replace(/\|/g, "\\|")));
    if (headers.length === 0) return "";
    const data = [];
    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i].querySelectorAll("td, th");
      const row = [];
      cells.forEach((cell) => row.push((cell.textContent || "").trim().replace(/\|/g, "\\|")));
      while (row.length < headers.length) row.push("");
      data.push(row.slice(0, headers.length));
    }
    let md = `| ${headers.join(" | ")} |
`;
    md += `| ${headers.map(() => "---").join(" | ")} |
`;
    data.forEach((row) => {
      md += `| ${row.join(" | ")} |
`;
    });
    return `${md}
`;
  }
  async function collectAllMessages() {
    const chatId = window.location.pathname.match(/\/chat\/([a-zA-Z0-9_-]+)/)?.[1] || "unknown";
    const title = getConversationTitle();
    const container = getChatScrollContainer();
    const originalTop = getScrollTop(container);
    debug(`Starting collection. Container: ${container.tagName}, scrollHeight: ${getScrollHeight(container)}, title: "${title}"`);
    const quickCheck = extractVisibleMessages(title);
    if (quickCheck.length > 0) {
      debug("Messages already visible, no scrolling needed");
      return { chat_id: chatId, title, messages: quickCheck };
    }
    debug("No visible messages yet, scrolling to load...");
    const seen = /* @__PURE__ */ new Set();
    const ordered = [];
    const startedAt = Date.now();
    const totalTimeout = 2e4;
    function addFresh() {
      const fresh = extractVisibleMessages(title, document);
      let added = 0;
      for (const m of fresh) {
        const sig = messageSignature(m.role, m.content);
        if (!seen.has(sig)) {
          seen.add(sig);
          ordered.push(m);
          added++;
        }
      }
      return added;
    }
    debug("Scrolling to top...");
    let scrollAttempts = 0;
    const maxScrollAttempts = 12;
    while (Date.now() - startedAt < totalTimeout && scrollAttempts < maxScrollAttempts) {
      const currentTop2 = getScrollTop(container);
      const clientHeight = getClientHeight(container);
      const scrollHeight = getScrollHeight(container);
      const isAtTop = currentTop2 <= 2;
      const step = Math.max(400, clientHeight * 0.8);
      if (isAtTop) {
        debug("Reached top");
        break;
      }
      const targetTop = Math.max(0, currentTop2 - step);
      await scrollStep(container, targetTop, 400);
      const added = addFresh();
      scrollAttempts++;
      debug(`Scroll up #${scrollAttempts}: top=${targetTop.toFixed(0)}, messages=${ordered.length}, added=${added}`);
    }
    debug("Collecting on scroll down...");
    let currentTop = getScrollTop(container);
    let downAttempts = 0;
    const maxDownAttempts = 12;
    while (Date.now() - startedAt < totalTimeout && downAttempts < maxDownAttempts) {
      const clientHeight = getClientHeight(container);
      const scrollHeight = getScrollHeight(container);
      const atBottom = currentTop + clientHeight >= scrollHeight - 4;
      addFresh();
      if (atBottom) {
        debug("Reached bottom");
        break;
      }
      const step = Math.max(400, clientHeight * 0.7);
      currentTop = Math.min(scrollHeight - clientHeight, currentTop + step);
      await scrollStep(container, currentTop, 300);
      downAttempts++;
      debug(`Scroll down #${downAttempts}: top=${currentTop.toFixed(0)}, messages=${ordered.length}`);
    }
    addFresh();
    setScrollTop(container, originalTop);
    debug(`Collection done: ${ordered.length} messages in ${Date.now() - startedAt}ms`);
    return { chat_id: chatId, title, messages: ordered };
  }

  // src/content_script.ts
  var PAGE_SCRIPT_FILE = "page_inject.js";
  var SENDER_ID = "__DEEPSEEK_EXPORTER__";
  var injected = false;
  var overlayEl = null;
  function showProgressOverlay() {
    if (overlayEl) return;
    overlayEl = document.createElement("div");
    overlayEl.id = "__deepseek_exporter_overlay";
    overlayEl.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;z-index:999999;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-family:sans-serif;font-size:16px;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,0.5);";
    overlayEl.textContent = "DeepSeek Exporter \u2014 Loading messages...";
    document.body.appendChild(overlayEl);
  }
  function hideProgressOverlay() {
    if (overlayEl) {
      overlayEl.remove();
      overlayEl = null;
    }
  }
  function injectPageScript() {
    if (injected) return;
    injected = true;
    const script = document.createElement("script");
    script.src = browser.runtime.getURL(PAGE_SCRIPT_FILE);
    script.onload = () => {
      script.remove();
    };
    script.onerror = () => {
      console.error("[DeepSeek Exporter] Failed to inject page script");
      injected = false;
    };
    (document.head || document.documentElement).appendChild(script);
  }
  var cachedDBData = null;
  var dataReadyResolve = null;
  window.addEventListener("message", (event) => {
    if (event.data?.sender !== SENDER_ID) return;
    if (event.data.type === "PAGE_DATA") {
      cachedDBData = event.data.payload;
      if (dataReadyResolve) {
        dataReadyResolve();
        dataReadyResolve = null;
      }
    } else if (event.data.type === "PAGE_ERROR") {
      console.error("[DeepSeek Exporter] Page script error:", event.data.payload);
    }
  });
  browser.runtime.onMessage.addListener(async (message) => {
    if (message?.type === "PING") {
      return { type: "PONG" };
    }
    if (message?.type === "GET_AUTH_TOKEN") {
      if (cachedDBData?.authToken) {
        return { type: "AUTH_TOKEN", token: cachedDBData.authToken };
      }
      try {
        const raw = localStorage.getItem("userToken");
        if (raw) {
          const parsed = JSON.parse(raw);
          const token = typeof parsed === "string" ? parsed : parsed.value || parsed.token || null;
          if (token && typeof token === "string") {
            return { type: "AUTH_TOKEN", token };
          }
        }
      } catch {
      }
      if (!injected) injectPageScript();
      return new Promise((resolve) => {
        const ci = setInterval(() => {
          if (cachedDBData?.authToken) {
            clearInterval(ci);
            resolve({ type: "AUTH_TOKEN", token: cachedDBData.authToken });
          }
        }, 200);
        setTimeout(() => {
          clearInterval(ci);
          resolve({ type: "AUTH_TOKEN", token: null });
        }, 1e4);
      });
    }
    if (message?.type === "GET_CURRENT_CONVERSATION") {
      console.log("[DeepSeek Exporter] GET_CURRENT_CONVERSATION \u2014 extracting from DOM");
      try {
        showProgressOverlay();
        const conv = await collectAllMessages();
        hideProgressOverlay();
        if (conv.messages.length === 0) {
          return { type: "DB_ERROR", error: "No messages found in this conversation." };
        }
        const data = [{
          chat_id: conv.chat_id,
          title: conv.title,
          create_time: 0,
          update_time: 0,
          model: "",
          messages: conv.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            create_time: m.create_time,
            conversationTitle: conv.title
          }))
        }];
        return { type: "DB_DATA", data };
      } catch (err) {
        hideProgressOverlay();
        console.error("[DeepSeek Exporter] DOM extraction failed:", err);
        return { type: "DB_ERROR", error: err.message || "Failed to extract messages from page" };
      }
    }
    if (message?.type === "GET_CURRENT_CHAT_ID") {
      const match = window.location.pathname.match(/\/chat\/([a-zA-Z0-9_-]+)/);
      return Promise.resolve({ chatId: match ? match[1] : null });
    }
    if (message?.type === "GET_PAGE_INFO") {
      return Promise.resolve({
        url: window.location.href,
        chatId: window.location.pathname.match(/\/chat\/([a-zA-Z0-9_-]+)/)?.[1] || null,
        title: document.title
      });
    }
    return void 0;
  });
  if (document.readyState === "complete" || document.readyState === "interactive") {
    injectPageScript();
  } else {
    document.addEventListener("DOMContentLoaded", () => injectPageScript());
  }
  var lastChatId = window.location.pathname.match(/\/chat\/([a-zA-Z0-9_-]+)/)?.[1] || null;
  var observer = new MutationObserver(() => {
    const currentChatId = window.location.pathname.match(/\/chat\/([a-zA-Z0-9_-]+)/)?.[1] || null;
    if (currentChatId && currentChatId !== lastChatId) {
      lastChatId = currentChatId;
      browser.runtime.sendMessage({ type: "CHAT_CHANGED", chatId: currentChatId }).catch(() => {
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
