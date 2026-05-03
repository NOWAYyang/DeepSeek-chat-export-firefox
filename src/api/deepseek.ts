/**
 * DeepSeek API client
 *
 * Fetches conversation data from DeepSeek's web app internal API endpoints.
 * These are the same endpoints called by chat.deepseek.com when rendering
 * the page. Authentication is via Bearer token read from localStorage.
 *
 * Key endpoints:
 *   GET /api/v0/chat_session/fetch_page    — list conversations (paginated)
 *   GET /api/v0/chat/history_messages      — get messages for a session
 *   GET /api/v0/users/current               — verify/refresh token
 */

import type { DeepSeekConversation, DeepSeekMessage } from '../types';

const API_BASE = 'https://chat.deepseek.com/api/v0';

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export class ApiError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Verify the auth token by calling /users/current.
 * Returns the user info if valid.
 */
export async function verifyToken(authToken: string): Promise<any> {
  const resp = await fetch(`${API_BASE}/users/current`, {
    headers: { Authorization: `Bearer ${authToken}` },
    credentials: 'include',
  });

  if (!resp.ok) {
    throw new AuthError('Token invalid or expired. Please refresh chat.deepseek.com and try again.');
  }

  const json = await resp.json();
  if (json.code !== 0) {
    throw new AuthError(json.msg || 'Authentication failed');
  }

  return json.data?.biz_data;
}

/**
 * Fetch ALL conversations by paginating through fetch_page.
 * Returns them sorted by update_time descending.
 */
export async function fetchConversations(authToken: string): Promise<DeepSeekConversation[]> {
  const allSessions: any[] = [];
  let cursor: { pinned: boolean; updated_at?: number } = { pinned: false, updated_at: undefined };
  let pageCount = 0;
  const MAX_PAGES = 50;

  while (pageCount < MAX_PAGES) {
    pageCount++;
    const params = new URLSearchParams();
    params.set('lte_cursor.pinned', String(cursor.pinned));
    if (cursor.updated_at !== undefined) {
      params.set('lte_cursor.updated_at', String(cursor.updated_at));
    }

    const resp = await fetch(`${API_BASE}/chat_session/fetch_page?${params}`, {
      headers: { Authorization: `Bearer ${authToken}` },
      credentials: 'include',
    });

    if (resp.status === 429) {
      // Rate limited — wait and retry this page
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }

    if (!resp.ok) {
      if (resp.status === 401) throw new AuthError('Session expired. Please refresh chat.deepseek.com.');
      throw new ApiError(`Failed to fetch conversations: ${resp.status}`, resp.status);
    }

    const json = await resp.json();
    if (json.code !== 0) {
      throw new ApiError(json.msg || 'API error');
    }

    const sessions: any[] = json.data?.biz_data?.chat_sessions || [];
    allSessions.push(...sessions);

    if (!json.data?.biz_data?.has_more || sessions.length === 0) break;

    // Use the last session's updated_at as cursor for next page
    cursor.updated_at = sessions[sessions.length - 1].updated_at;
  }

  return allSessions.map((s: any) => ({
    chat_id: s.id,
    title: s.title || 'Untitled',
    create_time: s.inserted_at || s.updated_at || 0,
    update_time: s.updated_at || 0,
    model: s.model_type || 'deepseek-chat',
  }));
}

/**
 * Fetch all messages for a single chat session.
 * Retries on rate limiting (429) with exponential backoff.
 */
export async function fetchChatHistory(
  chatSessionId: string,
  authToken: string,
  conversationTitle?: string,
  retries = 3,
): Promise<DeepSeekMessage[]> {
  const params = new URLSearchParams();
  params.set('chat_session_id', chatSessionId);
  params.set('cache_version', '2');

  const resp = await fetch(`${API_BASE}/chat/history_messages?${params}`, {
    headers: { Authorization: `Bearer ${authToken}` },
    credentials: 'include',
  });

  if (resp.status === 429 && retries > 0) {
    // Rate limited — wait and retry
    const delay = (4 - retries) * 1000;
    await new Promise((r) => setTimeout(r, delay));
    return fetchChatHistory(chatSessionId, authToken, conversationTitle, retries - 1);
  }

  if (!resp.ok) {
    if (resp.status === 401) throw new AuthError('Session expired.');
    throw new ApiError(`Failed to fetch messages: ${resp.status}`, resp.status);
  }

  const json = await resp.json();
  if (json.code !== 0) {
    throw new ApiError(json.msg || 'API error');
  }

  const bizData = json.data?.biz_data;
  const messages: any[] = bizData?.chat_messages || bizData?.messages || [];

  return messages
    .filter((m: any) => m && m.role && m.content)
    .map((m: any, idx: number) => ({
      id: m.message_id ? `${chatSessionId}_msg_${m.message_id}` : `msg_${chatSessionId}_${idx}`,
      role: (m.role === 'USER' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.content || '',
      create_time: m.created_at || 0,
      conversationTitle: conversationTitle || '',
    }));
}

/**
 * Fetch multiple conversations' messages. Sequential with delay to avoid rate limiting.
 */
export async function fetchMultiChatHistory(
  conversations: DeepSeekConversation[],
  authToken: string,
): Promise<Map<string, DeepSeekMessage[]>> {
  const results = new Map<string, DeepSeekMessage[]>();

  for (let i = 0; i < conversations.length; i++) {
    const conv = conversations[i];
    try {
      const messages = await fetchChatHistory(conv.chat_id, authToken, conv.title);
      results.set(conv.chat_id, messages);
    } catch (err) {
      console.warn(`[DeepSeek Exporter] Failed to fetch messages for ${conv.chat_id}:`, err);
    }
    // Delay between requests to avoid rate limiting
    if (i < conversations.length - 1) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  return results;
}
