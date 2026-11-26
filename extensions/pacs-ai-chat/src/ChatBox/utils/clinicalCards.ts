/**
 * Structured cards the chat backend appends to a management recommendation
 * and a dictation, as fenced blocks inside the answer:
 *
 *   ```cardio-card
 *   {"type":"management", ...}
 *   ```
 *
 * The Markdown answer stays complete without them; a block that cannot be
 * read is ignored and its part is shown as Markdown.
 */

export interface ClinicalMedication {
  drug: string;
  loading_dose?: string | null;
  maintenance?: string | null;
  duration?: string | null;
  notes?: string | null;
}

export interface ManagementCardData {
  type: 'management';
  summary: string[];
  strategy?: string[];
  medications?: ClinicalMedication[];
  alternatives?: string[];
  checks?: string[];
  follow_up?: string[];
}

export interface DictationCardData {
  type: 'dictation';
  title: string;
  sections: { label: string; body: string }[];
  footer?: string | null;
}

export type ClinicalCardData = ManagementCardData | DictationCardData;

export type ClinicalPart =
  | { kind: 'card'; card: ClinicalCardData; markdown: string }
  | { kind: 'markdown'; text: string };

const CARD_BLOCK = /\n*```cardio-card[ \t]*\n([\s\S]*?)\n```[ \t]*/g;
// merge_cited_answers joins the answers of one turn with this rule.
const PART_SEPARATOR = /\n{2,}---\n{2,}/;

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && !!item.trim()) : [];

export function readCard(raw: string): ClinicalCardData | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object') {
    return null;
  }
  const card = value as Record<string, unknown>;
  if (card.type === 'management') {
    const summary = strings(card.summary);
    if (summary.length === 0) {
      return null;
    }
    const medications = Array.isArray(card.medications)
      ? (card.medications as unknown[]).filter(
          (item): item is ClinicalMedication =>
            !!item && typeof item === 'object' && typeof (item as ClinicalMedication).drug === 'string'
        )
      : [];
    return {
      type: 'management',
      summary,
      strategy: strings(card.strategy),
      medications,
      alternatives: strings(card.alternatives),
      checks: strings(card.checks),
      follow_up: strings(card.follow_up),
    };
  }
  if (card.type === 'dictation' && Array.isArray(card.sections)) {
    const sections = (card.sections as unknown[]).filter(
      (item): item is { label: string; body: string } =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as { label: unknown }).label === 'string' &&
        typeof (item as { body: unknown }).body === 'string'
    );
    if (sections.length === 0) {
      return null;
    }
    return {
      type: 'dictation',
      title: typeof card.title === 'string' && card.title ? card.title : 'Dictation',
      sections,
      footer: typeof card.footer === 'string' ? card.footer : null,
    };
  }
  return null;
}

export function withoutCardBlocks(text: string): string {
  return text.replace(CARD_BLOCK, '').trimEnd();
}

/** The answer cut into its card parts and Markdown parts, or null when it has no card block. */
export function splitClinicalCards(text: string | undefined | null): ClinicalPart[] | null {
  if (!text || !text.includes('```cardio-card')) {
    return null;
  }
  const parts: ClinicalPart[] = [];
  for (const part of text.trim().split(PART_SEPARATOR)) {
    const blocks = [...part.matchAll(CARD_BLOCK)];
    const markdown = withoutCardBlocks(part).trim();
    const cards = blocks.map(block => readCard(block[1])).filter((card): card is ClinicalCardData => !!card);
    if (cards.length === 0) {
      if (markdown) {
        parts.push({ kind: 'markdown', text: markdown });
      }
      continue;
    }
    cards.forEach(card => parts.push({ kind: 'card', card, markdown }));
  }
  return parts.some(part => part.kind === 'card') ? parts : null;
}

/** "[n]" markers used anywhere in a card, in order of first use. */
export function cardCitationIndexes(card: ClinicalCardData): number[] {
  const texts =
    card.type === 'management'
      ? [
          ...card.summary,
          ...(card.strategy ?? []),
          ...(card.medications ?? []).flatMap(item => [
            item.drug,
            item.loading_dose ?? '',
            item.maintenance ?? '',
            item.duration ?? '',
            item.notes ?? '',
          ]),
          ...(card.alternatives ?? []),
          ...(card.checks ?? []),
          ...(card.follow_up ?? []),
        ]
      : card.sections.map(section => section.body);
  const seen: number[] = [];
  for (const text of texts) {
    for (const match of text.matchAll(/\[(\d{1,3})\]/g)) {
      const index = Number(match[1]);
      if (!seen.includes(index)) {
        seen.push(index);
      }
    }
  }
  return seen;
}

/** Plain text of a dictation for the clipboard. */
export function dictationText(card: DictationCardData): string {
  const lines = [card.title, ''];
  for (const section of card.sections) {
    lines.push(`${section.label}:${section.body.includes('\n') ? '\n' : ' '}${section.body}`, '');
  }
  if (card.footer) {
    lines.push(card.footer);
  }
  return lines.join('\n').trim();
}
