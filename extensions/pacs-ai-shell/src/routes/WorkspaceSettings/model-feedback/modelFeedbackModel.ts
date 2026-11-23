import type {
  ModelFeedbackListItem,
  ModelFeedbackSummaryEntry,
} from '@pacs-ai/extension-core/src/api/inferenceDTO';
import { csvSafeCell } from '../../AiPredictions/csvExport';

export type FeedbackVoteFilter = '' | 'APPROVE' | 'REJECT';

export interface ModelFeedbackItemFilter {
  feedbackType: FeedbackVoteFilter;
  userSearch: string;
}

interface ModelNameSource {
  modelId?: string | null;
  modelName?: string | null;
}

/** The model's display name from the available models, else its id. */
export function modelLabel(inferenceModelId: string, availableModels: ModelNameSource[]): string {
  const id = inferenceModelId?.trim() ?? '';
  const match = (availableModels ?? []).find(model => model.modelId?.trim() === id);
  return match?.modelName?.trim() || id;
}

/** Share of approvals among the votes, from 0 to 1; null when there are no votes. */
export function approvalRatio(
  entry: Pick<ModelFeedbackSummaryEntry, 'approveCount' | 'rejectCount'>
): number | null {
  const approve = Math.max(0, entry.approveCount || 0);
  const total = approve + Math.max(0, entry.rejectCount || 0);
  return total > 0 ? approve / total : null;
}

/** The user shown for a vote: name, else email, else id. */
export function feedbackUserLabel(
  item: Pick<ModelFeedbackListItem, 'userName' | 'userEmail' | 'userId'>
): string {
  return item.userName?.trim() || item.userEmail?.trim() || item.userId;
}

export function filterFeedbackItems(
  items: ModelFeedbackListItem[],
  { feedbackType, userSearch }: ModelFeedbackItemFilter
): ModelFeedbackListItem[] {
  const search = userSearch.trim().toLowerCase();
  return items.filter(item => {
    if (feedbackType && item.feedbackType?.toUpperCase() !== feedbackType) {
      return false;
    }
    if (!search) {
      return true;
    }
    return [item.userName, item.userEmail, item.userId].some(value =>
      value?.toLowerCase().includes(search)
    );
  });
}

/** One answer as "question: answer | answer"; answers joined with "; ". */
export function formatFeedbackAnswers(answers: ModelFeedbackListItem['answers']): string {
  return (answers ?? [])
    .map(answer => {
      const values = (answer.questionnaireAnswers ?? []).filter(Boolean).join(' | ');
      return `${answer.questionnaireQuestion}: ${values}`;
    })
    .join('; ');
}

/** Unix seconds as an ISO timestamp; empty when absent. */
export function isoFromUnixSeconds(seconds: number | null | undefined): string {
  return seconds ? new Date(seconds * 1000).toISOString() : '';
}

/**
 * A date input value (YYYY-MM-DD, local time) as an RFC3339 bound: the start
 * of the day, or its last millisecond for the end of a range. Empty or
 * invalid input gives undefined (no bound).
 */
export function dateInputToRFC3339(value: string, endOfDay = false): string | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) {
    return undefined;
  }
  const [, year, month, day] = match.map(Number);
  const date = endOfDay
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export interface FeedbackCSVLabels {
  headers: {
    updatedAt: string;
    createdAt: string;
    model: string;
    modelId: string;
    version: string;
    vote: string;
    reason: string;
    userName: string;
    userEmail: string;
    userId: string;
    runId: string;
    executionId: string;
    studyServiceJobId: string;
    answers: string;
  };
  vote: (feedbackType: string) => string;
  model: (inferenceModelId: string) => string;
  // The rejection reason shown for a vote; empty for approvals.
  reason: (item: ModelFeedbackListItem) => string;
}

/** CSV rows (header first) with every cell safe from formula injection. */
export function feedbackCSVRows(
  items: ModelFeedbackListItem[],
  labels: FeedbackCSVLabels
): string[][] {
  const { headers } = labels;
  const header = [
    headers.updatedAt,
    headers.createdAt,
    headers.model,
    headers.modelId,
    headers.version,
    headers.vote,
    headers.reason,
    headers.userName,
    headers.userEmail,
    headers.userId,
    headers.runId,
    headers.executionId,
    headers.studyServiceJobId,
    headers.answers,
  ];
  const rows = items.map(item => [
    isoFromUnixSeconds(item.updatedAt),
    isoFromUnixSeconds(item.createdAt),
    labels.model(item.inferenceModelId),
    item.modelId,
    item.modelVersion,
    labels.vote(item.feedbackType),
    labels.reason(item),
    item.userName ?? '',
    item.userEmail ?? '',
    item.userId,
    item.runId,
    item.executionId,
    item.studyServiceJobId,
    formatFeedbackAnswers(item.answers),
  ]);
  return [header, ...rows].map(row => row.map(cell => csvSafeCell(cell ?? '')));
}
