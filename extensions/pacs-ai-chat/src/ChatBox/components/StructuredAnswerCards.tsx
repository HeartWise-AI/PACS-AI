import React from 'react';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import type { ChatCitation } from '../types';
import type { ParsedAnswerCard, StructuredAnswer } from '../utils/structuredAnswer';
import { CITATION_KINDS, CitationChip } from './CitationChip';

interface StructuredAnswerCardsProps {
  structured: StructuredAnswer;
  citations: ChatCitation[];
  markdownComponents: React.ComponentProps<typeof ReactMarkdown>['components'];
  remarkPlugins: React.ComponentProps<typeof ReactMarkdown>['remarkPlugins'];
}

function HeaderCitations({
  indexes,
  byIndex,
}: {
  indexes: number[];
  byIndex: Map<number, ChatCitation>;
}) {
  if (indexes.length === 0) {
    return null;
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-0.5">
      {indexes.map(idx => {
        const citation = byIndex.get(idx);
        return citation ? (
          <CitationChip
            key={idx}
            citation={citation}
          />
        ) : (
          <span
            key={idx}
            className="text-[11px] opacity-75"
          >
            [{idx}]
          </span>
        );
      })}
    </span>
  );
}

/**
 * A block of the answer as its own Markdown document, followed by the link
 * definitions of the whole answer so that "[text][ref]" resolves in any card.
 * A definition renders nothing.
 */
const LinkDefinitions = React.createContext('');

function withDefinitions(markdown: string, definitions: string): string {
  return definitions ? `${markdown}\n\n${definitions}` : markdown;
}

// "1. ..." or "1) ...". At most three digits: "2024. ..." starts with a year.
const NUMBERED_SOURCE = /^(\d{1,3})[.)]\s+(.*)$/;

type SourceLine = { number: number; text: string; closed?: boolean } | { markdown: string };

/**
 * Lines of a Sources card: numbered sources, and any other Markdown between
 * them. A number is a source when it is at most the highest citation index
 * of the answer or the count of numbered lines; any other numbered line
 * stays text, with its number escaped so Markdown does not renumber it as a
 * list.
 */
function sourceLines(body: string, byIndex: Map<number, ChatCitation>): SourceLine[] {
  const rows = body.split('\n');
  const highest = Math.max(
    rows.filter(row => NUMBERED_SOURCE.test(row.trim())).length,
    ...byIndex.keys()
  );
  const lines: SourceLine[] = [];
  for (const row of rows) {
    const match = row.trim().match(NUMBERED_SOURCE);
    const number = match ? Number(match[1]) : 0;
    const last = lines[lines.length - 1];
    if (match && number >= 1 && number <= highest) {
      lines.push({ number, text: match[2] });
      continue;
    }
    const markdown = row.replace(/^(\s*\d+)([.)])/, '$1\\$2');
    // A line right under a source, with no blank line between, continues it:
    // "5. [Guideline](" then "  https://...)" is one link.
    if (last && 'number' in last && row.trim() && !last.closed) {
      last.text += `\n${markdown}`;
      continue;
    }
    if (last && 'number' in last && !row.trim()) {
      last.closed = true;
    }
    if (last && 'markdown' in last) {
      last.markdown += `\n${markdown}`;
    } else {
      lines.push({ markdown });
    }
  }
  return lines;
}

/**
 * The sources of an answer with the number each one has in the text. An
 * ordered list would number them from its first item, so a list that skips
 * a number would no longer match the [n] markers.
 */
/** "● AI model result ● Published source", when the answer cites both kinds. */
function CitationKey({ byIndex }: { byIndex: Map<number, ChatCitation> }) {
  const { t } = useTranslation('ChatBox');
  const kinds = new Set([...byIndex.values()].map(citation => citation.kind));
  if (!kinds.has('model_result') || !kinds.has('web_source')) {
    return null;
  }
  return (
    <div
      className="chat-citation-key"
      data-cy="chat-citation-key"
    >
      {(['model_result', 'web_source'] as const).map(name => (
        <span
          key={name}
          className={`chat-citation-key-${name === 'model_result' ? 'model' : 'source'}`}
        >
          {t(CITATION_KINDS[name].labelKey, { defaultValue: CITATION_KINDS[name].defaultLabel })}
        </span>
      ))}
    </div>
  );
}

function SourcesBody({
  body,
  byIndex,
  markdownComponents,
  remarkPlugins,
}: {
  body: string;
  byIndex: Map<number, ChatCitation>;
  markdownComponents: React.ComponentProps<typeof ReactMarkdown>['components'];
  remarkPlugins: React.ComponentProps<typeof ReactMarkdown>['remarkPlugins'];
}) {
  const definitions = React.useContext(LinkDefinitions);
  return (
    <>
      <CitationKey byIndex={byIndex} />
      {sourceLines(body, byIndex).map((line, idx) => {
        if (!('number' in line)) {
          return (
            <ReactMarkdown
              key={`markdown-${idx}`}
              className="markdown-content chat-card-markdown"
              components={markdownComponents}
              remarkPlugins={remarkPlugins}
            >
              {withDefinitions(line.markdown, definitions)}
            </ReactMarkdown>
          );
        }
        const citation = byIndex.get(line.number);
        return (
          <div
            key={`source-${idx}`}
            className="flex items-baseline gap-1.5"
            data-cy="chat-source-line"
          >
            {citation ? (
              <CitationChip citation={citation} />
            ) : (
              <span className="text-[11px] opacity-75">{line.number}.</span>
            )}
            <ReactMarkdown
              className="markdown-content chat-card-markdown min-w-0"
              components={markdownComponents}
              remarkPlugins={remarkPlugins}
            >
              {withDefinitions(line.text, definitions)}
            </ReactMarkdown>
          </div>
        );
      })}
    </>
  );
}

