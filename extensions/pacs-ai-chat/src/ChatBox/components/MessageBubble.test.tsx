import React from 'react';
import { render } from '@testing-library/react';
import { MessageBubble } from './MessageBubble';
import type { Message } from '../types';

const renderAssistantMessage = (text: string, citations = undefined as Message['citations']) => {
  const message: Message = {
    id: 'assistant-message',
    sender: 'assistant',
    text,
    timestamp: new Date('2026-11-13T12:00:00Z'),
    ...(citations ? { citations } : {}),
  };

  return render(<MessageBubble message={message} />);
};

describe('MessageBubble Markdown rendering', () => {
  it('renders structured model results as a level-four heading and GFM table', () => {
    const { container } = renderAssistantMessage(`#### Vessel findings

| Vessel | Stenosis | Stenosis % | CTO | Thrombus | Calcification |
| --- | --- | --- | --- | --- | --- |
| Left Main Branch | blocked | 48.88% | normal | normal | normal |`);

    expect(container.querySelector('h4')?.textContent).toBe('Vessel findings');

    const table = container.querySelector('table');
    expect(table).not.toBeNull();
    expect(table?.parentElement?.classList.contains('markdown-table-wrapper')).toBe(true);
    expect(table?.parentElement?.getAttribute('tabindex')).toBe('0');
    expect(table?.querySelectorAll('th')).toHaveLength(6);
    expect(table?.querySelectorAll('td')).toHaveLength(6);
    expect(table?.textContent).toContain('Left Main Branch');
    expect(container.textContent).not.toContain('$1');
  });

  it('preserves existing Markdown formatting', () => {
    const { container } = renderAssistantMessage(
      '# Result\n\n**Important**\n\n- First\n- Second\n\n[Details](https://example.com)'
    );

    expect(container.querySelector('h1')?.textContent).toBe('Result');
    expect(container.querySelector('strong')?.textContent).toBe('Important');
    expect(container.querySelectorAll('li')).toHaveLength(2);
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://example.com');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('does not inject raw HTML from message content', () => {
    const { container } = renderAssistantMessage('<img src=x onerror="alert(1)">');

    expect(container.querySelector('img')).toBeNull();
  });

  it('does not load images from Markdown URLs', () => {
    const { container } = renderAssistantMessage(
      '![External result](https://untrusted.example/result.png)'
    );

    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('[Image: External result]');
  });

  it('renders Synthesis / Summary answers in a dedicated summary card separate from model cards', () => {
    const answer = [
      '**What the evidence suggests for these findings**',
      [
        '**Synthesis — 3 vessels with significant disease; 3 CTO (Proximal LCx (LCx); Mid LCx (LCx); Mid RCA (RCA)); SYNTAX 23.7 (Intermediate (23-32)); LVEF 55% (preserved) (AI estimates) [1][3]**',
        '- SYNTAX trial notes CABG has been considered standard of care in three-vessel disease [5].',
        '- Intermediate 23.7 does not settle it alone; guidelines give Heart Team Class IC [5].',
      ].join('\n'),
      [
        '**DeepCORO-JEPA — stenoses and physiology — LAD: Proximal LAD 70% (severe) (AI estimates) [1]**',
        '- FREEDOM compared CABG with PCI in diabetic patients with multivessel stenosis [5].',
      ].join('\n'),
      [
        '**DeepCORO-CTO — Proximal LCx, Mid LCx (LCx); Mid RCA (RCA); J-CTO 1 (RCA), intermediate (AI estimates) [1][2]**',
        '- Guidelines recommend CTO-PCI in selected symptomatic patients with ischemia [6].',
      ].join('\n'),
      [
        '**What cannot be decided from this data**',
        '- Multiple or discordant CTO flags (Proximal LCx 89%, Mid LCx 23% (LCx)).',
      ].join('\n'),
      'These are published options, not a recommendation.',
      [
        '**Sources**',
        '5. [2021 ACC/AHA/SCAI Guideline](https://www.ahajournals.org/doi/10.1161/CIR.0000000000001038)',
        '6. [Chronic Total Occlusions](https://pubmed.ncbi.nlm.nih.gov/40649068/)',
      ].join('\n'),
    ].join('\n\n');

    const { container } = renderAssistantMessage(answer, [
      { index: 1, kind: 'model_result', modelName: 'DeepCORO-JEPA' },
      { index: 2, kind: 'model_result', modelName: 'DeepCORO-CTO' },
      { index: 3, kind: 'model_result', modelName: 'DeepCORO-SYNTAX' },
      { index: 5, kind: 'web_source', title: '2021 ACC/AHA/SCAI Guideline', url: 'https://www.ahajournals.org/doi/10.1161/CIR.0000000000001038' },
      { index: 6, kind: 'web_source', title: 'Chronic Total Occlusions', url: 'https://pubmed.ncbi.nlm.nih.gov/40649068/' },
    ]);

    const summaryCard = container.querySelector('[data-cy="chat-summary-card"]');
    expect(summaryCard).not.toBeNull();
    expect(summaryCard?.querySelector('[data-cy="chat-summary-badge"]')?.textContent).toBe('Synthesis');
    const pills = Array.from(summaryCard?.querySelectorAll('.chat-summary-pill') || []).map(el => el.textContent);
    expect(pills).toEqual([
      '3 vessels with significant disease',
      '3 CTO (Proximal LCx (LCx); Mid LCx (LCx); Mid RCA (RCA))',
      'SYNTAX 23.7 (Intermediate (23-32))',
      'LVEF 55% (preserved)',
    ]);
    expect(summaryCard?.querySelectorAll('[data-cy="chat-citation-chip"]').length).toBeGreaterThanOrEqual(3);

    const sectionCards = container.querySelectorAll('[data-cy="chat-section-card"]');
    expect(sectionCards).toHaveLength(2);
    expect(sectionCards[0].querySelector('.chat-section-title')?.textContent).toBe('DeepCORO-JEPA');
    expect(sectionCards[1].querySelector('.chat-section-title')?.textContent).toBe('DeepCORO-CTO');

    expect(container.querySelector('[data-cy="chat-caveats-card"]')).not.toBeNull();
    expect(container.querySelector('[data-cy="chat-sources-card"]')).not.toBeNull();
    expect(container.querySelector('.chat-answer-footer')?.textContent).toContain(
      'These are published options, not a recommendation.'
    );
  });

  it('numbers each source of the Sources card as the text cites it, not by list position', () => {
    // An ordered list numbers from its first item: "5., 6., 10." showed as 5, 6, 7.
    const answer = [
      '**Synthesis — 2 vessels with significant disease (AI estimates) [1]**\n- Guidelines weigh PCI and CABG [5][10].',
      [
        '**Sources**',
        '5. [Myocardial revascularization guideline](https://example.org/multivessel) — Eur Heart J, 2024',
        '6. [Uncited page](https://example.org/uncited)',
        '10. [CTO PCI consensus](https://example.org/cto)',
        'Retrieved for this answer only.',
      ].join('\n'),
    ].join('\n\n');

    const { container } = renderAssistantMessage(answer, [
      { index: 1, kind: 'model_result', modelName: 'DeepCORO-JEPA' },
      {
        index: 5,
        kind: 'web_source',
        title: 'Myocardial revascularization guideline',
        url: 'https://example.org/multivessel',
      },
      { index: 10, kind: 'web_source', title: 'CTO PCI consensus', url: 'https://example.org/cto' },
    ]);

    const sources = container.querySelector('[data-cy="chat-sources-card"]');
    expect(sources?.querySelector('ol')).toBeNull();
    const lines = Array.from(sources?.querySelectorAll('[data-cy="chat-source-line"]') || []);
    expect(
      lines.map(line => line.querySelector('[data-cy="chat-citation-chip"]')?.textContent ?? null)
    ).toEqual(['5', null, '10']);
    expect(lines[1].textContent).toBe('6.Uncited page');
    expect(lines[2].querySelector('a')?.getAttribute('href')).toBe('https://example.org/cto');
    expect(lines[0].textContent).toContain('Eur Heart J, 2024');
    expect(sources?.textContent).toContain('Retrieved for this answer only.');
  });

  it('takes only plausible source numbers as sources, in "n." or "n)" style', () => {
    const answer = [
      '**Summary**\n- Guidelines weigh PCI and CABG [1][2].',
      [
        '**Sources**',
        '1) [Myocardial revascularization guideline](https://example.org/multivessel)',
        '2) [CTO PCI consensus](https://example.org/cto)',
        '2024. Focused update, not a numbered source.',
        '9. A ninth item of a list of three, without a citation.',
      ].join('\n'),
    ].join('\n\n');

    const { container } = renderAssistantMessage(answer, [
      {
        index: 1,
        kind: 'web_source',
        title: 'Myocardial revascularization guideline',
        url: 'https://example.org/multivessel',
      },
      { index: 2, kind: 'web_source', title: 'CTO PCI consensus', url: 'https://example.org/cto' },
    ]);

    const sources = container.querySelector('[data-cy="chat-sources-card"]');
    const lines = Array.from(sources?.querySelectorAll('[data-cy="chat-source-line"]') || []);
    expect(
      lines.map(line => line.querySelector('[data-cy="chat-citation-chip"]')?.textContent)
    ).toEqual(['1', '2']);
    expect(sources?.textContent).toContain('2024. Focused update, not a numbered source.');
    expect(sources?.textContent).toContain('A ninth item of a list of three');
  });

  it('styles the chips of the Sources card by kind, with a key when both kinds are cited', () => {
    const answer = [
      '**Summary — 2 vessels (AI estimates) [1]**\n- Guidelines weigh PCI and CABG [2].',
      '**Sources**\n2. [Myocardial revascularization guideline](https://example.org/multivessel)',
    ].join('\n\n');

    const { container } = renderAssistantMessage(answer, [
      { index: 1, kind: 'model_result', modelName: 'DeepCORO-JEPA' },
      {
        index: 2,
        kind: 'web_source',
        title: 'Myocardial revascularization guideline',
        url: 'https://example.org/multivessel',
      },
    ]);

    const sources = container.querySelector('[data-cy="chat-sources-card"]');
    const chip = sources?.querySelector('[data-cy="chat-citation-chip"]');
    expect(chip?.classList.contains('chat-citation-chip-source')).toBe(true);
    const key = sources?.querySelector('[data-cy="chat-citation-key"]');
    expect(key?.textContent).toBe('AI model resultPublished source');
    expect(key?.querySelector('.chat-citation-key-model')).not.toBeNull();
    expect(key?.querySelector('.chat-citation-key-source')).not.toBeNull();
  });

  it('shows no key in a Sources card when the answer cites one kind only', () => {
    const answer = [
      '**Summary**\n- Guidelines weigh PCI and CABG [1].',
      '**Sources**\n1. [Guideline](https://example.org/g)',
    ].join('\n\n');

    const { container } = renderAssistantMessage(answer, [
      { index: 1, kind: 'web_source', title: 'Guideline', url: 'https://example.org/g' },
    ]);

    expect(container.querySelector('[data-cy="chat-citation-key"]')).toBeNull();
  });

  it('renders findings_summary lead Summary section in its own summary card', () => {
    const summaryText = [
      '**Summary**\n- Proximal LAD 70% severe with LCx and RCA CTO flags; SYNTAX 23.7, LVEF 55% [1][2]',
      '**Coronary findings**\n- LAD: proximal LAD 70% severe [1]',
      '**Limitations that apply here**\n- Estimates do not replace invasive measurement.',
      '_AI model estimates for clinician review._',
    ].join('\n\n');

    const { container } = renderAssistantMessage(summaryText, [
      { index: 1, kind: 'model_result', modelName: 'DeepCORO-JEPA' },
      { index: 2, kind: 'model_result', modelName: 'DeepCORO-SYNTAX' },
    ]);

    expect(container.querySelector('[data-cy="chat-summary-badge"]')?.textContent).toBe('Summary');
    expect(container.querySelectorAll('[data-cy="chat-section-card"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-cy="chat-caveats-card"]')).toHaveLength(1);
  });
});
