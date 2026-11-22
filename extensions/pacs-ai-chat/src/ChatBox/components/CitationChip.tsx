import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { ChatCitation, ChatModelResultCitation, ChatWebSourceCitation } from '../types';
import { useChatCitationResultActions } from '../citations/ChatCitationHost';
import {
  citationDomain,
  citationLabel,
  formatCitationDate,
  safeExternalURL,
} from '../utils/citations';

type Translate = (key: string, options?: Record<string, unknown>) => string;

const POPOVER_WIDTH = 288;
const POPOVER_GAP = 6;
const VIEWPORT_MARGIN = 8;

interface CitationChipProps {
  citation: ChatCitation;
}

const CHIP_CLASS =
  'mx-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full border px-1 align-super text-[10px] font-semibold leading-none transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C8F469]';
// A citation of an unknown kind keeps the neutral look of the first chips.
const NEUTRAL_CHIP_CLASS =
  'border-white/30 bg-white/10 text-white/90 hover:border-[#C8F469] hover:text-[#C8F469] focus-visible:border-[#C8F469] focus-visible:text-[#C8F469] aria-expanded:border-[#C8F469] aria-expanded:text-[#C8F469]';

/**
 * How a chip shows what it cites: a model result and a published source
 * have their own colours (ChatBox.styles.ts) and say their kind as tooltip.
 */
export const CITATION_KINDS: Record<
  string,
  { className: string; labelKey: string; defaultLabel: string }
> = {
  model_result: {
    className: 'chat-citation-chip-model',
    labelKey: 'CitationModelResult',
    defaultLabel: 'AI model result',
  },
  web_source: {
    className: 'chat-citation-chip-source',
    labelKey: 'CitationWebSource',
    defaultLabel: 'Published source',
  },
};

/**
 * The "[n]" marker of an answer as a small chip that opens a popover saying
 * what the marker refers to.
 */
export const CitationChip: React.FC<CitationChipProps> = ({ citation }) => {
  const { t } = useTranslation('ChatBox');
  const [isOpen, setIsOpen] = useState(false);
  const chipRef = useRef<HTMLButtonElement>(null);
  const label = citationLabel(citation, t as Translate);
  const kind = CITATION_KINDS[citation.kind];

  const close = useCallback((returnFocus: boolean) => {
    setIsOpen(false);
    if (returnFocus) {
      chipRef.current?.focus();
    }
  }, []);

  return (
    <>
      <button
        ref={chipRef}
        type="button"
        className={`${CHIP_CLASS} ${kind ? kind.className : NEUTRAL_CHIP_CLASS}`}
        aria-label={label}
        title={kind ? t(kind.labelKey, { defaultValue: kind.defaultLabel }) : undefined}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(open => !open)}
        data-cy="chat-citation-chip"
        data-citation-kind={citation.kind}
      >
        {citation.index}
      </button>
      {isOpen && (
        <CitationPopover
          citation={citation}
          label={label}
          anchorRef={chipRef}
          onClose={close}
        />
      )}
    </>
  );
};

interface CitationPopoverProps {
  citation: ChatCitation;
  label: string;
  anchorRef: React.RefObject<HTMLButtonElement>;
  onClose: (returnFocus: boolean) => void;
}

const CitationPopover: React.FC<CitationPopoverProps> = ({
  citation,
  label,
  anchorRef,
  onClose,
}) => {
  const { t } = useTranslation('ChatBox');
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<React.CSSProperties>({ top: 0, left: 0 });

  // Below the chip, or above it when there is no room; kept inside the window.
  useLayoutEffect(() => {
    const anchor = anchorRef.current?.getBoundingClientRect();
    if (!anchor) {
      return;
    }
    const height = popoverRef.current?.offsetHeight ?? 0;
    const left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(anchor.left, window.innerWidth - POPOVER_WIDTH - VIEWPORT_MARGIN)
    );
    const below = anchor.bottom + POPOVER_GAP;
    const fitsBelow = below + height + VIEWPORT_MARGIN <= window.innerHeight;
    const above = anchor.top - POPOVER_GAP - height;
    setPosition({ left, top: fitsBelow || above < VIEWPORT_MARGIN ? below : above });
  }, [anchorRef]);

  useEffect(() => {
    popoverRef.current?.focus();
  }, []);

  useEffect(() => {
    const outside = (target: EventTarget | null) =>
      !(target instanceof Node) ||
      (!popoverRef.current?.contains(target) && !anchorRef.current?.contains(target));
    const onPointerDown = (event: MouseEvent) => {
      if (outside(event.target)) {
        onClose(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose(true);
      }
    };
    // The popover is placed once: when what is behind it moves, it goes away.
    const onScroll = (event: Event) => {
      if (outside(event.target) || event.target === document) {
        onClose(false);
      }
    };
    const onResize = () => onClose(false);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [anchorRef, onClose]);

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={label}
      tabIndex={-1}
      className="border-white/15 fixed z-[60] rounded-lg border bg-[#232823] p-3 text-left text-xs text-white shadow-xl focus:outline-none"
      style={{ ...position, width: POPOVER_WIDTH, maxWidth: 'calc(100vw - 16px)' }}
      // The chat box is draggable; a press in the popover is not a drag.
      onMouseDown={event => event.stopPropagation()}
      data-cy="chat-citation-popover"
    >
      <button
        type="button"
        className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded text-white/60 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C8F469]"
        aria-label={t('CitationClose', { defaultValue: 'Close' })}
        onClick={() => onClose(true)}
      >
        <span aria-hidden="true">×</span>
      </button>
      {citation.kind === 'model_result' ? (
        <ModelResultCitationDetails
          citation={citation}
          onClose={onClose}
        />
      ) : (
        <WebSourceCitationDetails citation={citation} />
      )}
    </div>,
    document.body
  );
};

