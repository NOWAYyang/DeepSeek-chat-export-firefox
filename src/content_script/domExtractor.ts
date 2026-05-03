/**
 * DOM-based message extractor for chat.deepseek.com.
 *
 * Instead of calling DeepSeek API, we scroll through the chat page
 * to trigger lazy loading, then extract messages directly from the DOM.
 * This avoids all auth, CORS, and rate-limiting issues.
 */

export interface ExtractedMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  create_time: number;
  conversationTitle: string;
}

export interface ExtractedConversation {
  chat_id: string;
  title: string;
  messages: ExtractedMessage[];
}

/* ===== Debug log ===== */

function debug(...args: any[]) {
  console.log('[DeepSeek Exporter]', ...args);
}

/* ===== Scroll container detection ===== */

function getChatScrollContainer(): HTMLElement {
  // Known DeepSeek scroll container selectors
  const selectors = [
    '.dad65929',
    '.e1f93b07',
    'main',
    '[class*="chat"][class*="container"]',
    '[class*="conversation"]',
  ];
  for (const sel of selectors) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el && el.scrollHeight > el.clientHeight) return el;
  }
  // Walk up from first message element
  for (const sel of ['.ds-message', '.fbb737a4', '[class*="message"]']) {
    const first = document.querySelector<HTMLElement>(sel);
    if (first) {
      let node = first.parentElement;
      while (node && node !== document.body) {
        const style = window.getComputedStyle(node);
        if (
          (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
          node.scrollHeight > node.clientHeight
        ) {
          return node;
        }
        node = node.parentElement;
      }
    }
  }
  debug('No scroll container found, using documentElement');
  return document.documentElement;
}

/* ===== Scroll helpers ===== */

function getScrollTop(el: HTMLElement): number {
  if (el === document.documentElement || el === document.body) {
    return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
  }
  return el.scrollTop;
}

function setScrollTop(el: HTMLElement, val: number): void {
  if (el === document.documentElement || el === document.body) {
    window.scrollTo(0, Math.max(0, val));
    return;
  }
  el.scrollTop = Math.max(0, val);
}

function getScrollHeight(el: HTMLElement): number {
  if (el === document.documentElement || el === document.body) {
    return Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  }
  return el.scrollHeight;
}

function getClientHeight(el: HTMLElement): number {
  if (el === document.documentElement || el === document.body) {
    return window.innerHeight || document.documentElement.clientHeight || 0;
  }
  return el.clientHeight;
}

async function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Scroll the container by a step and wait for lazy-loaded content.
 */
async function scrollStep(container: HTMLElement, targetTop: number, settleMs = 600): Promise<void> {
  setScrollTop(container, targetTop);
  // Wait for content to settle
  const start = Date.now();
  while (Date.now() - start < settleMs) {
    await delay(80);
    // Check if scroll position is stable
  }
  await delay(100);
}

/* ===== Title extraction ===== */

function getConversationTitle(): string {
  const nodes = [
    document.querySelector<HTMLElement>('.f8d1e4c0 .afa34042'),
    document.querySelector<HTMLElement>('.f8d1e4c0'),
    document.querySelector<HTMLElement>('[class*="title"]'),
    document.querySelector<HTMLElement>('h1'),
  ];
  for (const node of nodes) {
    if (!node) continue;
    const text = (node.textContent || '').trim();
    if (text && text.length > 2) return text;
  }
  return (document.title || '').trim() || 'Untitled';
}

/* ===== Message extraction ===== */

function messageSignature(role: string, content: string): string {
  return `${role}::${content.replace(/\s+/g, ' ').trim().slice(0, 200)}`;
}

/**
 * Extract all messages currently visible in the DOM.
 * Uses multiple selector fallback patterns.
 */
