import type { ChatCitation, ChatModelResultCitation, ChatWebSourceCitation } from '../types';

type Translate = (key: string, options?: Record<string, unknown>) => string;

const optionalText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

/**
 * The usable citations of a chat response, or undefined when it has none
 * (older backend, answer without markers) or sent something else.
 */
export function toCitations(value: unknown): ChatCitation[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const seen = new Set<number>();
  const citations: ChatCitation[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const raw = item as Record<string, unknown>;
    const index = raw.index;
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 1 || seen.has(index)) {
      continue;
    }
    if (raw.kind === 'model_result') {
      const modelName = optionalText(raw.modelName) ?? optionalText(raw.title);
      if (!modelName) {
        continue;
      }
      const citation: ChatModelResultCitation = {
        index,
        kind: 'model_result',
        modelName,
        modelVersion: optionalText(raw.modelVersion),
        completedAt: optionalText(raw.completedAt),
        studyInstanceUID: optionalText(raw.studyInstanceUID),
        studyServiceJobId: optionalText(raw.studyServiceJobId),
        title: optionalText(raw.title),
        summary: optionalText(raw.summary),
        outputMode: optionalText(raw.outputMode),
      };
      citations.push(citation);
    } else if (raw.kind === 'web_source') {
      const title = optionalText(raw.title);
      const url = optionalText(raw.url);
      if (!title && !url) {
        continue;
      }
      const citation: ChatWebSourceCitation = { index, kind: 'web_source', title, url };
      citations.push(citation);
    } else {
      continue;
    }
    seen.add(index);
  }
  return citations.length ? citations : undefined;
}

/** The URL when it is a web link the chat may open, else null. */
export function safeExternalURL(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null;
  } catch (error: unknown) {
    return null;
  }
}

/** "escardio.org" for "https://www.escardio.org/Guidelines/…". */
export function citationDomain(url: string | null | undefined): string | null {
  const safe = safeExternalURL(url);
  return safe ? new URL(safe).hostname.replace(/^www\./i, '') : null;
}

/** What a citation points to, in a few words: "DeepCORO-JEPA 2.1.0" or the source's title. */
export function citationName(citation: ChatCitation): string {
  if (citation.kind === 'model_result') {
    return [citation.title || citation.modelName, citation.modelVersion].filter(Boolean).join(' ');
  }
  return citation.title || citationDomain(citation.url) || citation.url || '';
}

/** Accessible name of a citation chip: "Source 1: DeepCORO-JEPA 2.1.0". */
export function citationLabel(citation: ChatCitation, t: Translate): string {
  const name = citationName(citation);
  return name
    ? t('CitationSource', {
        index: citation.index,
        name,
        defaultValue: `Source ${citation.index}: ${name}`,
      })
    : t('CitationSourcePlain', {
        index: citation.index,
        defaultValue: `Source ${citation.index}`,
      });
}

const ZONED_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})$/i;
const NAIVE_TIMESTAMP = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(:\d{2}(\.\d+)?)?$/;

/**
 * Completion time for display. A timestamp with a time zone is shown in the
 * reader's locale; one without is shown as written, since its zone is unknown.
 */
export function formatCitationDate(value: string | null | undefined): string {
  const text = value?.trim();
  if (!text) {
    return '';
  }
  if (ZONED_TIMESTAMP.test(text)) {
    const time = Date.parse(text.replace(' ', 'T').replace(/\s+/g, ''));
    if (Number.isFinite(time)) {
      return new Date(time).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    }
  }
  const naive = NAIVE_TIMESTAMP.exec(text);
  return naive ? `${naive[1]} ${naive[2]}` : text;
}

// A "[n]" marker; the digits are captured.
const MARKER = /\[(\d{1,4})\]/g;

export const CITATION_INDEX_ATTRIBUTE = 'data-citation-index';

interface MarkdownNode {
  type: string;
  value?: string;
  children?: MarkdownNode[];
  data?: Record<string, unknown>;
}

// Text in these is left alone: a chip is a button and cannot sit in a link.
const SKIPPED_PARENTS = new Set(['link', 'linkReference', 'definition']);

function splitMarkers(text: string, indexes: ReadonlySet<number>): MarkdownNode[] | null {
  const nodes: MarkdownNode[] = [];
  let last = 0;
  MARKER.lastIndex = 0;
  for (let match = MARKER.exec(text); match; match = MARKER.exec(text)) {
    const index = Number(match[1]);
    // "[01]" is not the marker of citation 1, and "[7]" without a citation 7
    // stays text.
    if (String(index) !== match[1] || !indexes.has(index)) {
      continue;
    }
    if (match.index > last) {
      nodes.push({ type: 'text', value: text.slice(last, match.index) });
    }
    nodes.push({
      type: 'citationMarker',
      children: [{ type: 'text', value: match[0] }],
      data: { hName: 'sup', hProperties: { [CITATION_INDEX_ATTRIBUTE]: String(index) } },
    });
    last = match.index + match[0].length;
  }
  if (!nodes.length) {
    return null;
  }
  if (last < text.length) {
    nodes.push({ type: 'text', value: text.slice(last) });
  }
  return nodes;
}

function markChildren(node: MarkdownNode, indexes: ReadonlySet<number>): void {
  if (!Array.isArray(node.children) || SKIPPED_PARENTS.has(node.type)) {
    return;
  }
  const children: MarkdownNode[] = [];
  for (const child of node.children) {
    // Code keeps its text in `value` of a `code` / `inlineCode` node, so only
    // prose is looked at.
    const marked =
      child.type === 'text' && typeof child.value === 'string'
        ? splitMarkers(child.value, indexes)
        : null;
    if (marked) {
      children.push(...marked);
    } else {
      markChildren(child, indexes);
      children.push(child);
    }
  }
  node.children = children;
}

/**
 * remark plugin: turns each "[n]" of the prose whose n is one of `indexes`
 * into a `<sup data-citation-index="n">[n]</sup>` element, which the message
 * renders as a citation chip. Every other "[n]" stays text.
 */
export function remarkCitationMarkers(options?: { indexes?: Iterable<number> } | null) {
  const indexes = new Set(options?.indexes ?? []);
  return (tree: unknown) => {
    if (indexes.size) {
      markChildren(tree as MarkdownNode, indexes);
    }
  };
}
