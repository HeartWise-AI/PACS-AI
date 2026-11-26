import React from 'react';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import type { ChatCitation } from '../types';
import {
  cardCitationIndexes,
  dictationText,
  type DictationCardData,
  type ManagementCardData,
} from '../utils/clinicalCards';
import { CitationChip } from './CitationChip';

type MarkdownProps = {
  citations: ChatCitation[];
  markdownComponents: React.ComponentProps<typeof ReactMarkdown>['components'];
  remarkPlugins: React.ComponentProps<typeof ReactMarkdown>['remarkPlugins'];
};

function Inline({
  text,
  markdownComponents,
  remarkPlugins,
}: Omit<MarkdownProps, 'citations'> & { text: string }) {
  return (
    <ReactMarkdown
      className="markdown-content chat-card-markdown chat-clinical-inline"
      components={markdownComponents}
      remarkPlugins={remarkPlugins}
    >
      {text}
    </ReactMarkdown>
  );
}

function Bullets({ items, ...markdown }: Omit<MarkdownProps, 'citations'> & { items: string[] }) {
  return (
    <ul className="chat-clinical-list">
      {items.map((item, idx) => (
        <li key={`${idx}-${item.slice(0, 16)}`}>
          <Inline
            text={item}
            {...markdown}
          />
        </li>
      ))}
    </ul>
  );
}

function CardSources({ indexes, citations }: { indexes: number[]; citations: ChatCitation[] }) {
  const { t } = useTranslation('ChatBox');
  const byIndex = new Map(citations.map(citation => [citation.index, citation]));
  const cited = indexes
    .map(index => byIndex.get(index))
    .filter((item): item is ChatCitation => !!item);
  if (cited.length === 0) {
    return null;
  }
  return (
    <details
      className="chat-clinical-details"
      data-cy="chat-clinical-sources"
    >
      <summary>{t('ClinicalSources', { defaultValue: 'Sources' })}</summary>
      {cited.map(citation => (
        <div
          key={citation.index}
          className="flex items-baseline gap-1.5"
        >
          <CitationChip citation={citation} />
          {citation.kind === 'web_source' && citation.url ? (
            <a
              href={citation.url}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0"
            >
              {citation.title || citation.url}
            </a>
          ) : (
            <span className="min-w-0">
              {citation.title || (citation.kind === 'model_result' ? citation.modelName : '')}
            </span>
          )}
        </div>
      ))}
    </details>
  );
}

export function RecommendationCard({
  card,
  citations,
  ...markdown
}: MarkdownProps & { card: ManagementCardData }) {
  const { t } = useTranslation('ChatBox');
  const medications = card.medications ?? [];
  const details: [string, string, string[]][] = [
    ['strategy', t('ClinicalStrategy', { defaultValue: 'Strategy' }), card.strategy ?? []],
    [
      'alternatives',
      t('ClinicalAlternatives', { defaultValue: 'Alternatives' }),
      card.alternatives ?? [],
    ],
    ['checks', t('ClinicalChecks', { defaultValue: 'Check before acting' }), card.checks ?? []],
    ['follow_up', t('ClinicalFollowUp', { defaultValue: 'Follow-up' }), card.follow_up ?? []],
  ];
  const cell = (value?: string | null) =>
    value ? (
      <Inline
        text={value}
        {...markdown}
      />
    ) : (
      <span className="opacity-50">—</span>
    );
  return (
    <section
      className="chat-summary-card chat-clinical-card"
      data-cy="chat-recommendation-card"
      aria-label={t('ClinicalRecommendation', { defaultValue: 'Recommendation' })}
    >
      <div className="chat-summary-header">
        <span className="chat-summary-badge">
          {t('ClinicalRecommendation', { defaultValue: 'Recommendation' })}
        </span>
      </div>
      <div data-cy="chat-recommendation-summary">
        <Bullets
          items={card.summary}
          {...markdown}
        />
      </div>
      {medications.length > 0 && (
        <div
          className="chat-clinical-medications"
          data-cy="chat-medications"
          role="list"
          aria-label={t('ClinicalMedications', { defaultValue: 'Medications' })}
        >
          {medications.map((item, idx) => (
            <div
              key={`${idx}-${item.drug}`}
              className="chat-clinical-medication"
              data-cy="chat-medication-row"
              role="listitem"
            >
              <div className="chat-clinical-drug">{cell(item.drug)}</div>
              <dl className="chat-clinical-doses">
                {(
                  [
                    [
                      'loading',
                      t('ClinicalLoadingDose', { defaultValue: 'Loading dose' }),
                      item.loading_dose,
                    ],
                    [
                      'maintenance',
                      t('ClinicalMaintenance', { defaultValue: 'Maintenance' }),
                      item.maintenance,
                    ],
                    [
                      'duration',
                      t('ClinicalDuration', { defaultValue: 'Duration' }),
                      item.duration,
                    ],
                    ['notes', t('ClinicalNotes', { defaultValue: 'Notes' }), item.notes],
                  ] as [string, string, string | null | undefined][]
                )
                  .filter(([, , value]) => !!value)
                  .map(([key, label, value]) => (
                    <React.Fragment key={key}>
                      <dt>{label}</dt>
                      <dd>{cell(value)}</dd>
                    </React.Fragment>
                  ))}
              </dl>
            </div>
          ))}
        </div>
      )}
      {details
        .filter(([, , items]) => items.length > 0)
        .map(([key, title, items]) => (
          <details
            key={key}
            className="chat-clinical-details"
            data-cy={`chat-recommendation-${key}`}
            open={key === 'strategy'}
          >
            <summary>{title}</summary>
            <Bullets
              items={items}
              {...markdown}
            />
          </details>
        ))}
      <CardSources
        indexes={cardCitationIndexes(card)}
        citations={citations}
      />
    </section>
  );
}

export function DictationCard({
  card,
  citations: _citations,
  ...markdown
}: MarkdownProps & { card: DictationCardData }) {
  const { t } = useTranslation('ChatBox');
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(dictationText(card));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (_error) {
      setCopied(false);
    }
  };
  return (
    <section
      className="chat-section-card chat-clinical-card"
      data-cy="chat-dictation-card"
      aria-label={card.title}
    >
      <div className="chat-section-header">
        <span className="chat-section-title">{card.title}</span>
        <button
          type="button"
          className="chat-clinical-copy"
          data-cy="chat-dictation-copy"
          onClick={copy}
        >
          {copied
            ? t('ClinicalCopied', { defaultValue: 'Copied' })
            : t('ClinicalCopyDictation', { defaultValue: 'Copy' })}
        </button>
      </div>
      {card.sections.map((section, idx) => (
        <div
          key={`${idx}-${section.label}`}
          className="chat-dictation-section"
        >
          <div className="chat-dictation-label">{section.label}</div>
          <Inline
            text={section.body}
            {...markdown}
          />
        </div>
      ))}
      {card.footer && <div className="chat-dictation-footer">{card.footer}</div>}
    </section>
  );
}
