import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import orchestratorRepository from '@pacs-ai/extension-core/src/api/orchestratorRepository';
import type {
  ChatFeedbackDetail,
  ChatFeedbackToolCall,
  ChatFeedbackToolStats,
  ChatFeedbackToolUsage,
} from '@pacs-ai/extension-core/src/api/orchestratorDTO';
import {
  FEEDBACK_COLORS,
  cardClassName,
  cardSubtitleClassName,
  cardTitleClassName,
} from '../model-feedback/components/dashboardTheme';

/** "171 ms", "52.1 s"; null (not recorded on an old turn) is "n/a". */
export function formatDuration(ms: number | null | undefined, notAvailable: string): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) {
    return notAvailable;
  }
  if (ms < 1000) {
    return `${Math.round(ms)} ms`;
  }
  return `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)} s`;
}

function StatusPill({ status }: { status: ChatFeedbackToolCall['status'] }) {
  const { t } = useTranslation('ChatFeedback');
  if (!status) {
    return <span className="text-xs text-white/50">{t('ToolNotAvailable')}</span>;
  }
  const error = status === 'error';
  const ok = status === 'ok';
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{
        color: error ? FEEDBACK_COLORS.down : ok ? FEEDBACK_COLORS.up : '#E8C468',
        backgroundColor: error
          ? 'rgba(229,72,77,0.15)'
          : ok
            ? 'rgba(141,182,28,0.15)'
            : 'rgba(232,196,104,0.15)',
      }}
    >
      {t(`ToolStatus_${status}`, { defaultValue: status })}
    </span>
  );
}

function CallRow({ call }: { call: ChatFeedbackToolCall }) {
  const { t } = useTranslation('ChatFeedback');
  const na = t('ToolNotAvailable');
  const agent = call.agent === 'supervisor' ? t('Supervisor') : call.agent || na;
  return (
    <li
      className="rounded-md border border-white/10 bg-black/20 px-3 py-2"
      style={{ marginLeft: `${Math.min(call.depth, 4) * 20}px` }}
      data-cy="chat-feedback-tool-call"
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs tabular-nums text-white/40">#{call.seq + 1}</span>
        <span className="text-white/70">{agent}</span>
        <span className="text-white/30">›</span>
        <span className="font-mono text-[#C8F469]">{call.tool}</span>
        {call.specialist && (
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-white/80">
            {t('ToolSpecialist', { name: call.specialist })}
          </span>
        )}
        <StatusPill status={call.status} />
        <span
          className="text-xs tabular-nums text-white/60"
          title={t('ToolDuration')}
        >
          {call.origin === 'cache' ? t('ToolFromMemory') : formatDuration(call.duration_ms, na)}
        </span>
        <span
          className="text-xs text-white/40"
          title={t('ToolModel')}
        >
          {call.model || `${t('ToolModel')}: ${na}`}
        </span>
      </div>
      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        {call.args_summary && (
          <>
            <dt className="text-white/40">{t('ToolArguments')}</dt>
            <dd className="break-words font-mono text-white/70">{call.args_summary}</dd>
          </>
        )}
        {call.run_selection && (
          <>
            <dt className="text-white/40">{t('ToolRun')}</dt>
            <dd className="text-white/80">{call.run_selection}</dd>
          </>
        )}
        {call.input && (
          <>
            <dt className="text-white/40">{t('ToolInput')}</dt>
            <dd className="text-white/80">{call.input}</dd>
          </>
        )}
        {(call.error || call.result_summary) && (
          <>
            <dt className="text-white/40">{t('ToolResult')}</dt>
            <dd
              className="break-words"
              style={call.error ? { color: FEEDBACK_COLORS.down } : undefined}
            >
              <span className={call.error ? '' : 'text-white/70'}>
                {call.error || call.result_summary}
              </span>
            </dd>
          </>
        )}
      </dl>
    </li>
  );
}

/**
 * The tool calls behind a rated answer, in order and nested (supervisor →
 * specialist → tool). Loaded when first opened; the raw (redacted) JSON is for
 * workspace admins.
 */
