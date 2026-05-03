import React, { useState, useEffect, useCallback } from 'react';
import type {
  DeepSeekConversation,
  DeepSeekMessage,
  ExportFormat,
  ExportOptions,
  FilterOptions,
} from '../types';
import { MessageTree } from './components/MessageTree';
import { FilterBar } from './components/FilterBar';
import { ExportFormatSelector } from './components/ExportFormatSelector';
import { AdvancedOptions } from './components/AdvancedOptions';
import { Guide } from './components/Guide';
import { Notification, type NotificationItem } from './components/Notification';
import { useDeepSeekAPI } from './hooks/useDeepSeekAPI';
import { t } from './i18n';

const DEFAULT_OPTIONS: ExportOptions = {
  pageSize: 'A4',
  pageOrientation: 'portrait',
  margin: 20,
  includeMetadata: true,
  highlightTheme: 'github',
  darkMode: false,
  preserveDeepSeekStyle: true,
};

const DEFAULT_FILTERS: FilterOptions = {
  role: 'all',
  dateFrom: null,
  dateTo: null,
  keyword: '',
};

export default function App() {
  const {
    conversation,
    currentMessages,
    loading,
    error,
    fetchCurrentConversation,
    exportMessages,
  } = useDeepSeekAPI();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterOptions>(DEFAULT_FILTERS);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('markdown');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>(DEFAULT_OPTIONS);
  const [showGuide, setShowGuide] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // Load current conversation on mount
  useEffect(() => {
    fetchCurrentConversation();
  }, []);

  // Notifications
  const addNotification = useCallback((notif: Omit<NotificationItem, 'id'>) => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { ...notif, id }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  }, []);

  // Clear selected messages when conversation changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [conversation?.chat_id]);

  // Toggle message selection
  const handleToggleMessage = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Select/deselect all filtered messages
  const getFilteredMessages = useCallback((): DeepSeekMessage[] => {
    let messages = [...currentMessages];

    if (filters.role !== 'all') {
      messages = messages.filter(m => m.role === filters.role);
    }
    if (filters.dateFrom) {
      messages = messages.filter(m => (m.create_time || 0) >= filters.dateFrom!);
    }
    if (filters.dateTo) {
      messages = messages.filter(m => (m.create_time || 0) <= filters.dateTo!);
    }
    if (filters.keyword.trim()) {
      const kw = filters.keyword.toLowerCase().trim();
      messages = messages.filter(m => m.content.toLowerCase().includes(kw));
    }

    return messages;
  }, [currentMessages, filters]);

  const handleSelectAll = useCallback(() => {
    const ids = getFilteredMessages().map(m => m.id);
    setSelectedIds(new Set(ids));
  }, [getFilteredMessages]);

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleInvertSelection = useCallback(() => {
    const ids = getFilteredMessages().map(m => m.id);
    setSelectedIds(prev => {
      const next = new Set(prev);
      for (const id of ids) {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }, [getFilteredMessages]);

  // Handle export
  const handleExport = useCallback(async () => {
    const selectedMessages = getFilteredMessages().filter(m => selectedIds.has(m.id));
    if (selectedMessages.length === 0) {
      addNotification({ type: 'error', message: t('noMessagesSelectedError') });
      return;
    }

    setExporting(true);
    setExportProgress(0);

    try {
      const convTitle = conversation?.title || 'exported-conversation';
      await exportMessages(
        selectedMessages,
        exportFormat,
        exportOptions,
        convTitle,
        (current, total) => setExportProgress(Math.round((current / total) * 100)),
      );
      addNotification({
        type: 'success',
        message: t('exportSuccess', selectedMessages.length.toString(), exportFormat.toUpperCase()),
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: t('exportFailed', err.message || 'Unknown error'),
      });
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  }, [selectedIds, getFilteredMessages, exportFormat, exportOptions, conversation, exportMessages, addNotification]);

  // Reset filters when conversation changes
  useEffect(() => {
    setFilters(DEFAULT_FILTERS);
  }, [conversation?.chat_id]);

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <h1>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="4" width="16" height="14" rx="2" />
            <path d="M8 2v4" /><path d="M16 2v4" />
            <path d="M8 10h8" /><path d="M8 14h6" /><path d="M8 18h4" />
          </svg>
          {t('extName')}
        </h1>
        <div className="header-actions">
          <button className="btn btn-sm btn-secondary" onClick={() => setShowGuide(true)}>
            {t('guide')}
          </button>
          <button className="btn btn-sm btn-secondary" onClick={() => fetchCurrentConversation()}>
            {t('refresh')}
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="content-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Loading state */}
        {loading && (
          <div className="content-body" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="empty-state">
              <span className="spinner" style={{ width: 32, height: 32 }} />
              <p>{t('loadingConversation')}</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="content-body" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="empty-state" style={{ color: 'var(--error)' }}>
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p style={{ fontSize: 13, maxWidth: 280, textAlign: 'center' }}>{error}</p>
              <button className="btn btn-sm btn-secondary" onClick={() => fetchCurrentConversation()} style={{ marginTop: 8 }}>
                {t('retry')}
              </button>
            </div>
          </div>
        )}

        {/* No conversation open */}
        {!loading && !error && !conversation && (
          <div className="content-body" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="empty-state">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
              <p>{t('noConversationOpen')}</p>
            </div>
          </div>
        )}

        {/* Messages and export */}
        {!loading && !error && conversation && (
          <>
            <div className="content-header">
              <span className="conv-title">{conversation.title}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {t('messagesCount', currentMessages.length.toString())}
                {selectedIds.size > 0 && ` (${t('messagesSelectedCount', selectedIds.size.toString())})`}
              </span>
            </div>

            <FilterBar filters={filters} onChange={setFilters} />

            <div className="selection-actions">
              <button className="btn btn-sm btn-secondary" onClick={handleSelectAll}>{t('selectAll')}</button>
              <button className="btn btn-sm btn-secondary" onClick={handleDeselectAll}>{t('clear')}</button>
              <button className="btn btn-sm btn-secondary" onClick={handleInvertSelection}>{t('invert')}</button>
            </div>

            <MessageTree
              messages={getFilteredMessages()}
              selectedIds={selectedIds}
              onToggle={handleToggleMessage}
            />

            <ExportFormatSelector
              selected={exportFormat}
              onChange={setExportFormat}
            />

            <AdvancedOptions
              open={advancedOpen}
              onToggle={() => setAdvancedOpen(!advancedOpen)}
              options={exportOptions}
              onChange={setExportOptions}
            />
          </>
        )}
      </div>

      {/* Bottom bar */}
      <div className="bottom-bar">
        <span className="selection-count">
          {selectedIds.size > 0
            ? t('messagesSelectedCount', selectedIds.size.toString())
            : t('noMessagesSelected')}
        </span>
        <button className="btn btn-sm btn-secondary" onClick={handleDeselectAll}>
          {t('reset')}
        </button>
        <button
          className="btn btn-primary"
          disabled={selectedIds.size === 0 || exporting}
          onClick={handleExport}
        >
          {exporting ? (
            <>
              <span className="spinner" /> {t('exportingProgress', exportProgress.toString())}
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {t('exportBtn', exportFormat.toUpperCase())}
            </>
          )}
        </button>
      </div>

      {/* Progress bar */}
      {exporting && (
        <div className="status-bar">
          <span>{t('processingExport')}</span>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${exportProgress}%` }} />
          </div>
        </div>
      )}

      {/* Guide overlay */}
      {showGuide && <Guide onClose={() => setShowGuide(false)} />}

      {/* Notifications */}
      <Notification items={notifications} />
    </div>
  );
}
