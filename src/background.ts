/**
 * Background script
 *
 * Responsibilities:
 *   1. DOWNLOAD_FILE — trigger browser download (existing)
 *   2. RELAY_MESSAGE — inject content script into DeepSeek tab if needed,
 *      then relay the message and return the response
 */

browser.runtime.onMessage.addListener(
  (message: any, _sender: any, sendResponse: any) => {
    if (message.type === 'DOWNLOAD_FILE') {
      (async () => {
        try {
          const blob = new Blob([message.data], { type: message.mimeType });
          const url = URL.createObjectURL(blob);
          await browser.downloads.download({ url, filename: message.filename, saveAs: true });
          setTimeout(() => URL.revokeObjectURL(url), 10000);
          sendResponse({ type: 'DOWNLOAD_RESULT', success: true });
        } catch (e: any) {
          sendResponse({ type: 'DOWNLOAD_RESULT', success: false, error: e.message });
        }
      })();
      return true;
    }

    // Relay a message to a content script in the given tab.
    // Auto-injects content_script.js if not already loaded (Firefox MV3
    // doesn't inject content scripts into already-open tabs after extension reload).
    if (message.type === 'RELAY_MESSAGE') {
      (async () => {
        try {
          const tabId: number = message.tabId;
          const payload: any = message.payload;

          // Try sending the message directly first
          let resp: any;
          try {
            resp = await browser.tabs.sendMessage(tabId, payload);
          } catch {
            // Content script not loaded — inject it via scripting API
            await browser.scripting.executeScript({
              target: { tabId },
              files: ['content_script.js'],
            });
            // Wait for the script to initialize and register its listener
            await new Promise((r) => setTimeout(r, 500));
            resp = await browser.tabs.sendMessage(tabId, payload);
          }

          sendResponse({ type: 'RELAY_RESULT', data: resp });
        } catch (e: any) {
          sendResponse({ type: 'RELAY_ERROR', error: e.message || 'Unknown error' });
        }
      })();
      return true;
    }

    return false;
  },
);
