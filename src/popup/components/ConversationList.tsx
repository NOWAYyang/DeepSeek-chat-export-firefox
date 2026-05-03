import React from 'react';
import type { DeepSeekConversation } from '../../types';

interface ConversationListProps {
  conversations: DeepSeekConversation[];
  selectedId: string | null;
  loading: boolean;
  error: string | null;
  onSelect: (conv: DeepSeekConversation) => void;
  onMultiSelect: (convs: DeepSeekConversation[]) => void;
}

/**
 * Left sidebar: list of conversations with title and date.
 * Supports single-click to load a conversation.
 */
export function ConversationList({
  conversations,
  selectedId,
  loading,
  error,
  onSelect,
}: ConversationListProps) {
  if (loading) {
    return (
      <div className="sidebar-loading">
        <span className="spinner" style={{ marginRight: 8 }} />
        Loading conversations...
      </div>
    );
  }

  if (error) {
    return (
      <div className="sidebar-loading" style={{ color: 'var(--error)', flexDirection: 'column', gap: 8 }}>
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span style={{ fontSize: 12, textAlign: 'center' }}>{error}</span>
        <button className="btn btn-sm btn-secondary" onClick={() => onSelect({} as any)} style={{ marginTop: 4 }}>
          Retry
        </button>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="sidebar-loading">
        No conversations found. Make sure you are logged in at chat.deepseek.com.
      </div>
    );
  }

  return (
    <div className="conversation-list">
      {conversations.map((conv) => (
        <div
          key={conv.chat_id}
          className={`conversation-item ${selectedId === conv.chat_id ? 'active' : ''}`}
          onClick={() => onSelect(conv)}
        >
          <div className="conv-title">{conv.title}</div>
          <div className="conv-date">
            {conv.update_time
              ? formatDate(conv.update_time)
              : conv.create_time
                ? formatDate(conv.create_time)
                : 'Unknown date'}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatDate(timestamp: number): string {
  try {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return date.toLocaleDateString();
  } catch {
    return 'Unknown';
  }
}
