import React from 'react';
import type { ExportFormat } from '../../types';
import { t } from '../i18n';

interface ExportFormatSelectorProps {
  selected: ExportFormat;
  onChange: (format: ExportFormat) => void;
}

const FORMATS: { key: ExportFormat; label: string; icon: React.ReactNode }[] = [
  {
    key: 'word',
    label: 'Word',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  },
  {
    key: 'pdf',
    label: 'PDF',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15h6"/><path d="M12 12v6"/></svg>,
  },
  {
    key: 'html',
    label: 'HTML',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
  },
  {
    key: 'markdown',
    label: 'MD',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/><text x="9" y="14" fontSize="8" fontWeight="bold">M</text></svg>,
  },
  {
    key: 'json',
    label: 'JSON',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><text x="8" y="16" fontSize="8" fontWeight="bold">{ }</text></svg>,
  },
  {
    key: 'png',
    label: 'PNG',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  },
  {
    key: 'svg',
    label: 'SVG',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5"/><line x1="12" y1="22" x2="12" y2="15.5"/><polyline points="22 8.5 12 15.5 2 8.5"/></svg>,
  },
];

/**
 * Shod format selector with icon buttons for each export format.
 */
export function ExportFormatSelector({ selected, onChange }: ExportFormatSelectorProps) {
  return (
    <div className="export-format-bar">
      <div className="format-label">{t('exportFormatLabel')}</div>
      <div className="format-icons">
        {FORMATS.map(({ key, label, icon }) => (
          <button
            key={key}
            className={`format-btn ${selected === key ? 'active' : ''}`}
            onClick={() => onChange(key)}
            title={t('exportAs', label)}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
