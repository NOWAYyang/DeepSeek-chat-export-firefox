import React, { useRef, useEffect } from 'react';
import type { DeepSeekMessage } from '../../types';
import { truncateForPreview } from '../../utils/markdown';
import { t } from '../i18n';

interface MessageTreeProps {
  messages: DeepSeekMessage[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}

/**
 * Displays the message list with checkboxes for selection.
 * Shows role badge, conversation badge (for cross-chat), and a
 * truncated text preview (first 80 chars).
 */
export function MessageTree({ messages, selectedIds, onToggle }: MessageTreeProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top when messages change
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="message-tree">
        <div className="empty-state">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p>{t('noMessagesMatch')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="message-tree" ref={listRef}>
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`message-item ${selectedIds.has(msg.id) ? 'selected' : ''}`}
        >
          <div className="message-checkbox">
            <input
              type="checkbox"
              checked={selectedIds.has(msg.id)}
              onChange={() => onToggle(msg.id)}
            />
          </div>
          <div className="message-content">
            <div className={`message-role ${msg.role}`}>
              {msg.role === 'user' ? t('roleYou') : t('roleAI')}
              {msg.conversationTitle && (
                <span className="conv-badge">{msg.conversationTitle}</span>
              )}
            </div>
            <div className="message-preview">
              {truncateForPreview(msg.content, 80)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