export function ToolUseSection({
  feedbackId,
  toolCount,
  showRaw,
}: {
  feedbackId: string;
  toolCount: number;
  showRaw: boolean;
}) {
  const { t } = useTranslation('ChatFeedback');
  const [open, setOpen] = useState(toolCount > 0);
  const [raw, setRaw] = useState(false);
  const [detail, setDetail] = useState<ChatFeedbackDetail | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'done'>('idle');

  // Loaded when first opened; opening again after an error retries (attempt).
  const [attempt, setAttempt] = useState(0);
  const loaded = state === 'done';
  useEffect(() => {
    if (!open || loaded) {
      return undefined;
    }
    let cancelled = false;
    setState('loading');
    orchestratorRepository
      .GetChatFeedback(feedbackId)
      .then(response => {
        if (!cancelled) {
          setDetail(response?.data ?? null);
          setState('done');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState('error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, feedbackId, attempt, loaded]);

  const calls = detail?.tool_calls;
  const sectionId = `chat-feedback-tools-${feedbackId}`;
  return (
    <div
      className="rounded-md border border-white/10"
      data-cy="chat-feedback-tool-use"
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        aria-expanded={open}
        aria-controls={sectionId}
        onClick={() => {
          if (state === 'error') {
            setAttempt(value => value + 1);
          }
          setOpen(value => !value);
        }}
      >
        <span
          aria-hidden="true"
          className="text-white/50"
        >
          {open ? '▾' : '▸'}
        </span>
        <span className="text-xs uppercase tracking-wide text-white/60">{t('ToolUse')}</span>
        <span className="text-xs text-white/40">{t('ToolUseCount', { count: toolCount })}</span>
      </button>
      {open && (
        <div
          id={sectionId}
          className="space-y-2 border-t border-white/10 px-3 py-3"
        >
          {state === 'loading' && <p className="text-sm text-white/60">{t('ToolUseLoading')}</p>}
          {state === 'error' && (
            <p
              className="text-sm text-red-300"
              role="alert"
            >
              {t('ToolUseError')}
            </p>
          )}
          {state === 'done' && calls === null && (
            <p className="text-sm text-white/60">{t('ToolUseUnavailable')}</p>
          )}
          {state === 'done' && calls && calls.length === 0 && (
            <p className="text-sm text-white/60">{t('ToolUseNone')}</p>
          )}
          {state === 'done' && calls && calls.length > 0 && (
            <ol className="space-y-1.5">
              {calls.map(call => (
                <CallRow
                  key={call.seq}
                  call={call}
                />
              ))}
            </ol>
          )}
          {state === 'done' && showRaw && calls && calls.length > 0 && (
            <div>
              <button
                type="button"
                className="text-xs text-[#C8F469] underline"
                onClick={() => setRaw(value => !value)}
              >
                {raw ? t('ToolUseHideRaw') : t('ToolUseShowRaw')}
              </button>
              {raw && (
                <pre
                  className="ohif-scrollbar mt-2 max-h-[360px] overflow-auto rounded-md bg-black/40 p-3 text-xs text-white/80"
                  data-cy="chat-feedback-tool-raw"
                >
                  {JSON.stringify(calls, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function pct(stats: ChatFeedbackToolStats, na: string): string {
  return stats.error_rate === null ? na : `${(stats.error_rate * 100).toFixed(0)}%`;
}

/** Calls per tool, error rate and median latency for up- vs down-voted answers. */
export function ToolUsageCard({ usage }: { usage: ChatFeedbackToolUsage }) {
  const { t } = useTranslation('ChatFeedback');
  const na = t('ToolNotAvailable');
  const max = Math.max(1, ...usage.by_tool.map(row => Math.max(row.up.calls, row.down.calls)));
  const { up, down } = usage.totals;
  return (
    <div
      className={cardClassName}
      data-cy="chat-feedback-tool-usage"
    >
      <h3 className={cardTitleClassName}>{t('ToolUsage')}</h3>
      <p className={cardSubtitleClassName}>{t('ToolUsageSubtitle')}</p>
      <p className="mt-2 text-xs text-white/60">
        {t('ToolUsageTotals', {
          upCalls: up.calls,
          upErrors: up.errors,
          upMedian: formatDuration(up.median_ms, na),
          downCalls: down.calls,
          downErrors: down.errors,
          downMedian: formatDuration(down.median_ms, na),
        })}
      </p>
      {usage.by_tool.length === 0 ? (
        <p className="mt-3 text-sm text-white/60">{t('ToolUsageEmpty')}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-white/50">
                <th className="py-1 pr-3 font-normal">{t('ToolName')}</th>
                <th
                  className="py-1 pr-3 font-normal"
                  style={{ color: FEEDBACK_COLORS.up }}
                >
                  ▲ {t('ToolUsageCalls')}
                </th>
                <th className="py-1 pr-3 font-normal">▲ {t('ToolUsageErrors')}</th>
                <th className="py-1 pr-3 font-normal">▲ {t('ToolUsageMedian')}</th>
                <th
                  className="py-1 pr-3 font-normal"
                  style={{ color: FEEDBACK_COLORS.down }}
                >
                  ▼ {t('ToolUsageCalls')}
                </th>
                <th className="py-1 pr-3 font-normal">▼ {t('ToolUsageErrors')}</th>
                <th className="py-1 font-normal">▼ {t('ToolUsageMedian')}</th>
              </tr>
            </thead>
            <tbody>
              {usage.by_tool.map(row => (
                <tr
                  key={row.tool}
                  className="border-t border-white/5 text-white/80"
                >
                  <td className="py-1.5 pr-3">
                    <div className="font-mono text-xs">{row.tool}</div>
                    <div className="mt-1 flex h-1.5 w-32 gap-0.5">
                      <div
                        style={{
                          width: `${(row.up.calls / max) * 50}%`,
                          backgroundColor: FEEDBACK_COLORS.up,
                        }}
                      />
                      <div
                        style={{
                          width: `${(row.down.calls / max) * 50}%`,
                          backgroundColor: FEEDBACK_COLORS.down,
                        }}
                      />
                    </div>
                  </td>
                  <td className="py-1.5 pr-3 tabular-nums">{row.up.calls}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{pct(row.up, na)}</td>
                  <td className="py-1.5 pr-3 tabular-nums">
                    {formatDuration(row.up.median_ms, na)}
                  </td>
                  <td className="py-1.5 pr-3 tabular-nums">{row.down.calls}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{pct(row.down, na)}</td>
                  <td className="py-1.5 tabular-nums">{formatDuration(row.down.median_ms, na)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
