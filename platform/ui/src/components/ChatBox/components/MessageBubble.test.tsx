import React from 'react';
import { render } from '@testing-library/react';
import { MessageBubble } from './MessageBubble';
import type { Message } from '../types';

const renderAssistantMessage = (text: string) => {
  const message: Message = {
    id: 'assistant-message',
    sender: 'assistant',
    text,
    timestamp: new Date('2026-11-13T12:00:00Z'),
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
});
