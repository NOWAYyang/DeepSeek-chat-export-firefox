import React from 'react';
import type { ExportOptions, PageSize, PageOrientation, HighlightTheme } from '../../types';
import { t } from '../i18n';

interface AdvancedOptionsProps {
  open: boolean;
  onToggle: () => void;
  options: ExportOptions;
  onChange: (options: ExportOptions) => void;
}

/**
 * Collapsible advanced options panel for PDF page settings,
 * code highlight theme, metadata toggle, and dark mode.
 */
export function AdvancedOptions({ open, onToggle, options, onChange }: AdvancedOptionsProps) {
  const update = (partial: Partial<ExportOptions>) => {
    onChange({ ...options, ...partial });
  };

  return (
    <div className="advanced-options">
      <button className="advanced-toggle" onClick={onToggle}>
        <svg
          viewBox="0 0 24 24"
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        {t('advancedOptions')}
      </button>

      {open && (
        <div className="advanced-panel">
          <label>
            {t('pageSize')}
            <select
              value={options.pageSize}
              onChange={(e) => update({ pageSize: e.target.value as PageSize })}
            >
              <option value="A4">A4</option>
              <option value="Letter">Letter</option>
            </select>
          </label>

          <label>
            {t('orientation')}
            <select
              value={options.pageOrientation}
              onChange={(e) => update({ pageOrientation: e.target.value as PageOrientation })}
            >
              <option value="portrait">{t('portrait')}</option>
              <option value="landscape">{t('landscape')}</option>
            </select>
          </label>

          <label>
            {t('marginMM')}
            <input
              type="number"
              min="5"
              max="50"
              value={options.margin}
              onChange={(e) => update({ margin: Number(e.target.value) || 20 })}
              style={{ width: 50 }}
            />
          </label>

          <label>
            {t('highlightTheme')}
            <select
              value={options.highlightTheme}
              onChange={(e) => update({ highlightTheme: e.target.value as HighlightTheme })}
            >
              <option value="github">GitHub</option>
              <option value="monokai">Monokai</option>
              <option value="vs2015">VS Code</option>
              <option value="atom-dark">Atom Dark</option>
              <option value="default">Default</option>
            </select>
          </label>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={options.includeMetadata}
              onChange={(e) => update({ includeMetadata: e.target.checked })}
            />
            {t('includeMetadata')}
          </label>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={options.darkMode}
              onChange={(e) => update({ darkMode: e.target.checked })}
            />
            {t('darkMode')}
          </label>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={options.preserveDeepSeekStyle}
              onChange={(e) => update({ preserveDeepSeekStyle: e.target.checked })}
            />
            {t('deepSeekStyle')}
          </label>
        </div>
      )}
    </div>
  );
}
