import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatActivity, ChatCitation, Message } from '../types';
import { CITATION_INDEX_ATTRIBUTE, remarkCitationMarkers } from '../utils/citations';
import { parseStructuredAnswer } from '../utils/structuredAnswer';
import { splitClinicalCards, withoutCardBlocks } from '../utils/clinicalCards';
import { DictationCard, RecommendationCard } from './ClinicalCards';
import { ThinkingIndicator } from './ThinkingIndicator';
import { ActivitySummary } from './ActivitySummary';
import { CitationChip } from './CitationChip';
import { StructuredAnswerCards } from './StructuredAnswerCards';
import { FeedbackReasonForm } from './FeedbackReasonForm';
import type { ChatFeedbackEntry } from '../hooks/useChatFeedback';

interface MessageBubbleProps {
  message: Message;
  // Live steps while this message is the thinking placeholder.
  progress?: ChatActivity | null;
  feedback?: ChatFeedbackEntry | null;
  onFeedback?: (message: Message, type: 'up' | 'down') => void;
  // Saves the reason and comment of a thumbs down.
  onFeedbackDetails?: (message: Message, category: string, comment: string) => void;
}

const NO_CITATIONS: ChatCitation[] = [];

// Built once per set of citations: react-markdown mounts these as component
// types, so a new function on every render would remount the chips and close
// an open citation popover.
function useMarkdownRendering(citations: ChatCitation[]) {
  return useMemo(() => {
    const byIndex = new Map(citations.map(citation => [citation.index, citation]));
    return {
      remarkPlugins: [
        remarkGfm,
        [remarkCitationMarkers, { indexes: Array.from(byIndex.keys()) }],
      ] as React.ComponentProps<typeof ReactMarkdown>['remarkPlugins'],
      components: {
        a: ({ node: _node, ...props }) => (
          <a
            {...props}
            target="_blank"
            rel="noopener noreferrer"
          />
        ),
        img: ({ node: _node, alt }) => <span>{alt ? `[Image: ${alt}]` : '[Image omitted]'}</span>,
        table: ({ node: _node, ...props }) => (
          <div
            className="markdown-table-wrapper"
            role="region"
            aria-label="Scrollable table"
            tabIndex={0}
          >
            <table {...props} />
          </div>
        ),
        // A "[n]" marker with a citation (see remarkCitationMarkers).
        sup: ({ node: _node, children, ...props }) => {
          const citation = byIndex.get(Number(props[CITATION_INDEX_ATTRIBUTE]));
          return citation ? <CitationChip citation={citation} /> : <sup {...props}>{children}</sup>;
        },
      } as React.ComponentProps<typeof ReactMarkdown>['components'],
    };
  }, [citations]);
}

const ANSWER_LANGUAGE_SOURCE_KEYS: Record<string, string> = {
  message_request: 'AnswerLanguageSourceRequest',
  conversation_request: 'AnswerLanguageSourceRequest',
  message_language: 'AnswerLanguageSourceTyped',
  client: 'AnswerLanguageSourceClient',
  conversation: 'AnswerLanguageSourceConversation',
  default: 'AnswerLanguageSourceDefault',
};

