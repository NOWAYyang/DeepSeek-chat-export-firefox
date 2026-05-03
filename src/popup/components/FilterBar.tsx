import React from 'react';
import type { FilterOptions } from '../../types';
import { t } from '../i18n';

interface FilterBarProps {
  filters: FilterOptions;
  onChange: (filters: FilterOptions) => void;
}

/**
 * Global filter controls: role, date range, keyword search.
 */
export function FilterBar({ filters, onChange }: FilterBarProps) {
  const update = (partial: Partial<FilterOptions>) => {
    onChange({ ...filters, ...partial });
  };

  return (
    <div className="filter-bar">
      <span className="filter-label">{t('filter')}</span>

      <select
        value={filters.role}
        onChange={(e) => update({ role: e.target.value as FilterOptions['role'] })}
      >
        <option value="all">{t('allRoles')}</option>
        <option value="user">{t('userOnly')}</option>
        <option value="assistant">{t('assistantOnly')}</option>
      </select>

      <input
        type="text"
        placeholder={t('searchKeyword')}
        value={filters.keyword}
        onChange={(e) => update({ keyword: e.target.value })}
        style={{ width: 120 }}
      />
    </div>
  );
}
