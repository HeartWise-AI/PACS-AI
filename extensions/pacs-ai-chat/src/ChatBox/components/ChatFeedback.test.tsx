import React from 'react';
import { act, fireEvent, render, renderHook } from '@testing-library/react';
import orchestratorRepository from '@pacs-ai/extension-core/src/api/orchestratorRepository';
import { MessageBubble } from './MessageBubble';
import { useChatFeedback } from '../hooks/useChatFeedback';
import type { Message } from '../types';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en-US' } }),
}));
jest.mock('@pacs-ai/extension-core/src/api/orchestratorRepository', () => ({
  __esModule: true,
  default: { SubmitChatFeedback: jest.fn(), RemoveChatFeedback: jest.fn() },
}));

const submit = orchestratorRepository.SubmitChatFeedback as jest.Mock;
const remove = orchestratorRepository.RemoveChatFeedback as jest.Mock;

const answer: Message = {
  id: 'local-1',
  backendMessageId: 'answer-uuid',
  sender: 'assistant',
  text: 'LAD 70 %',
  timestamp: new Date('2026-11-26T12:00:00Z'),
};

describe('useChatFeedback', () => {
  beforeEach(() => {
    submit.mockReset().mockResolvedValue({ success: true });
    remove.mockReset().mockResolvedValue({ success: true });
  });

  it('saves a thumbs down against the stored answer id, then its reason, then removes it', async () => {
    const { result } = renderHook(() => useChatFeedback('thread-1'));
    await act(() => result.current.toggle(answer, 'down'));
    expect(submit).toHaveBeenCalledWith({
      threadId: 'thread-1',
      messageId: 'answer-uuid',
      vote: 'down',
      category: 'other',
    });
    expect(result.current.feedback['local-1']).toMatchObject({ vote: 'down', status: 'saved' });

    await act(() => result.current.saveDetails(answer, 'unsupported_claim', '  no source  '));
    expect(submit).toHaveBeenLastCalledWith({
      threadId: 'thread-1',
      messageId: 'answer-uuid',
      vote: 'down',
      category: 'unsupported_claim',
      comment: 'no source',
    });
    expect(result.current.feedback['local-1']).toMatchObject({ detailsSaved: true });

    await act(() => result.current.toggle(answer, 'down'));
    expect(remove).toHaveBeenCalledWith({ threadId: 'thread-1', messageId: 'answer-uuid' });
    expect(result.current.feedback['local-1'].vote).toBeNull();
  });

  it('restores the previous thumb when saving fails', async () => {
    submit.mockRejectedValue(new Error('down'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result } = renderHook(() => useChatFeedback('thread-1'));
    await act(() => result.current.toggle(answer, 'up'));
    expect(result.current.feedback['local-1']).toMatchObject({ vote: null, status: 'error' });
  });

  it('keeps the thumb locally when the answer has no stored id', async () => {
    const { result } = renderHook(() => useChatFeedback('thread-1'));
    await act(() => result.current.toggle({ ...answer, backendMessageId: undefined }, 'up'));
    expect(submit).not.toHaveBeenCalled();
    expect(result.current.feedback['local-1'].vote).toBe('up');
  });
});

describe('MessageBubble thumbs', () => {
  it('asks for a reason after a saved thumbs down and sends it', () => {
    const onFeedback = jest.fn();
    const onDetails = jest.fn();
    const { getByLabelText, getByRole } = render(
      <MessageBubble
        message={answer}
        feedback={{ vote: 'down', status: 'saved', category: 'other' }}
        onFeedback={onFeedback}
        onFeedbackDetails={onDetails}
      />
    );
    expect(getByLabelText('FeedbackThumbsDown').getAttribute('aria-pressed')).toBe('true');
    fireEvent.change(getByRole('combobox'), { target: { value: 'wrong_recommendation' } });
    fireEvent.change(getByLabelText('FeedbackCommentPlaceholder'), {
      target: { value: 'Not per guideline' },
    });
    fireEvent.click(getByRole('button', { name: 'FeedbackSend' }));
    expect(onDetails).toHaveBeenCalledWith(answer, 'wrong_recommendation', 'Not per guideline');
    fireEvent.click(getByLabelText('FeedbackThumbsUp'));
    expect(onFeedback).toHaveBeenCalledWith(answer, 'up');
  });
});