function extractVisibleMessages(title: string, container?: HTMLElement): ExtractedMessage[] {
  const messages: ExtractedMessage[] = [];
  const root = container || document;

  // Try multiple selector patterns (DeepSeek changes CSS classes occasionally)
  const userSelectors = ['.fbb737a4', '[class*="user-question"]', '[class*="user_question"]', '.ds-message[class*="user"]'];
  const aiSelectors = ['.ds-message .ds-markdown', '.ds-markdown', '[class*="message-content"]'];
  const cotSelectors = ['.ds-message .ds-think-content', '.ds-think-content', '[class*="think-content"]'];

  let userBlocks = root.querySelectorAll<HTMLElement>(userSelectors[0]);
  if (userBlocks.length === 0) {
    for (let i = 1; i < userSelectors.length; i++) {
      userBlocks = root.querySelectorAll<HTMLElement>(userSelectors[i]);
      if (userBlocks.length > 0) break;
    }
  }

  let aiBlocks = root.querySelectorAll<HTMLElement>(aiSelectors[0]);
  if (aiBlocks.length === 0) {
    for (let i = 1; i < aiSelectors.length; i++) {
      aiBlocks = root.querySelectorAll<HTMLElement>(aiSelectors[i]);
      if (aiBlocks.length > 0) break;
    }
  }

  let cotBlocks = root.querySelectorAll<HTMLElement>(cotSelectors[0]);
  if (cotBlocks.length === 0) {
    for (let i = 1; i < cotSelectors.length; i++) {
      cotBlocks = root.querySelectorAll<HTMLElement>(cotSelectors[i]);
      if (cotBlocks.length > 0) break;
    }
  }

  if (userBlocks.length === 0 && aiBlocks.length === 0) {
    debug('No messages found with any selector. user:', userSelectors[0], 'ai:', aiSelectors[0]);
    return [];
  }

  interface Entry { el: HTMLElement; type: 'user' | 'ai' | 'cot'; }
  const entries: Entry[] = [];

  userBlocks.forEach((el) => entries.push({ el, type: 'user' }));
  aiBlocks.forEach((el) => entries.push({ el, type: 'ai' }));
  cotBlocks.forEach((el) => entries.push({ el, type: 'cot' }));

  // Sort by DOM position
  entries.sort((a, b) => {
    const pos = a.el.compareDocumentPosition(b.el);
    if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });

  let pendingCot: HTMLElement | null = null;
  let msgIndex = 0;
  let userCount = 0;
  let aiCount = 0;

  for (const entry of entries) {
    if (entry.type === 'user') {
      const text = (entry.el.textContent || '').trim();
      if (!text) continue;
      messages.push({
        id: `u_${msgIndex}`,
        role: 'user',
        content: text,
        create_time: Date.now(),
        conversationTitle: title,
      });
      msgIndex++;
      userCount++;
    } else if (entry.type === 'cot') {
      pendingCot = entry.el;
    } else if (entry.type === 'ai') {
      let content = domToMarkdown(entry.el);
      if (!content.trim()) continue;
      if (pendingCot) {
        const cotText = (pendingCot.textContent || '').trim();
        if (cotText) {
          content = `> **Thinking:**\n> ${cotText.replace(/\n/g, '\n> ')}\n\n${content}`;
        }
        pendingCot = null;
      }
      messages.push({
        id: `a_${msgIndex}`,
        role: 'assistant',
        content,
        create_time: Date.now(),
        conversationTitle: title,
      });
      msgIndex++;
      aiCount++;
    }
  }

  debug(`Extracted ${userCount} user + ${aiCount} ai messages`);
  return messages;
}

/* ===== domToMarkdown — convert rendered HTML back to Markdown ===== */

function inlineContent(el: HTMLElement): string {
  let result = '';
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) result += child.textContent || '';
    else if (child.nodeType === Node.ELEMENT_NODE) {
      const childEl = child as HTMLElement;
      // Skip CoT/thinking blocks (handled separately by pendingCot)
      if (isCoTElement(childEl)) continue;
      result += elementToMarkdown(childEl);
    }
  }
  return result;
}

/** Check if an element is or contains a CoT/thinking block. */
function isCoTElement(el: HTMLElement): boolean {
  const selectors = ['.ds-think-content', '[class*="think-content"]'];
  for (const sel of selectors) {
    if (el.matches(sel) || el.querySelector(sel)) return true;
  }
  return false;
}