const KIND_CLASS = 'pr-6 text-[10px] font-semibold uppercase tracking-wide text-white/50';
const ACTION_CLASS =
  'rounded-md border border-white/20 px-2 py-1 text-xs font-semibold text-white/90 hover:border-[#C8F469] hover:text-[#C8F469] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C8F469]';
const DISABLED_ACTION_CLASS =
  'cursor-not-allowed rounded-md border border-white/10 px-2 py-1 text-xs font-semibold text-white/40 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40';

type RawResultState =
  | { status: 'hidden' }
  | { status: 'loading' }
  | { status: 'ready'; text: string }
  | { status: 'error' };

function rawResultText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch (error: unknown) {
    return String(value);
  }
}

const ModelResultCitationDetails: React.FC<{
  citation: ChatModelResultCitation;
  onClose: (returnFocus: boolean) => void;
}> = ({ citation, onClose }) => {
  const { t } = useTranslation('ChatBox');
  const { open, loadRawResult, loading } = useChatCitationResultActions(citation);
  const [raw, setRaw] = useState<RawResultState>({ status: 'hidden' });
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );
  const completedAt = formatCitationDate(citation.completedAt);
  const unavailable = t('CitationResultUnavailable', {
    defaultValue: 'This result is not available in the viewer',
  });

  const toggleRaw = () => {
    if (!loadRawResult) {
      return;
    }
    if (raw.status !== 'hidden') {
      setRaw({ status: 'hidden' });
      return;
    }
    setRaw({ status: 'loading' });
    loadRawResult().then(
      value => mounted.current && setRaw({ status: 'ready', text: rawResultText(value) }),
      () => mounted.current && setRaw({ status: 'error' })
    );
  };

  return (
    <>
      <p className={KIND_CLASS}>{t('CitationModelResult', { defaultValue: 'AI model result' })}</p>
      <p className="mt-0.5 break-words text-sm font-semibold">
        {citation.title || citation.modelName}
        {citation.modelVersion && (
          <span className="ml-1.5 text-xs font-normal text-[#c5cbc5]">
            v{citation.modelVersion}
          </span>
        )}
      </p>
      {completedAt && (
        <p
          className="mt-0.5 text-[#c5cbc5]"
          data-cy="chat-citation-completed"
        >
          {t('CitationCompletedAt', {
            date: completedAt,
            defaultValue: `Completed ${completedAt}`,
          })}
        </p>
      )}
      {citation.summary && <p className="mt-2 break-words">{citation.summary}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {open ? (
          <button
            type="button"
            className={ACTION_CLASS}
            onClick={() => {
              onClose(false);
              open();
            }}
            data-cy="chat-citation-open-result"
          >
            {t('CitationOpenResult', { defaultValue: 'Open result' })}
          </button>
        ) : (
          // Not `disabled`, so that it keeps its tooltip and can be reached
          // with the keyboard to learn why.
          <button
            type="button"
            className={DISABLED_ACTION_CLASS}
            aria-disabled="true"
            aria-busy={loading || undefined}
            title={loading ? undefined : unavailable}
            data-cy="chat-citation-open-result"
          >
            {t('CitationOpenResult', { defaultValue: 'Open result' })}
          </button>
        )}
        {loadRawResult && (
          <button
            type="button"
            className={ACTION_CLASS}
            aria-expanded={raw.status !== 'hidden'}
            onClick={toggleRaw}
            data-cy="chat-citation-raw-result"
          >
            {t('CitationRawResult', { defaultValue: 'Raw result' })}
          </button>
        )}
      </div>
      {raw.status === 'loading' && (
        <p
          role="status"
          className="mt-2 text-[#c5cbc5]"
        >
          {t('CitationRawLoading', { defaultValue: 'Loading result…' })}
        </p>
      )}
      {raw.status === 'error' && (
        <p
          role="alert"
          className="mt-2 text-[#ffb0b0]"
        >
          {t('CitationRawError', { defaultValue: 'The raw result could not be loaded.' })}
        </p>
      )}
      {raw.status === 'ready' && (
        <pre
          className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded border border-white/10 bg-black/30 p-2 font-mono text-[11px] text-white/90"
          tabIndex={0}
          aria-label={t('CitationRawResult', { defaultValue: 'Raw result' })}
          data-cy="chat-citation-raw-data"
        >
          {raw.text}
        </pre>
      )}
    </>
  );
};

const WebSourceCitationDetails: React.FC<{ citation: ChatWebSourceCitation }> = ({ citation }) => {
  const { t } = useTranslation('ChatBox');
  const href = safeExternalURL(citation.url);
  const domain = citationDomain(citation.url);

  return (
    <>
      <p className={KIND_CLASS}>{t('CitationWebSource', { defaultValue: 'Published source' })}</p>
      {citation.title && (
        <p className="mt-0.5 break-words text-sm font-semibold">{citation.title}</p>
      )}
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block break-all text-[#C8F469] underline hover:text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C8F469]"
          title={href}
          data-cy="chat-citation-link"
        >
          {domain}
          <span aria-hidden="true"> ↗</span>
        </a>
      ) : (
        citation.url && <p className="mt-1 break-all text-[#c5cbc5]">{citation.url}</p>
      )}
    </>
  );
};

export default CitationChip;
