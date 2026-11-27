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

  it('uses the thread kept on the answer after the chat box was remounted', async () => {
    const { result } = renderHook(() => useChatFeedback(null));
    await act(() => result.current.toggle({ ...answer, backendThreadId: 'thread-old' }, 'up'));
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ threadId: 'thread-old', messageId: 'answer-uuid' })
    );
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

describe('MessageBubble on a failed answer', () => {
  it('offers "Try again" and no thumbs for an error nothing was stored for', () => {
    const onRetry = jest.fn();
    const onFeedback = jest.fn();
    const { getByText, queryByLabelText } = render(
      <MessageBubble
        message={{
          id: 'err-1',
          sender: 'assistant',
          text: 'The previous answer in this chat is still being written. Wait for it, or start a new chat.',
          timestamp: new Date('2026-11-27T12:00:00Z'),
          status: 'error',
          retryText: 'Summarize all findings',
        }}
        onFeedback={onFeedback}
        onRetryMessage={onRetry}
      />
    );
    expect(queryByLabelText('FeedbackThumbsDown')).toBeNull();
    fireEvent.click(getByText('RetryQuestion'));
    expect(onRetry).toHaveBeenCalledWith('Summarize all findings');
  });

  it('keeps the thumbs on a stored error answer so the vote is saved', () => {
    const onFeedback = jest.fn();
    const stored: Message = {
      id: 'err-2',
      backendMessageId: 'answer-err',
      sender: 'assistant',
      text: 'This answer could not be completed because of a server error.',
      timestamp: new Date('2026-11-27T12:00:00Z'),
      status: 'error',
      retryText: 'q',
    };
    const { getByLabelText, getByText } = render(
      <MessageBubble
        message={stored}
        onFeedback={onFeedback}
        onRetryMessage={jest.fn()}
      />
    );
    fireEvent.click(getByLabelText('FeedbackThumbsDown'));
    expect(onFeedback).toHaveBeenCalledWith(stored, 'down');
    expect(getByText('RetryQuestion')).toBeTruthy();
  });
});
