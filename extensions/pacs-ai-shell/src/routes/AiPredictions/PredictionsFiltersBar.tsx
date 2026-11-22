import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PredictionsFilters } from './types';

export interface LaunchedByUser {
  id: string;
  name: string;
}

const FIELD = 'flex flex-col gap-1';
const LABEL = 'text-xs text-[#A9B3A6]';
const CONTROL =
  'min-h-[44px] rounded-lg border border-[#3A4438] bg-[#101410] px-3 text-[13px] text-[#E8ECE6] focus:outline-none focus:ring-2 focus:ring-[#C8F469]';
export const SEARCH_DEBOUNCE_MS = 350;

export function PredictionsFiltersBar({
  filters,
  models,
  modalities,
  users,
  onChange,
  invalidDateRange,
}: {
  filters: PredictionsFilters;
  models: string[];
  modalities: string[];
  users: LaunchedByUser[];
  onChange: (change: Partial<PredictionsFilters>) => void;
  invalidDateRange: boolean;
}) {
  const { t } = useTranslation('AiPredictions');
  const [search, setSearch] = useState(filters.search);

  useEffect(() => setSearch(filters.search), [filters.search]);
  useEffect(() => {
    if (search === filters.search) {
      return;
    }
    const timer = setTimeout(() => onChange({ search }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <section
      aria-label={t('Filters')}
      className="mb-3.5 flex flex-wrap items-end gap-2.5 rounded-lg border border-[#222922] bg-[#171d17] px-4 py-3.5"
    >
      <div className={`${FIELD} min-w-[220px] flex-[2_1_220px]`}>
        <label
          htmlFor="ai-predictions-search"
          className={LABEL}
        >
          {t('Patient, MRN or accession')}
        </label>
        <input
          id="ai-predictions-search"
          type="search"
          className={CONTROL}
          value={search}
          placeholder={t('Search')}
          aria-describedby="ai-predictions-search-help"
          onChange={event => setSearch(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              onChange({ search });
            }
          }}
        />
        <span
          id="ai-predictions-search-help"
          className="text-[11px] text-[#A9B3A6]"
        >
          {t(
            'MRN and accession are searched in every exam; patient names only in the exams already loaded.'
          )}
        </span>
      </div>
      <div className={`${FIELD} flex-[1_1_150px]`}>
        <label
          htmlFor="ai-predictions-model"
          className={LABEL}
        >
          {t('Model')}
        </label>
        <select
          id="ai-predictions-model"
          className={CONTROL}
          value={filters.model}
          onChange={event => onChange({ model: event.target.value })}
        >
          <option value="">{t('All models')}</option>
          {models.map(model => (
            <option
              key={model}
              value={model}
            >
              {model}
            </option>
          ))}
        </select>
      </div>
      <div className={`${FIELD} flex-[1_1_150px]`}>
        <label
          htmlFor="ai-predictions-status"
          className={LABEL}
        >
          {t('Status')}
        </label>
        <select
          id="ai-predictions-status"
          className={CONTROL}
          value={filters.status}
          onChange={event =>
            onChange({ status: event.target.value as PredictionsFilters['status'] })
          }
        >
          <option value="any">{t('Any status')}</option>
          <option value="active">{t('Running or waiting')}</option>
          <option value="attention">{t('Needs attention')}</option>
          <option value="completed">{t('Completed')}</option>
        </select>
      </div>
      <div className={`${FIELD} flex-[1_1_120px]`}>
        <label
          htmlFor="ai-predictions-modality"
          className={LABEL}
        >
          {t('Modality')}
        </label>
        <select
          id="ai-predictions-modality"
          className={CONTROL}
          value={filters.modality}
          onChange={event => onChange({ modality: event.target.value })}
        >
          <option value="">{t('All')}</option>
          {modalities.map(modality => (
            <option
              key={modality}
              value={modality}
            >
              {modality}
            </option>
          ))}
        </select>
      </div>
      <div className={`${FIELD} flex-[1_1_150px]`}>
        <label
          htmlFor="ai-predictions-date"
          className={LABEL}
        >
          {t('Date')}
        </label>
        <select
          id="ai-predictions-date"
          className={CONTROL}
          value={filters.date}
          onChange={event => onChange({ date: event.target.value as PredictionsFilters['date'] })}
        >
          <option value="today">{t('Today')}</option>
          <option value="7d">{t('Last 7 days')}</option>
          <option value="30d">{t('Last 30 days')}</option>
          <option value="any">{t('Any time')}</option>
          <option value="custom">{t('Custom range')}</option>
        </select>
      </div>
      {filters.date === 'custom' && (
        <>
          <div className={`${FIELD} flex-[1_1_140px]`}>
            <label
              htmlFor="ai-predictions-from"
              className={LABEL}
            >
              {t('From')}
            </label>
            <input
              id="ai-predictions-from"
              type="date"
              className={CONTROL}
              value={filters.customFrom}
              aria-invalid={invalidDateRange}
              aria-describedby={invalidDateRange ? 'ai-predictions-date-error' : undefined}
              onChange={event => onChange({ customFrom: event.target.value })}
            />
          </div>
          <div className={`${FIELD} flex-[1_1_140px]`}>
            <label
              htmlFor="ai-predictions-to"
              className={LABEL}
            >
              {t('To')}
            </label>
            <input
              id="ai-predictions-to"
              type="date"
              className={CONTROL}
              value={filters.customTo}
              aria-invalid={invalidDateRange}
              aria-describedby={invalidDateRange ? 'ai-predictions-date-error' : undefined}
              onChange={event => onChange({ customTo: event.target.value })}
            />
          </div>
        </>
      )}
      {filters.view === 'all' && (
        <div className={`${FIELD} flex-[1_1_190px]`}>
          <label
            htmlFor="ai-predictions-launched-by"
            className={LABEL}
          >
            {t('Launched by')}
          </label>
          <select
            id="ai-predictions-launched-by"
            className={CONTROL}
            value={filters.launchedBy}
            onChange={event => onChange({ launchedBy: event.target.value })}
          >
            <option value="any">{t('Anyone, including automatic')}</option>
            <option value="automatic">{t('Automatic only')}</option>
            <option value="people">{t('People only')}</option>
            {users.map(user => (
              <option
                key={user.id}
                value={`user:${user.id}`}
              >
                {user.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {invalidDateRange && (
        <p
          id="ai-predictions-date-error"
          role="alert"
          className="basis-full text-[13px] text-[#FFB199]"
        >
          {t('Choose a start or end date; the end date cannot be before the start date.')}
        </p>
      )}
    </section>
  );
}
