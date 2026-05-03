/**
 * Page-injected script
 *
 * Runs in chat.deepseek.com's page context.
 * Two jobs: (1) read auth token from localStorage, (2) read IndexedDB as fallback.
 *
 * Communication: window.postMessage() → content script → background/popup
 */

(() => {
  const SENDER_ID = '__DEEPSEEK_EXPORTER__';

  interface ChatMessage {
    message_id: number;
    parent_id: number | null;
    role: 'USER' | 'ASSISTANT';
    content: string;
    status?: string;
    created_at?: number;
  }

  interface ParsedConversation {
    chat_id: string;
    title: string;
    create_time: number;
    update_time: number;
    model: string;
    messages: ParsedMessage[];
  }

  interface ParsedMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    create_time?: number;
    conversationTitle?: string;
  }

  async function collectData() {
    const result: any = {};

    // 1. Read auth token from localStorage
    try {
      const keys = ['userToken', 'user_session', 'token', 'access_token', 'auth_token'];
      for (const key of keys) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (typeof parsed === 'string') {
                result.authToken = parsed;
                break;
              }
              result.authToken = parsed.value || parsed.token || parsed.accessToken || parsed;
              if (result.authToken) break;
            } catch {
              if (raw.length > 10) {
                result.authToken = raw;
                break;
              }
            }
          }
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }

    // 2. Read IndexedDB as fallback data source
    try {
      const db = await openDB('deepseek-chat');
      const records = await readAllFromStore(db, 'history-message');
      db.close();

      const conversations: ParsedConversation[] = [];
      for (const record of records) {
        const data = record.data;
        if (!data?.chat_session || !data?.chat_messages) continue;

        const session = data.chat_session;
        const messages = data.chat_messages
          .filter((m: ChatMessage) => m.role && m.content)
          .map((m: ChatMessage): ParsedMessage => ({
            id: `${session.id}_msg_${m.message_id}`,
            role: m.role === 'USER' ? 'user' : 'assistant',
            content: m.content || '',
            create_time: m.created_at || session.inserted_at,
            conversationTitle: session.title,
          }));

        if (messages.length === 0) continue;

        conversations.push({
          chat_id: session.id,
          title: session.title || 'Untitled',
          create_time: session.inserted_at || 0,
          update_time: session.updated_at || 0,
          model: session.model_type || 'deepseek-chat',
          messages,
        });
      }

      conversations.sort((a, b) => b.update_time - a.update_time);
      result.dbConversations = conversations;
    } catch { /* IndexedDB may be empty or unavailable */ }

    return result;
  }

  // Execute and send
  collectData()
    .then((payload) => {
      window.postMessage({ sender: SENDER_ID, type: 'PAGE_DATA', payload }, '*');
    })
    .catch((err) => {
      window.postMessage({ sender: SENDER_ID, type: 'PAGE_ERROR', payload: err?.message || String(err) }, '*');
    });

  /* ===== DB helpers ===== */

  function openDB(name: string): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(name);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onupgradeneeded = () => {
        request.transaction?.abort();
        const req2 = indexedDB.open(name);
        req2.onsuccess = () => resolve(req2.result);
        req2.onerror = () => reject(req2.error);
      };
    });
  }

  function readAllFromStore(db: IDBDatabase, storeName: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result as any[]);
      request.onerror = () => reject(request.error);
    });
  }
})();
