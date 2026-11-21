export type AnswerCardKind = 'summary' | 'section' | 'caveat' | 'sources';

export interface ParsedAnswerCard {
  kind: AnswerCardKind;
  title: string;
  subtitle?: string;
  pills: string[];
  provenance?: string;
  citationIndexes: number[];
  body: string;
}

export interface StructuredAnswer {
  eyebrow?: string;
  leadBlocks: string[];
  cards: ParsedAnswerCard[];
  footerBlocks: string[];
}

const BOLD_LINE = /^\*\*([^*\n]+)\*\*\s*$/;
const SUMMARY_TITLE = /^(synthesis|synthèse|synthese|summary|résumé|resume)\b/i;
const CAVEAT_TITLE =
  /^(what cannot be decided|ce que ces données ne permettent pas|ce que ces donnees ne permettent pas|warnings?\b|avertissements?\b|limitations?\b|limites?\b|discordant)/i;
const SOURCES_TITLE = /^sources\b/i;
const TRAILING_CITATIONS = /(?:\s*\[(\d+)\])+\s*$/;
const SINGLE_CITATION = /\[(\d+)\]/g;
const PROVENANCE_SUFFIX = /\s*\((AI estimates?|estimations? de l['’]IA)\)\s*$/i;

function splitSemicolonsOutsideParens(text: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '(') depth += 1;
    else if (ch === ')' && depth > 0) depth -= 1;
    else if (ch === ';' && depth === 0) {
      const part = text.slice(start, i).trim();
      if (part) items.push(part);
      start = i + 1;
    }
  }
  const tail = text.slice(start).trim();
  if (tail) items.push(tail);
  return items;
}

function parseHeading(rawHeading: string): {
  kind: AnswerCardKind;
  title: string;
  subtitle?: string;
  pills: string[];
  provenance?: string;
  citationIndexes: number[];
} {
  let working = rawHeading.trim();
  const citationIndexes: number[] = [];
  const citationMatch = working.match(TRAILING_CITATIONS);
  if (citationMatch) {
    let m: RegExpExecArray | null;
    SINGLE_CITATION.lastIndex = 0;
    while ((m = SINGLE_CITATION.exec(citationMatch[0])) !== null) {
      citationIndexes.push(Number(m[1]));
    }
    working = working.slice(0, working.length - citationMatch[0].length).trim();
  }

  let provenance: string | undefined;
  const provMatch = working.match(PROVENANCE_SUFFIX);
  if (provMatch) {
    provenance = provMatch[1];
    working = working.slice(0, working.length - provMatch[0].length).trim();
  }

  const dashIndex = working.indexOf(' — ');
  const rawTitle = (dashIndex >= 0 ? working.slice(0, dashIndex) : working).replace(/:$/, '').trim();
  const rest = dashIndex >= 0 ? working.slice(dashIndex + 3).trim() : '';

  if (SUMMARY_TITLE.test(rawTitle)) {
    return {
      kind: 'summary',
      title: rawTitle,
      pills: rest ? splitSemicolonsOutsideParens(rest) : [],
      provenance,
      citationIndexes,
    };
  }

  if (SOURCES_TITLE.test(rawTitle)) {
    return {
      kind: 'sources',
      title: rawTitle,
      subtitle: rest || undefined,
      pills: [],
      provenance,
      citationIndexes,
    };
  }

  if (CAVEAT_TITLE.test(rawTitle)) {
    return {
      kind: 'caveat',
      title: rawTitle,
      subtitle: rest || undefined,
      pills: [],
      provenance,
      citationIndexes,
    };
  }

  return {
    kind: 'section',
    title: rawTitle,
    subtitle: rest || undefined,
    pills: [],
    provenance,
    citationIndexes,
  };
}

/**
 * Parses an assistant clinical summary or revascularization evidence answer into
 * structured UI cards when a Summary / Synthesis block is present; returns null
 * for ordinary conversational or table-only Markdown messages.
 */
export function parseStructuredAnswer(text: string | undefined | null): StructuredAnswer | null {
  const trimmed = text?.trim();
  if (!trimmed) {
    return null;
  }

  const rawBlocks = trimmed
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean);

  let eyebrow: string | undefined;
  const leadBlocks: string[] = [];
  const cards: ParsedAnswerCard[] = [];
  const footerBlocks: string[] = [];
  let seenSummary = false;

  for (const block of rawBlocks) {
    const newline = block.indexOf('\n');
    const firstLine = (newline >= 0 ? block.slice(0, newline) : block).trim();
    const body = newline >= 0 ? block.slice(newline + 1).trim() : '';
    const boldMatch = firstLine.match(BOLD_LINE);

    if (boldMatch && !body && !seenSummary && cards.length === 0 && !eyebrow) {
      const candidate = boldMatch[1].trim();
      if (!SUMMARY_TITLE.test(candidate)) {
        eyebrow = candidate;
        continue;
      }
    }

    if (boldMatch && body) {
      const heading = parseHeading(boldMatch[1]);
      if (heading.kind === 'summary') {
        seenSummary = true;
      }
      cards.push({ ...heading, body });
      continue;
    }

    if (cards.length === 0) {
      leadBlocks.push(block);
    } else {
      footerBlocks.push(block);
    }
  }

  if (!seenSummary || cards.length === 0) {
    return null;
  }

  return { eyebrow, leadBlocks, cards, footerBlocks };
}
