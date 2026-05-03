import React from 'react';

export interface NotificationItem {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface NotificationProps {
  items: NotificationItem[];
}

/**
 * Toast-style notifications that appear in the bottom-right corner.
 * Auto-dismissed after 4 seconds in the App component.
 */
export function Notification({ items }: NotificationProps) {
  if (items.length === 0) return null;

  return (
    <div className="notification-container">
      {items.map((item) => (
        <div key={item.id} className={`notification-toast ${item.type}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {item.type === 'success' && (
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--success)" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            )}
            {item.type === 'error' && (
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--error)" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            )}
            {item.type === 'info' && (
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--primary)" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            )}
            <span>{item.message}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
