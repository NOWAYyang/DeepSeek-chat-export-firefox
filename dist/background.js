"use strict";
(() => {
  // src/background.ts
  browser.runtime.onMessage.addListener(
    (message, _sender, sendResponse) => {
      if (message.type === "DOWNLOAD_FILE") {
        (async () => {
          try {
            const blob = new Blob([message.data], { type: message.mimeType });
            const url = URL.createObjectURL(blob);
            await browser.downloads.download({ url, filename: message.filename, saveAs: true });
            setTimeout(() => URL.revokeObjectURL(url), 1e4);
            sendResponse({ type: "DOWNLOAD_RESULT", success: true });
          } catch (e) {
            sendResponse({ type: "DOWNLOAD_RESULT", success: false, error: e.message });
          }
        })();
        return true;
      }
      if (message.type === "RELAY_MESSAGE") {
        (async () => {
          try {
            const tabId = message.tabId;
            const payload = message.payload;
            let resp;
            try {
              resp = await browser.tabs.sendMessage(tabId, payload);
            } catch {
              await browser.scripting.executeScript({
                target: { tabId },
                files: ["content_script.js"]
              });
              await new Promise((r) => setTimeout(r, 500));
              resp = await browser.tabs.sendMessage(tabId, payload);
            }
            sendResponse({ type: "RELAY_RESULT", data: resp });
          } catch (e) {
            sendResponse({ type: "RELAY_ERROR", error: e.message || "Unknown error" });
          }
        })();
        return true;
      }
      return false;
    }
  );
})();