function CardItem({
  card,
  byIndex,
  markdownComponents,
  remarkPlugins,
}: {
  card: ParsedAnswerCard;
  byIndex: Map<number, ChatCitation>;
  markdownComponents: React.ComponentProps<typeof ReactMarkdown>['components'];
  remarkPlugins: React.ComponentProps<typeof ReactMarkdown>['remarkPlugins'];
}) {
  const definitions = React.useContext(LinkDefinitions);
  if (card.kind === 'summary') {
    return (
      <section
        className="chat-summary-card"
        data-cy="chat-summary-card"
        aria-label={card.title}
      >
        <div className="chat-summary-header">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="chat-summary-badge"
              data-cy="chat-summary-badge"
            >
              {card.title}
            </span>
            {card.provenance && <span className="chat-card-provenance">{card.provenance}</span>}
          </div>
          <HeaderCitations
            indexes={card.citationIndexes}
            byIndex={byIndex}
          />
        </div>
        {card.pills.length > 0 && (
          <div
            className="chat-summary-pills"
            data-cy="chat-summary-pills"
          >
            {card.pills.map((pill, idx) => (
              <span
                key={`${idx}-${pill}`}
                className="chat-summary-pill"
              >
                {pill}
              </span>
            ))}
          </div>
        )}
        <ReactMarkdown
          className="markdown-content chat-card-markdown"
          components={markdownComponents}
          remarkPlugins={remarkPlugins}
        >
          {withDefinitions(card.body, definitions)}
        </ReactMarkdown>
      </section>
    );
  }

  const className =
    card.kind === 'caveat'
      ? 'chat-caveats-card'
      : card.kind === 'sources'
        ? 'chat-sources-card'
        : 'chat-section-card';

  const dataCy =
    card.kind === 'caveat'
      ? 'chat-caveats-card'
      : card.kind === 'sources'
        ? 'chat-sources-card'
        : 'chat-section-card';

  return (
    <section
      className={className}
      data-cy={dataCy}
      aria-label={card.title}
    >
      <div className="chat-section-header">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            <span className="chat-section-title">{card.title}</span>
            {card.provenance && <span className="chat-card-provenance">({card.provenance})</span>}
          </div>
          {card.subtitle && <div className="chat-section-subtitle">{card.subtitle}</div>}
        </div>
        <HeaderCitations
          indexes={card.citationIndexes}
          byIndex={byIndex}
        />
      </div>
      {card.kind === 'sources' ? (
        <SourcesBody
          body={card.body}
          byIndex={byIndex}
          markdownComponents={markdownComponents}
          remarkPlugins={remarkPlugins}
        />
      ) : (
        <ReactMarkdown
          className="markdown-content chat-card-markdown"
          components={markdownComponents}
          remarkPlugins={remarkPlugins}
        >
          {withDefinitions(card.body, definitions)}
        </ReactMarkdown>
      )}
    </section>
  );
}

export const StructuredAnswerCards: React.FC<StructuredAnswerCardsProps> = ({
  structured,
  citations,
  markdownComponents,
  remarkPlugins,
}) => {
  const byIndex = React.useMemo(
    () => new Map(citations.map(citation => [citation.index, citation])),
    [citations]
  );
  const definitions = structured.linkDefinitions.join('\n');

  return (
    <LinkDefinitions.Provider value={definitions}>
      <div
        className="chat-structured-answer"
        data-cy="chat-structured-answer"
      >
        {structured.eyebrow && <div className="chat-answer-eyebrow">{structured.eyebrow}</div>}
        {structured.leadBlocks.map((block, idx) => (
          <ReactMarkdown
            key={`lead-${idx}`}
            className="markdown-content chat-card-markdown"
            components={markdownComponents}
            remarkPlugins={remarkPlugins}
          >
            {withDefinitions(block, definitions)}
          </ReactMarkdown>
        ))}
        {structured.cards.map((card, idx) => (
          <CardItem
            key={`${card.kind}-${idx}-${card.title}`}
            card={card}
            byIndex={byIndex}
            markdownComponents={markdownComponents}
            remarkPlugins={remarkPlugins}
          />
        ))}
        {structured.footerBlocks.length > 0 && (
          <div className="chat-answer-footer">
            {structured.footerBlocks.map((block, idx) => (
              <ReactMarkdown
                key={`footer-${idx}`}
                className="markdown-content chat-card-markdown"
                components={markdownComponents}
                remarkPlugins={remarkPlugins}
              >
                {withDefinitions(block, definitions)}
              </ReactMarkdown>
            ))}
          </div>
        )}
      </div>
    </LinkDefinitions.Provider>
  );
};
