import { historyToFeedback, historyToMessages, parseServerTime } from './chatHistory';

describe('chat history mapping', () => {
  it('reads naive service times as local time and never invents "now"', () => {
    const date = parseServerTime('2026-11-26T10:15:00');
    expect([date.getHours(), date.getMinutes()]).toEqual([10, 15]);
    expect(parseServerTime(null).getTime()).toBe(0);
    expect(parseServerTime('garbage').getTime()).toBe(0);
  });

  it('maps stored messages and keeps only usable ones', () => {
    const messages = historyToMessages({
      thread_id: 't',
      title: 'x',
      messages: [
        { message_id: 'q', role: 'user', content: 'Q' },
        { message_id: 'a', role: 'assistant', content: '  A  ', citations: [{ index: 1, kind: 'web_source' }] },
        { message_id: '', role: 'assistant', content: 'no id' },
      ],
      feedback: [],
    } as any);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ id: 'q', sender: 'user', text: 'Q' });
    expect(messages[0].backendMessageId).toBeUndefined();
    expect(messages[1]).toMatchObject({ id: 'a', sender: 'assistant', text: 'A', backendMessageId: 'a', backendThreadId: 't' });
  });

  it('asks again for the reason of a thumbs down saved without one', () => {
    const feedback = historyToFeedback({
      thread_id: 't',
      title: 'x',
      messages: [],
      feedback: [
        { message_id: 'a1', vote: 'down', category: 'other', has_comment: false },
        { message_id: 'a2', vote: 'down', category: 'unsupported_claim', has_comment: false },
        { message_id: 'a3', vote: 'up', category: 'other', has_comment: false },
        { message_id: 'a4', vote: 'maybe', category: 'other', has_comment: false },
      ],
    } as any);
    expect(feedback.a1).toMatchObject({ vote: 'down', status: 'saved', detailsSaved: false });
    expect(feedback.a2.detailsSaved).toBe(true);
    expect(feedback.a3).toMatchObject({ vote: 'up', detailsSaved: true });
    expect(feedback.a4).toBeUndefined();
  });
});
