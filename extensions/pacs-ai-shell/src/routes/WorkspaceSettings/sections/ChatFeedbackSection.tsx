import React, { useMemo, useState } from 'react';
import { studyOpenPath } from '@pacs-ai/extension-core/src/utils/viewerUrl';
import { useTranslation } from 'react-i18next';
import refreshIcon from '../../../assets/pacs/icons/refresh.png';
import type {
  ChatFeedbackCountsResponse,
  ChatFeedbackItem,
  ChatFeedbackVote,
} from '@pacs-ai/extension-core/src/api/orchestratorDTO';
import {
  FEEDBACK_COLORS,
  cardClassName,
  cardSubtitleClassName,
  cardTitleClassName,
} from '../model-feedback/components/dashboardTheme';
import { useChatFeedbackReview } from '../hooks/useChatFeedbackReview';
import { ToolUsageCard, ToolUseSection } from './ChatFeedbackToolUse';

const RANGE_DAYS = [7, 30, 90, 365] as const;

const selectClassName =
  'h-[38px] min-w-[150px] rounded-lg border border-white/15 bg-[#1B1F1B] px-3 text-sm text-white focus:border-[#C8F469] focus:outline-none';

/** The voter as the Members page names them: name, else email, else the raw id. */
export function voterLabel(item: Pick<ChatFeedbackItem, 'user_id' | 'user_name' | 'user_email'>): {
  primary: string;
  secondary: string | null;
} {
  const name = item.user_name?.trim();
  const email = item.user_email?.trim();
  if (name) {
    return { primary: name, secondary: email || null };
  }
  if (email) {
    return { primary: email, secondary: null };
  }
  return { primary: item.user_id, secondary: null };
}

/** Opens a study discussed in the chat (retrieved from the PACS if needed). */
export function viewerStudyHref(studyInstanceUID: string): string {
  return studyOpenPath(studyInstanceUID);
}

/**
 * A locale Intl always accepts. i18n.language can be a browser tag such as
 * "en-US@POSIX" that Intl rejects (RangeError), as the Model Feedback dashboard
 * also avoids.
 */
export function displayLocale(language?: string): string {
  return language?.toLowerCase().startsWith('fr') ? 'fr-CA' : 'en-CA';
}

export function formatTime(value: string | null | undefined, language?: string): string {
  if (!value) {
    return '—';
  }
  // The chat backend stores naive wall-clock times of the hospital's database
  // (America/Toronto on MHI), the same zone as the readers: read them as local
  // time, and only convert values that carry an offset.
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(displayLocale(language), { dateStyle: 'medium', timeStyle: 'short' });
}

function VoteBadge({ vote }: { vote: ChatFeedbackVote }) {
  const { t } = useTranslation('ChatFeedback');
  const down = vote === 'down';
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{
        color: down ? FEEDBACK_COLORS.down : FEEDBACK_COLORS.up,
        backgroundColor: down ? 'rgba(229,72,77,0.15)' : 'rgba(141,182,28,0.15)',
      }}
    >
      {down ? '▼' : '▲'} {down ? t('ThumbsDown') : t('ThumbsUp')}
    </span>
  );
}