function elementToMarkdown(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();

  // Skip CoT/thinking blocks (handled separately)
  if (isCoTElement(el)) return '';

  if (el.classList.contains('md-code-block')) return extractCodeBlock(el);
  if (el.classList.contains('katex')) return extractKatex(el);

  switch (tag) {
    case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': {
      return `\n${'#'.repeat(parseInt(tag.charAt(1)))} ${inlineContent(el)}\n\n`;
    }
    case 'p':
      return `${inlineContent(el)}\n\n`;
    case 'br':
      return '  \n';
    case 'hr':
      return '\n---\n\n';
    case 'strong': case 'b':
      return `**${inlineContent(el)}**`;
    case 'em': case 'i':
      return `*${inlineContent(el)}*`;
    case 'code':
      if (!el.closest('.md-code-block')) return `\`${(el.textContent || '').trim()}\``;
      return el.textContent || '';
    case 'a': {
      // Strip link — just output the visible text, no URL
      return inlineContent(el).trim();
    }
    case 'img':
      return `![${el.getAttribute('alt') || ''}](${el.getAttribute('src') || ''})`;
    case 'ul': {
      let out = '\n';
      el.querySelectorAll(':scope > li').forEach((li) => {
        out += `- ${domToMarkdown(li as HTMLElement) || (li.textContent || '').trim()}\n`;
      });
      return `${out}\n`;
    }
    case 'ol': {
      let out = '\n';
      let idx = 1;
      el.querySelectorAll(':scope > li').forEach((li) => {
        out += `${idx}. ${domToMarkdown(li as HTMLElement) || (li.textContent || '').trim()}\n`;
        idx++;
      });
      return `${out}\n`;
    }
    case 'blockquote': {
      let content = '';
      for (const child of el.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) content += child.textContent || '';
        else if (child.nodeType === Node.ELEMENT_NODE) content += elementToMarkdown(child as HTMLElement);
      }
      return `> ${content.trim().split('\n').join('\n> ')}\n\n`;
    }
    case 'pre': {
      const codeText = el.textContent || '';
      let lang = '';
      const parentEl = el.parentElement;
      if (parentEl) {
        const badge = parentEl.querySelector<HTMLElement>('[class*="language"], [data-language]');
        if (badge) lang = (badge.textContent || badge.getAttribute('data-language') || '').trim();
      }
      if (!lang && /(graph|flowchart|sequenceDiagram|classDiagram)/i.test(codeText)) lang = 'mermaid';
      return `\`\`\`${lang}\n${codeText}\n\`\`\`\n\n`;
    }
    case 'table':
      return tableToMarkdown(el);
    default:
      return inlineContent(el);
  }
}

function domToMarkdown(el: HTMLElement): string {
  let result = '';
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) result += child.textContent || '';
    else if (child.nodeType === Node.ELEMENT_NODE) result += elementToMarkdown(child as HTMLElement);
  }
  return result.trim();
}

function extractCodeBlock(el: HTMLElement): string {
  const cachedCode = el.getAttribute('data-export-code');
  const cachedLang = el.getAttribute('data-export-lang');
  if (cachedCode) return `\`\`\`${cachedLang || ''}\n${cachedCode}\n\`\`\`\n\n`;
  const pre = el.querySelector('pre');
  if (pre && pre.textContent) {
    let lang = '';
    const langEl = el.querySelector<HTMLElement>('.d813de27, [data-language]');
    if (langEl) lang = (langEl.textContent || langEl.getAttribute('data-language') || '').trim();
    const text = (pre.textContent || '').replace(/ /g, ' ').trim();
    if (text) return `\`\`\`${lang}\n${text}\n\`\`\`\n\n`;
  }
  return '';
}

function extractKatex(el: HTMLElement): string {
  const annotation = el.querySelector('annotation[encoding="application/x-tex"]');
  if (!annotation) return el.textContent || '';
  const tex = (annotation.textContent || '').trim();
  if (!tex) return el.textContent || '';
  return `\n$$\n${tex}\n$$\n`;
}

