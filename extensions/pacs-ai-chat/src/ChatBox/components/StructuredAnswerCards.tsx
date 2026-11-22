import React from 'react';
import ReactMarkdown from 'react-markdown';
import type { ChatCitation } from '../types';
import type { ParsedAnswerCard, StructuredAnswer } from '../utils/structuredAnswer';
import { CitationChip } from './CitationChip';

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

const NUMBERED_SOURCE = /^(\d+)\.\s+(.*)$/;

type SourceLine = { number: number; text: string } | { markdown: string };

/** Lines of a Sources card: numbered sources, and any other Markdown between them. */
function sourceLines(body: string): SourceLine[] {
  const lines: SourceLine[] = [];
  for (const line of body.split('\n')) {
    const match = line.trim().match(NUMBERED_SOURCE);
    const last = lines[lines.length - 1];
    if (match) {
      lines.push({ number: Number(match[1]), text: match[2] });
    } else if (last && 'markdown' in last) {
      last.markdown += `\n${line}`;
    } else {
      lines.push({ markdown: line });
    }
  }
  return lines;
}

/**
 * The sources of an answer with the number each one has in the text. An
 * ordered list would number them from its first item, so a list that skips
 * a number would no longer match the [n] markers.
 */
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
  return (
    <>
      {sourceLines(body).map((line, idx) => {
        if (!('number' in line)) {
          return (
            <ReactMarkdown
              key={`markdown-${idx}`}
              className="markdown-content chat-card-markdown"
              components={markdownComponents}
              remarkPlugins={remarkPlugins}
            >
              {line.markdown}
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
              {line.text}
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
          {card.body}
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
          {card.body}
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

  return (
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
          {block}
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
              {block}
            </ReactMarkdown>
          ))}
        </div>
      )}
    </div>
  );
};
