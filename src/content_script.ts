/**
 * Content script injected into chat.deepseek.com pages.
 *
 * Responsibilities:
 *   1. Extract messages from the page DOM (scroll + extract, no API calls)
 *   2. Inject page_inject.js for IndexedDB fallback access
 *   3. Detect the current chat ID from the URL
 */

import { collectAllMessages } from './content_script/domExtractor';
import type { DeepSeekMessage } from './types';

const PAGE_SCRIPT_FILE = 'page_inject.js';
const SENDER_ID = '__DEEPSEEK_EXPORTER__';

let injected = false;

/* ===== Progress overlay ===== */

let overlayEl: HTMLDivElement | null = null;

function showProgressOverlay(): void {
  if (overlayEl) return;
  overlayEl = document.createElement('div');
  overlayEl.id = '__deepseek_exporter_overlay';
  overlayEl.style.cssText =
    'position:fixed;top:0;left:0;width:100%;height:100%;z-index:999999;' +
    'background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;' +
    'font-family:sans-serif;font-size:16px;color:#fff;' +
    'text-shadow:0 1px 3px rgba(0,0,0,0.5);';
  overlayEl.textContent = 'DeepSeek Exporter — Loading messages...';
  document.body.appendChild(overlayEl);
}

function hideProgressOverlay(): void {
  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
  }
}

/* ===== Inject page script ===== */

function injectPageScript(): void {
  if (injected) return;
  injected = true;

  const script = document.createElement('script');
  script.src = browser.runtime.getURL(PAGE_SCRIPT_FILE);
  script.onload = () => { script.remove(); };
  script.onerror = () => {
    console.error('[DeepSeek Exporter] Failed to inject page script');
    injected = false;
  };
  (document.head || document.documentElement).appendChild(script);
}

/* ===== Collect & cache data from postMessage ===== */

let cachedDBData: any = null;
let dataReadyResolve: (() => void) | null = null;
let dataReadyPromise: Promise<void> | null = null;

window.addEventListener('message', (event: MessageEvent) => {
  if (event.data?.sender !== SENDER_ID) return;

  if (event.data.type === 'PAGE_DATA') {
    cachedDBData = event.data.payload;
    if (dataReadyResolve) {
      dataReadyResolve();
      dataReadyResolve = null;
    }
  } else if (event.data.type === 'PAGE_ERROR') {
    console.error('[DeepSeek Exporter] Page script error:', event.data.payload);
  }
});

/* ===== Handle popup requests ===== */

browser.runtime.onMessage.addListener(async (message: any) => {
  // Ping — used to check if content script is loaded
  if (message?.type === 'PING') {
    return { type: 'PONG' };
  }

  // Get auth token from localStorage
  if (message?.type === 'GET_AUTH_TOKEN') {
    if (cachedDBData?.authToken) {
      return { type: 'AUTH_TOKEN', token: cachedDBData.authToken };
    }
    try {
      const raw = localStorage.getItem('userToken');
      if (raw) {
        const parsed = JSON.parse(raw);
        const token = typeof parsed === 'string' ? parsed : (parsed.value || parsed.token || null);
        if (token && typeof token === 'string') {
          return { type: 'AUTH_TOKEN', token };
        }
      }
    } catch { /* ignore */ }
    if (!injected) injectPageScript();
    return new Promise((resolve) => {
      const ci = setInterval(() => {
        if (cachedDBData?.authToken) {
          clearInterval(ci);
          resolve({ type: 'AUTH_TOKEN', token: cachedDBData.authToken });
        }
      }, 200);
      setTimeout(() => { clearInterval(ci); resolve({ type: 'AUTH_TOKEN', token: null }); }, 10000);
    });
  }

  // Popup requests conversation data via DOM extraction (no API calls)
  if (message?.type === 'GET_CURRENT_CONVERSATION') {
    console.log('[DeepSeek Exporter] GET_CURRENT_CONVERSATION — extracting from DOM');
    try {
      // Add a progress overlay so the user doesn't see the page scrolling
      showProgressOverlay();

      const conv = await collectAllMessages();

      hideProgressOverlay();

      if (conv.messages.length === 0) {
        return { type: 'DB_ERROR', error: 'No messages found in this conversation.' };
      }

      // Format to match expected response
      const data = [{
        chat_id: conv.chat_id,
        title: conv.title,
        create_time: 0,
        update_time: 0,
        model: '',
        messages: conv.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          create_time: m.create_time,
          conversationTitle: conv.title,
        })),
      }];

      return { type: 'DB_DATA', data };
    } catch (err: any) {
      hideProgressOverlay();
      console.error('[DeepSeek Exporter] DOM extraction failed:', err);
      return { type: 'DB_ERROR', error: err.message || 'Failed to extract messages from page' };
    }
  }

  // Popup requests current chat ID from URL
  if (message?.type === 'GET_CURRENT_CHAT_ID') {
    const match = window.location.pathname.match(/\/chat\/([a-zA-Z0-9_-]+)/);
    return Promise.resolve({ chatId: match ? match[1] : null });
  }

  // Popup requests page info
  if (message?.type === 'GET_PAGE_INFO') {
    return Promise.resolve({
      url: window.location.href,
      chatId: window.location.pathname.match(/\/chat\/([a-zA-Z0-9_-]+)/)?.[1] || null,
      title: document.title,
    });
  }

  return undefined;
});

/* ===== Auto-inject on page load ===== */

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  injectPageScript();
} else {
  document.addEventListener('DOMContentLoaded', () => injectPageScript());
}

/* ===== Detect SPA navigation ===== */

let lastChatId = window.location.pathname.match(/\/chat\/([a-zA-Z0-9_-]+)/)?.[1] || null;

const observer = new MutationObserver(() => {
  const currentChatId = window.location.pathname.match(/\/chat\/([a-zA-Z0-9_-]+)/)?.[1] || null;
  if (currentChatId && currentChatId !== lastChatId) {
    lastChatId = currentChatId;
    browser.runtime.sendMessage({ type: 'CHAT_CHANGED', chatId: currentChatId }).catch(() => {});
  }
});

observer.observe(document.body, { childList: true, subtree: true });

export {};