function Kpi({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div className={cardClassName}>
      <div className={cardTitleClassName}>{label}</div>
      <div
        className="mt-2 text-3xl font-semibold text-white"
        style={color ? { color } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

function UpDownBars({
  rows,
  label,
}: {
  rows: Array<{ key: string; label: string; up: number; down: number }>;
  label: string;
}) {
  const max = Math.max(1, ...rows.map(row => row.up + row.down));
  return (
    <ul
      className="mt-3 space-y-2"
      aria-label={label}
    >
      {rows.map(row => (
        <li
          key={row.key}
          className="text-sm"
        >
          <div className="flex justify-between gap-2 text-white/80">
            <span className="truncate">{row.label}</span>
            <span className="tabular-nums text-white/60">
              ▲{row.up} ▼{row.down}
            </span>
          </div>
          <div className="mt-1 flex h-2 overflow-hidden rounded bg-white/5">
            <div
              style={{ width: `${(row.up / max) * 100}%`, backgroundColor: FEEDBACK_COLORS.up }}
            />
            <div
              style={{ width: `${(row.down / max) * 100}%`, backgroundColor: FEEDBACK_COLORS.down }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Summary({ counts }: { counts: ChatFeedbackCountsResponse }) {
  const { t, i18n } = useTranslation('ChatFeedback');
  const { t: tChat } = useTranslation('ChatBox');
  const { totals } = counts;
  const approval = totals.total ? `${((totals.up / totals.total) * 100).toFixed(1)}%` : '—';
  const reasons = counts.by_category.filter(row => row.vote === 'down');
  const maxReason = Math.max(1, ...reasons.map(row => row.count));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi
          label={t('TotalVotes')}
          value={totals.total}
        />
        <Kpi
          label={t('ThumbsDown')}
          value={totals.down}
          color={FEEDBACK_COLORS.down}
        />
        <Kpi
          label={t('ThumbsUp')}
          value={totals.up}
          color={FEEDBACK_COLORS.up}
        />
        <Kpi
          label={t('Approval')}
          value={approval}
        />
        <Kpi
          label={t('WithComment')}
          value={totals.with_comment}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className={cardClassName}>
          <h3 className={cardTitleClassName}>{t('PerWeek')}</h3>
          <UpDownBars
            label={t('PerWeek')}
            rows={counts.by_week.map(row => ({
              key: row.week_start,
              label: t('WeekOf', {
                date: new Date(`${row.week_start}T12:00:00Z`).toLocaleDateString(
                  displayLocale(i18n?.language),
                  {
                    month: 'short',
                    day: 'numeric',
                  }
                ),
              }),
              up: row.up,
              down: row.down,
            }))}
          />
        </div>
        <div className={cardClassName}>
          <h3 className={cardTitleClassName}>{t('TopReasons')}</h3>
          <ul className="mt-3 space-y-2">
            {reasons.map(row => (
              <li
                key={row.category}
                className="text-sm"
              >
                <div className="flex justify-between gap-2 text-white/80">
                  <span className="truncate">{tChat(`FeedbackReason_${row.category}`)}</span>
                  <span className="tabular-nums text-white/60">{row.count}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded bg-white/5">
                  <div
                    style={{
                      width: `${(row.count / maxReason) * 100}%`,
                      backgroundColor: FEEDBACK_COLORS.down,
                      height: '100%',
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className={cardClassName}>
          <h3 className={cardTitleClassName}>{t('BySpecialist')}</h3>
          <UpDownBars
            label={t('BySpecialist')}
            rows={counts.by_specialist.map(row => ({
              key: row.specialist,
              label: row.specialist === '(none)' ? t('NoSpecialist') : row.specialist,
              up: row.up,
              down: row.down,
            }))}
          />
        </div>
      </div>
      {counts.tool_usage && <ToolUsageCard usage={counts.tool_usage} />}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-white/50">{label}</dt>
      <dd className="mt-1 text-sm text-white/90">{children}</dd>
    </div>
  );
}

export function ChatFeedbackRow({
  item,
  showRaw = false,
}: {
  item: ChatFeedbackItem;
  showRaw?: boolean;
}) {
  const { t, i18n } = useTranslation('ChatFeedback');
  const { t: tChat } = useTranslation('ChatBox');
  const [open, setOpen] = useState(item.vote === 'down');
  const detailsId = `chat-feedback-${item.feedback_id}`;
  const voter = voterLabel(item);
  return (
    <li className="rounded-lg border border-white/10 bg-white/[0.02]">
      <button
        type="button"
        className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left"
        data-cy="chat-feedback-row-toggle"
        aria-expanded={open}
        aria-controls={detailsId}
        onClick={() => setOpen(value => !value)}
      >
        <VoteBadge vote={item.vote} />
        {item.turn_status && item.turn_status !== 'success' && (
          <span
            className="rounded px-1.5 py-0.5 text-xs font-medium"
            data-cy="chat-feedback-turn-status"
            style={{ color: '#ff8a8a', backgroundColor: 'rgba(255, 138, 138, 0.12)' }}
          >
            {t(`TurnStatus_${item.turn_status}`, { defaultValue: item.turn_status })}
          </span>
        )}
        <span className="text-sm text-white/80">{tChat(`FeedbackReason_${item.category}`)}</span>
        <span className="min-w-0 flex-1 truncate text-sm text-white/60">
          {item.question || (item.sealed_elsewhere ? t('SealedElsewhere') : '')}
        </span>
        <span className="text-xs text-white/50">{formatTime(item.updated_at, i18n?.language)}</span>
        <span
          aria-hidden="true"
          className="text-white/50"
        >
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && (
        <div
          id={detailsId}
          className="space-y-4 border-t border-white/10 px-4 py-4"
        >
          {item.sealed_elsewhere ? (
            <p className="text-sm text-white/60">{t('SealedElsewhere')}</p>
          ) : (
            <>
              <Field label={t('Question')}>
                <p className="whitespace-pre-wrap">{item.question}</p>
              </Field>
              <Field label={t('Answer')}>
                <div className="ohif-scrollbar max-h-[420px] overflow-y-auto whitespace-pre-wrap rounded-md bg-black/20 p-3">
                  {item.answer}
                </div>
              </Field>
              {item.turn_error && (
                <Field label={t('TurnError')}>
                  <p
                    className="whitespace-pre-wrap break-words"
                    data-cy="chat-feedback-turn-error"
                    style={{ color: '#ff8a8a' }}
                  >
                    {item.turn_error}
                  </p>
                </Field>
              )}
            </>
          )}
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t('Reason')}>{tChat(`FeedbackReason_${item.category}`)}</Field>
            <Field label={t('Comment')}>
              {item.comment ? (
                <span className="whitespace-pre-wrap">{item.comment}</span>
              ) : (
                <span className="text-white/50">{t('NoComment')}</span>
              )}
            </Field>
            <Field label={t('Time')}>{formatTime(item.updated_at, i18n?.language)}</Field>
            <Field label={t('Study')}>
              {item.study_instance_uid ? (
                <a
                  className="break-all text-[#C8F469] underline"
                  href={viewerStudyHref(item.study_instance_uid)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('OpenStudy')}
                </a>
              ) : (
                '—'
              )}
            </Field>
            <Field label={t('User')}>
              <span
                className="break-all"
                title={item.user_id}
              >
                {voter.primary}
              </span>
              {voter.secondary && (
                <span className="block break-all text-xs text-white/50">{voter.secondary}</span>
              )}
            </Field>
            <Field label={t('Specialists')}>
              {item.specialists.length ? item.specialists.join(', ') : t('NoSpecialist')}
            </Field>
            <Field label={t('Model')}>{item.model || '—'}</Field>
            <Field label={t('Harness')}>{item.harness_version || '—'}</Field>
          </dl>
          {!item.sealed_elsewhere && (
            <ToolUseSection
              feedbackId={item.feedback_id}
              toolCount={item.tool_count}
              showRaw={showRaw}
            />
          )}
        </div>
      )}
    </li>
  );
}

const ChatFeedbackSection = ({
  active,
  showRaw = false,
}: {
  active: boolean;
  showRaw?: boolean;
}) => {
  const { t } = useTranslation('ChatFeedback');
  const [days, setDays] = useState<number>(90);
  const [rating, setRating] = useState<ChatFeedbackVote | ''>('');
  const [study, setStudy] = useState('');
  const query = useMemo(() => ({ days, rating, study }), [days, rating, study]);
  const review = useChatFeedbackReview({ active, query });

  return (
    <section
      className="space-y-4"
      aria-labelledby="chat-feedback-title"
    >
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div>
          <h2
            id="chat-feedback-title"
            className={cardTitleClassName}
          >
            {t('Title')}
          </h2>
          <p className={cardSubtitleClassName}>{t('Subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-white/60">
            {t('Range')}
            <select
              className={selectClassName}
              value={days}
              onChange={event => setDays(Number(event.target.value))}
            >
              {RANGE_DAYS.map(value => (
                <option
                  key={value}
                  value={value}
                >
                  {t(`Range_${value}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-white/60">
            {t('Rating')}
            <select
              className={selectClassName}
              value={rating}
              onChange={event => setRating(event.target.value as ChatFeedbackVote | '')}
            >
              <option value="">{t('RatingAll')}</option>
              <option value="down">{t('RatingDown')}</option>
              <option value="up">{t('RatingUp')}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-white/60">
            {t('StudyFilter')}
            <input
              className={`${selectClassName} min-w-[220px]`}
              placeholder={t('StudyFilterPlaceholder')}
              value={study}
              onChange={event => setStudy(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="border-white/15 flex h-[38px] items-center gap-2 rounded-lg border px-3 text-sm text-white hover:border-[#C8F469]"
            onClick={review.refresh}
          >
            <img
              src={refreshIcon}
              alt=""
              className="h-4 w-4"
            />
            {t('Refresh')}
          </button>
        </div>
      </div>

      {review.error === 'not_configured' && (
        <p className="text-sm text-white/60">{t('NotConfigured')}</p>
      )}
      {review.error === 'failed' && (
        <p
          className="text-sm text-red-300"
          role="alert"
        >
          {t('LoadError')}
        </p>
      )}
      {review.loading && review.items.length === 0 && (
        <p className="text-sm text-white/60">{t('Loading')}</p>
      )}

      {review.counts && !review.error && <Summary counts={review.counts} />}

      {!review.error && !review.loading && review.items.length === 0 && (
        <p className="text-sm text-white/60">{t('Empty')}</p>
      )}
      {review.items.length > 0 && (
        <div className={cardClassName}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className={cardTitleClassName}>{t('Votes')}</h3>
            <span className="text-xs text-white/50">
              {t('Showing', { shown: review.items.length, total: review.total })}
            </span>
          </div>
          <ul className="space-y-2">
            {review.items.map(item => (
              <ChatFeedbackRow
                key={item.feedback_id}
                item={item}
                showRaw={showRaw}
              />
            ))}
          </ul>
          {review.hasMore && (
            <button
              type="button"
              className="border-white/15 mt-3 rounded-lg border px-4 py-2 text-sm text-white hover:border-[#C8F469]"
              onClick={review.loadMore}
              disabled={review.loading}
            >
              {t('ShowMore')}
            </button>
          )}
        </div>
      )}
    </section>
  );
};

export default ChatFeedbackSection;
