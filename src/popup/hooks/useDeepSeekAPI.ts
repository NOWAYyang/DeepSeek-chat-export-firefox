import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  DeepSeekConversation,
  DeepSeekMessage,
  ExportFormat,
  ExportOptions,
} from '../../types';

interface UseDeepSeekAPIResult {
  conversation: DeepSeekConversation | null;
  currentMessages: DeepSeekMessage[];
  loading: boolean;
  error: string | null;
  fetchCurrentConversation: () => Promise<void>;
  exportMessages: (
    messages: DeepSeekMessage[],
    format: ExportFormat,
    options: ExportOptions,
    conversationTitle: string,
    onProgress?: (current: number, total: number) => void,
  ) => Promise<void>;
}

export function useDeepSeekAPI(): UseDeepSeekAPIResult {
  const [conversation, setConversation] = useState<DeepSeekConversation | null>(null);
  const [currentMessages, setCurrentMessages] = useState<DeepSeekMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the last loaded chat ID so we can detect changes
  const loadedChatIdRef = useRef<string | null>(null);

  /**
   * Relay a message to the DeepSeek tab's content script via the background.
   * The background handles content script injection if needed (Firefox MV3
   * doesn't auto-inject into already-open tabs after extension reload).
   */
  const relayToTab = useCallback(async (payload: any): Promise<any> => {
    const tabs = await browser.tabs.query({ url: 'https://chat.deepseek.com/*' });
    if (tabs.length === 0 || !tabs[0].id) {
      throw new Error('Please open chat.deepseek.com first and log in.');
    }

    const resp = await browser.runtime.sendMessage({
      type: 'RELAY_MESSAGE',
      tabId: tabs[0].id,
      payload,
    });

    if (!resp) throw new Error('No response from background');
    if (resp.type === 'RELAY_ERROR') throw new Error(resp.error || 'Relay failed');
    return resp.data;
  }, []);

  /**
   * Fetch ONLY the currently open conversation from the DeepSeek tab.
   * Content script reads URL (for chat ID), localStorage (for token),
   * and makes a single API call to get messages.
   */
  const fetchCurrentConversation = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const resp = await relayToTab({ type: 'GET_CURRENT_CONVERSATION' });

      if (resp.type === 'DB_ERROR') {
        setError(resp.error);
        setConversation(null);
        setCurrentMessages([]);
        loadedChatIdRef.current = null;
        return;
      }

      if (resp.type === 'DB_DATA') {
        const rawConvs: any[] = resp.data || [];
        const conv = rawConvs[0] || null;

        if (conv) {
          console.log('[DeepSeek Exporter] First message content sample:', conv.messages?.[0]?.content?.slice(0, 200));
          setConversation({
            chat_id: conv.chat_id,
            title: conv.title || 'Untitled',
            create_time: conv.create_time || 0,
            update_time: conv.update_time || 0,
            model: conv.model || 'deepseek-chat',
          });
          setCurrentMessages(conv.messages || []);
          loadedChatIdRef.current = conv.chat_id;
        } else {
          setConversation(null);
          setCurrentMessages([]);
          loadedChatIdRef.current = null;
        }
      }
    } catch (err: any) {
      setError(`Failed to load data: ${err.message}`);
      setConversation(null);
      setCurrentMessages([]);
      loadedChatIdRef.current = null;
    } finally {
      setLoading(false);
    }
  }, [relayToTab]);

  // Auto-refresh: poll for chat ID changes every 1.5s and reload when it changes
  useEffect(() => {
    const poll = async () => {
      try {
        const resp = await relayToTab({ type: 'GET_CURRENT_CHAT_ID' });
        const newChatId: string | null = resp?.chatId || null;

        if (newChatId && newChatId !== loadedChatIdRef.current) {
          await fetchCurrentConversation();
        }
      } catch {
        // Tab unreachable — ignore, next poll may work
      }
    };

    const interval = setInterval(poll, 1500);
    return () => clearInterval(interval);
  }, [fetchCurrentConversation, relayToTab]);

  /* ===== Export implementations ===== */

  const exportMessages = useCallback(
    async (
      messages: DeepSeekMessage[],
      format: ExportFormat,
      options: ExportOptions,
      conversationTitle: string,
      onProgress?: (current: number, total: number) => void,
    ) => {
      if (format === 'json' || format === 'markdown' || format === 'html') {
        await exportTextFormat(messages, format, options, conversationTitle);
      } else if (format === 'word') {
        await exportWord(messages, options, conversationTitle, onProgress);
      } else if (format === 'pdf') {
        await exportPDF(messages, options, conversationTitle, onProgress);
      } else if (format === 'png') {
        await exportPNG(messages, options, conversationTitle, onProgress);
      } else if (format === 'svg') {
        await exportSVG(messages, options, conversationTitle, onProgress);
      } else if (format === 'zip') {
        await exportZIP(messages, options, conversationTitle, onProgress);
      }
    },
    [],
  );

  async function exportTextFormat(
    messages: DeepSeekMessage[],
    format: ExportFormat,
    options: ExportOptions,
    title: string,
  ) {
    let content: string;
    let filename: string;
    let mimeType: string;

    switch (format) {
      case 'json': {
        const { exportJSON } = await import('../../exporters/json');
        content = exportJSON(messages, options, title);
        filename = `${sanitize(title)}.json`;
        mimeType = 'application/json';
        break;
      }
      case 'markdown': {
        const { exportMarkdown } = await import('../../exporters/markdown');
        content = exportMarkdown(messages, options, title);
        filename = `${sanitize(title)}.md`;
        mimeType = 'text/markdown';
        break;
      }
      case 'html': {
        const { exportHTML } = await import('../../exporters/html');
        content = await exportHTML(messages, options, title);
        filename = `${sanitize(title)}.html`;
        mimeType = 'text/html';
        break;
      }
      default:
        throw new Error(`Unsupported text format: ${format}`);
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(content).buffer;
    await browser.runtime.sendMessage({ type: 'DOWNLOAD_FILE', data, filename, mimeType });
  }

  async function exportWord(
    messages: DeepSeekMessage[],
    options: ExportOptions,
    title: string,
    onProgress?: (current: number, total: number) => void,
  ) {
    const { exportWord } = await import('../../exporters/word');
    const result = await exportWord(messages, options, title, onProgress);
    const arrayBuf = await (result.data as Blob).arrayBuffer();
    await browser.runtime.sendMessage({
      type: 'DOWNLOAD_FILE',
      data: arrayBuf,
      filename: `${sanitize(title)}.docx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
  }

  async function exportPDF(
    messages: DeepSeekMessage[],
    options: ExportOptions,
    title: string,
    onProgress?: (current: number, total: number) => void,
  ) {
    const { exportPDF } = await import('../../exporters/pdf');
    const result = await exportPDF(messages, options, title, onProgress);
    const arrayBuf = await (result.data as Blob).arrayBuffer();
    await browser.runtime.sendMessage({
      type: 'DOWNLOAD_FILE',
      data: arrayBuf,
      filename: `${sanitize(title)}.pdf`,
      mimeType: 'application/pdf',
    });
  }

  async function exportPNG(
    messages: DeepSeekMessage[],
    options: ExportOptions,
    title: string,
    onProgress?: (current: number, total: number) => void,
  ) {
    const { exportPNG } = await import('../../exporters/png');
    const result = await exportPNG(messages, options, title, onProgress);
    const arrayBuf = await (result.data as Blob).arrayBuffer();
    await browser.runtime.sendMessage({
      type: 'DOWNLOAD_FILE',
      data: arrayBuf,
      filename: `${sanitize(title)}.png`,
      mimeType: 'image/png',
    });
  }

  async function exportSVG(
    messages: DeepSeekMessage[],
    options: ExportOptions,
    title: string,
    onProgress?: (current: number, total: number) => void,
  ) {
    const { exportSVG } = await import('../../exporters/svg');
    if (messages.length === 1) {
      const result = exportSVG([messages[0]], options, title);
      const encoder = new TextEncoder();
      const data = encoder.encode(result.data as string).buffer;
      await browser.runtime.sendMessage({
        type: 'DOWNLOAD_FILE',
        data,
        filename: `${sanitize(title)}-message.svg`,
        mimeType: 'image/svg+xml',
      });
    } else {
      const { exportZip } = await import('../../exporters/zip');
      const result = await exportZip(messages, options, title, 'svg', onProgress);
      const arrayBuf = await (result.data as Blob).arrayBuffer();
      await browser.runtime.sendMessage({
        type: 'DOWNLOAD_FILE',
        data: arrayBuf,
        filename: `${sanitize(title)}-svg.zip`,
        mimeType: 'application/zip',
      });
    }
  }

  async function exportZIP(
    messages: DeepSeekMessage[],
    options: ExportOptions,
    title: string,
    onProgress?: (current: number, total: number) => void,
  ) {
    const { exportZip } = await import('../../exporters/zip');
    const result = await exportZip(messages, options, title, 'all', onProgress);
    const arrayBuf = await (result.data as Blob).arrayBuffer();
    await browser.runtime.sendMessage({
      type: 'DOWNLOAD_FILE',
      data: arrayBuf,
      filename: `${sanitize(title)}.zip`,
      mimeType: 'application/zip',
    });
  }

  return {
    conversation,
    currentMessages,
    loading,
    error,
    fetchCurrentConversation,
    exportMessages,
  };
}

function sanitize(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 200)
    || 'export';
}