/** Small FR / EN tag: the language the chat backend answered in, and why (tooltip). */
const AnswerLanguageBadge: React.FC<{ language: 'en' | 'fr'; source?: string }> = ({
  language,
  source,
}) => {
  const { t } = useTranslation('ChatBox');
  const sourceKey = source ? ANSWER_LANGUAGE_SOURCE_KEYS[source] : undefined;
  const title = t('AnswerLanguage', {
    language: t(language === 'fr' ? 'AnswerLanguageFr' : 'AnswerLanguageEn'),
    source: sourceKey ? t(sourceKey) : source || '',
  });
  return (
    <span
      className="rounded border border-current px-1 text-[10px] font-semibold uppercase leading-4"
      data-testid="answer-language"
      title={title}
      aria-label={title}
    >
      {language}
    </span>
  );
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  progress = null,
  feedback,
  onFeedback,
  onFeedbackDetails,
}) => {
  const { t } = useTranslation('ChatBox');
  const vote = feedback?.vote ?? null;
  const isUser = message.sender === 'user';
  const isAssistant = message.sender === 'assistant';
  const citations = (isAssistant && message.citations) || NO_CITATIONS;
  const markdown = useMarkdownRendering(citations);
  const clinical = useMemo(
    () => (isAssistant && !message.isThinking ? splitClinicalCards(message.text) : null),
    [isAssistant, message.isThinking, message.text]
  );
  const structured = useMemo(
    () =>
      isAssistant && !message.isThinking && !clinical
        ? parseStructuredAnswer(withoutCardBlocks(message.text || ''))
        : null,
    [isAssistant, message.isThinking, message.text, clinical]
  );
  const wide = !!(structured || clinical);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`${wide ? 'max-w-[94%]' : 'max-w-[80%]'} rounded-lg px-4 py-2 ${
          isUser
            ? 'bg-gradient-to-r from-[rgba(100,180,100,0.7)] to-[rgba(180,230,100,0.7)] text-white'
            : 'bg-[#333633] text-white'
        }`}
      >
        <div className={wide ? 'text-sm' : 'whitespace-pre-wrap text-sm'}>
          {message.isThinking ? (
            <ThinkingIndicator
              activity={progress}
              startedAt={message.timestamp}
            />
          ) : clinical ? (
            <div
              className="chat-structured-answer"
              data-cy="chat-clinical-answer"
            >
              {clinical.map((part, idx) => {
                if (part.kind === 'card') {
                  return part.card.type === 'management' ? (
                    <RecommendationCard
                      key={`card-${idx}`}
                      card={part.card}
                      citations={citations}
                      markdownComponents={markdown.components}
                      remarkPlugins={markdown.remarkPlugins}
                    />
                  ) : (
                    <DictationCard
                      key={`card-${idx}`}
                      card={part.card}
                      citations={citations}
                      markdownComponents={markdown.components}
                      remarkPlugins={markdown.remarkPlugins}
                    />
                  );
                }
                const partStructured = parseStructuredAnswer(part.text);
                return partStructured ? (
                  <StructuredAnswerCards
                    key={`part-${idx}`}
                    structured={partStructured}
                    citations={citations}
                    markdownComponents={markdown.components}
                    remarkPlugins={markdown.remarkPlugins}
                  />
                ) : (
                  <ReactMarkdown
                    key={`part-${idx}`}
                    className="markdown-content"
                    components={markdown.components}
                    remarkPlugins={markdown.remarkPlugins}
                  >
                    {part.text}
                  </ReactMarkdown>
                );
              })}
            </div>
          ) : structured ? (
            <StructuredAnswerCards
              structured={structured}
              citations={citations}
              markdownComponents={markdown.components}
              remarkPlugins={markdown.remarkPlugins}
            />
          ) : (
            <ReactMarkdown
              className="markdown-content"
              components={markdown.components}
              remarkPlugins={markdown.remarkPlugins}
            >
              {withoutCardBlocks(message.text || '').trim()}
            </ReactMarkdown>
          )}
        </div>
        {isAssistant && !message.isThinking && message.activity && (
          <ActivitySummary activity={message.activity} />
        )}
        <div className="mt-1 flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs opacity-70">
            {message.timestamp.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
            {isAssistant && message.responseLanguage && (
              <AnswerLanguageBadge
                language={message.responseLanguage}
                source={message.responseLanguageSource}
              />
            )}
          </span>
          {isAssistant && !message.isThinking && onFeedback && (
            <div className="flex gap-2 text-gray-400">
              <button
                type="button"
                onClick={() => onFeedback(message, 'up')}
                disabled={feedback?.status === 'saving'}
                className={`transition-colors ${
                  vote === 'up' ? 'text-green-500' : 'hover:text-green-400'
                }`}
                aria-label={t('FeedbackThumbsUp')}
                aria-pressed={vote === 'up'}
                title={t('FeedbackThumbsUp')}
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => onFeedback(message, 'down')}
                disabled={feedback?.status === 'saving'}
                className={`transition-colors ${
                  vote === 'down' ? 'text-red-500' : 'hover:text-red-400'
                }`}
                aria-label={t('FeedbackThumbsDown')}
                aria-pressed={vote === 'down'}
                title={t('FeedbackThumbsDown')}
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.737 3h4.017c.163 0 .326.02.485.06L17 4m-7 10v5a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>
        {isAssistant &&
          feedback?.status === 'error' &&
          !(vote === 'down' && message.backendMessageId) && (
            <p
              className="mt-1 text-xs text-red-300"
              role="alert"
            >
              {t('FeedbackSaveError')}
            </p>
          )}
        {isAssistant &&
          vote === 'down' &&
          message.backendMessageId &&
          onFeedbackDetails &&
          feedback && (
            <FeedbackReasonForm
              entry={feedback}
              onSave={(category, comment) => onFeedbackDetails(message, category, comment)}
            />
          )}
      </div>
    </div>
  );
};