function tableToMarkdown(table: HTMLElement): string {
  const rows = table.querySelectorAll('tr');
  if (rows.length === 0) return '';

  const headers: string[] = [];
  const headerCells = rows[0].querySelectorAll('th, td');
  headerCells.forEach((cell) => headers.push((cell.textContent || '').trim().replace(/\|/g, '\\|')));
  if (headers.length === 0) return '';

  const data: string[][] = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i].querySelectorAll('td, th');
    const row: string[] = [];
    cells.forEach((cell) => row.push((cell.textContent || '').trim().replace(/\|/g, '\\|')));
    while (row.length < headers.length) row.push('');
    data.push(row.slice(0, headers.length));
  }

  let md = `| ${headers.join(' | ')} |\n`;
  md += `| ${headers.map(() => '---').join(' | ')} |\n`;
  data.forEach((row) => { md += `| ${row.join(' | ')} |\n`; });
  return `${md}\n`;
}

/* ===== Main extraction ===== */

/**
 * Collect all messages from the chat page.
 *
 * Strategy:
 * 1. Try to extract visible messages first (fast path if already loaded)
 * 2. If no messages found at all, we probably need to wait for the page
 * 3. Scroll to top in steps (triggers lazy loading of older messages)
 * 4. Scroll back down collecting messages
 * 5. Deduplicate by content signature
 */
export async function collectAllMessages(): Promise<ExtractedConversation> {
  const chatId = window.location.pathname.match(/\/chat\/([a-zA-Z0-9_-]+)/)?.[1] || 'unknown';
  const title = getConversationTitle();
  const container = getChatScrollContainer();
  const originalTop = getScrollTop(container);

  debug(`Starting collection. Container: ${container.tagName}, scrollHeight: ${getScrollHeight(container)}, title: "${title}"`);

  // Quick check: do we see any messages already?
  const quickCheck = extractVisibleMessages(title);
  if (quickCheck.length > 0) {
    debug('Messages already visible, no scrolling needed');
    return { chat_id: chatId, title, messages: quickCheck };
  }

  // We have to scroll to lazy-load. Try scrolling to top to trigger loading.
  debug('No visible messages yet, scrolling to load...');

  const seen = new Set<string>();
  const ordered: ExtractedMessage[] = [];
  const startedAt = Date.now();
  const totalTimeout = 20000; // 20s max

  function addFresh(): number {
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

  // Step 1: Scroll to top to trigger lazy loading of older messages.
  // DeepSeek loads older messages as you scroll up.
  debug('Scrolling to top...');
  let scrollAttempts = 0;
  const maxScrollAttempts = 12;

  while (Date.now() - startedAt < totalTimeout && scrollAttempts < maxScrollAttempts) {
    const currentTop = getScrollTop(container);
    const clientHeight = getClientHeight(container);
    const scrollHeight = getScrollHeight(container);
    const isAtTop = currentTop <= 2;
    const step = Math.max(400, clientHeight * 0.8);

    if (isAtTop) {
      debug('Reached top');
      break;
    }

    // Scroll up
    const targetTop = Math.max(0, currentTop - step);
    await scrollStep(container, targetTop, 400);
    const added = addFresh();
    scrollAttempts++;
    debug(`Scroll up #${scrollAttempts}: top=${targetTop.toFixed(0)}, messages=${ordered.length}, added=${added}`);
  }

  // Step 2: Now scroll down to collect everything visible
  debug('Collecting on scroll down...');
  let currentTop = getScrollTop(container);
  let downAttempts = 0;
  const maxDownAttempts = 12;

  while (Date.now() - startedAt < totalTimeout && downAttempts < maxDownAttempts) {
    const clientHeight = getClientHeight(container);
    const scrollHeight = getScrollHeight(container);
    const atBottom = currentTop + clientHeight >= scrollHeight - 4;

    addFresh();

    if (atBottom) {
      debug('Reached bottom');
      break;
    }

    const step = Math.max(400, clientHeight * 0.7);
    currentTop = Math.min(scrollHeight - clientHeight, currentTop + step);
    await scrollStep(container, currentTop, 300);
    downAttempts++;
    debug(`Scroll down #${downAttempts}: top=${currentTop.toFixed(0)}, messages=${ordered.length}`);
  }

  // Final extraction
  addFresh();

  // Restore scroll position
  setScrollTop(container, originalTop);

  debug(`Collection done: ${ordered.length} messages in ${Date.now() - startedAt}ms`);
  return { chat_id: chatId, title, messages: ordered };
}
