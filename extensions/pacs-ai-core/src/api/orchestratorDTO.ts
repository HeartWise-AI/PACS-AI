// Orchestrator API DTO definitions

// Request DTOs
export interface CreateThreadRequest {
  metadata?: Record<string, any>;
}

export interface GetThreadRequest {
  threadId: string;
}

export interface CreateMessageRequest {
  threadId: string;
  message: string;
  metadata?: Record<string, any>;
}

// StudyData structure matching Python API
export interface StudyData {
  studyInstanceUID: string;
  additionalMetadata?: Record<string, any>;
  seriesInstanceUIDs?: string[];
  modality?: string;
  previewImageBase64?: string;
}

export interface UploadDicomPayloadRequest {
  threadId: string;
  payload: StudyData[];
}

// Convenience interface for backwards compatibility
export interface UploadDicomPayloadRequestFlat {
  threadId: string;
  studyInstanceUID: string;
  seriesInstanceUIDs: string[];
  additionalMetadata?: Record<string, any>;
  containerID?: string;
}

// Response DTOs matching Go API responses
export interface CreateThreadResponse {
  thread_id: string;
}

export interface ToolResultResponse {
  tool_name: string;
  result: any;
}

// One tool call or delegation of a chat request, as reported by the chat service.
// Labels are built server-side from safe data only (tool + validated model name).
export interface ChatActivityStepResponse {
  id: number;
  key: string;
  kind?: 'tool' | 'delegation' | string;
  label: string;
  model?: string | null;
  status: 'running' | 'done' | 'failed' | string;
  started_at?: string;
  ended_at?: string | null;
  duration_ms?: number | null;
}

export interface ChatActivityResponse {
  status?: 'idle' | 'running' | 'done' | 'failed' | string;
  started_at?: string | null;
  ended_at?: string | null;
  elapsed_ms?: number;
  steps: ChatActivityStepResponse[];
}

export interface GetChatProgressRequest {
  threadId: string;
}

// Chat history per study: the signed-in user's own threads about the open study.
export interface ListChatThreadsRequest {
  studyInstanceUID: string;
  limit?: number;
}

export interface ChatThreadSummary {
  thread_id: string;
  title: string;
  created_at?: string | null;
  updated_at?: string | null;
  // Naive local time of the chat service (same zone as the viewer at MHI).
  last_message_at?: string | null;
  message_count: number;
}

export interface ListChatThreadsResponse {
  threads: ChatThreadSummary[];
}

export interface ChatHistoryMessage {
  message_id: string;
  role: 'user' | 'assistant';
  // Text as stored, cardio-card blocks included.
  content: string;
  created_at?: string | null;
  citations?: any[] | null;
}

export interface ChatHistoryVote {
  message_id: string;
  vote: 'up' | 'down';
  category: string;
  has_comment: boolean;
}

export interface ChatThreadHistory {
  thread_id: string;
  title: string;
  study_instance_uid?: string | null;
  messages: ChatHistoryMessage[];
  feedback: ChatHistoryVote[];
}

export interface ChatProgressResponse extends ChatActivityResponse {
  thread_id: string;
  active: boolean;
}

// Thrown by GetChatProgress: the HTTP status tells "not supported by this
// backend" (404/405) apart from a transient failure.
export interface ChatProgressError {
  status?: number;
  errorCode?: string;
  message?: string;
}

export interface MessageResponse {
  // Main response fields from Go API
  thread_id: string;
  message?: {
    role: string;
    content: string;
    tool_results?: ToolResultResponse[];
    createdAt?: string;
    // Answer language from the chat backend; absent with an older one.
    metadata?: { response_language?: string; response_language_source?: string };
  };
  status: string;
  error?: string;
  // What the assistant used to answer; absent with an older backend.
  activity?: ChatActivityResponse | null;

  // Stored id of the answer in the chat backend; chat feedback targets it.
  assistant_message_id?: string;

  // Legacy fields for backward compatibility
  message_id?: string;
  content?: string;
  response?: string;
  response_id?: string;
  metadata?: Record<string, any>;
  created_at?: string;
  completed_at?: string;
}

export interface ThreadMessage {
  id: string;
  content: string;
  role: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface GetThreadResponse {
  id: string;
  thread_id: string;
  messages: ThreadMessage[];
  metadata?: Record<string, any>;
  has_dicom_payload: boolean;
  status?: string;
  error?: string;
  created_at: string;
  updated_at: string;
}

export interface DicomPayloadResponse {
  thread_id: string;
  status: string;
  message: string;
  success: boolean;
}

// For backward compatibility
export interface ThreadResponse {
  thread_id: string;
  created_at?: string;
  metadata?: Record<string, any>;
}

// Chat answer feedback (PACS-448)
export type ChatFeedbackVote = 'up' | 'down';

/** Reasons the chat backend accepts for each vote (medical-agent CATEGORIES). */
export const CHAT_FEEDBACK_CATEGORIES: Record<ChatFeedbackVote, readonly string[]> = {
  up: ['accurate', 'helpful_recommendation', 'good_evidence', 'other'],
  down: [
    'wrong_value_or_measurement',
    'wrong_patient_or_study',
    'unsupported_claim',
    'missing_detail',
    'wrong_recommendation',
    'tool_failed_or_wrong_tool',
    'too_slow',
    'formatting_or_language',
    'privacy_concern',
    'other',
  ],
};

export interface SubmitChatFeedbackRequest {
  threadId: string;
  // The stored id of the answer (MessageResponse.assistant_message_id).
  messageId: string;
  vote: ChatFeedbackVote;
  category: string;
  comment?: string;
}

export interface ChatFeedbackSaved {
  ok: boolean;
  feedback_id: string;
  message_id: string;
  vote: ChatFeedbackVote;
  category: string;
  submission_version: number;
}

export interface RemoveChatFeedbackRequest {
  threadId: string;
  messageId: string;
}

export interface ListChatFeedbackRequest {
  rating?: ChatFeedbackVote;
  category?: string;
  study?: string;
  // YYYY-MM-DD, both inclusive; `days` counts back from today when no `from`.
  from?: string;
  to?: string;
  days?: number;
  limit?: number;
  offset?: number;
}

export interface ChatFeedbackItem {
  feedback_id: string;
  conversation_id: string;
  message_id: string;
  user_id: string;
  // From the workspace's user directory (api-pacs), when the voter is found.
  user_name?: string | null;
  user_email?: string | null;
  vote: ChatFeedbackVote;
  category: string;
  comment: string | null;
  // A comment was submitted (even when this server cannot open it).
  has_comment?: boolean;
  client: string | null;
  submission_version: number;
  created_at: string | null;
  updated_at: string | null;
  question: string;
  answer: string;
  question_at?: string | null;
  answer_at?: string | null;
  study_instance_uid: string | null;
  tenant_id: string | null;
  model: string | null;
  skill: string | null;
  harness_version: string | null;
  git_sha: string | null;
  app_version: string | null;
  origin: string | null;
  specialists: string[];
  tool_count: number;
  // "error" or "timeout" when the rated answer is the message of a failed turn,
  // with the (redacted) error the chat recorded. Absent with an older backend.
  turn_status?: string | null;
  turn_error?: string | null;
  // Sealed with a key this server does not hold: listed without content.
  sealed_elsewhere: boolean;
}

/**
 * One tool call behind a rated answer, redacted by the chat backend (no DICOM
 * UID or patient field). Fields an old turn did not record are null.
 */
export interface ChatFeedbackToolCall {
  seq: number;
  parent_seq: number | null;
  depth: number;
  agent: string | null;
  specialist: string | null;
  tool: string;
  origin: string | null;
  status: 'ok' | 'error' | 'incomplete' | string | null;
  duration_ms: number | null;
  offset_ms: number | null;
  model: string | null;
  args_summary: string;
  run_selection: string | null;
  input: string | null;
  result_summary: string | null;
  error: string | null;
  result_truncated: boolean;
  arguments: Record<string, unknown>;
}

/** GET /v1/inference/chat/feedback/{id}: one vote with its tool calls (null: trace not available). */
export interface ChatFeedbackDetail extends ChatFeedbackItem {
  tool_calls: ChatFeedbackToolCall[] | null;
}

export interface ChatFeedbackToolStats {
  calls: number;
  errors: number;
  error_rate: number | null;
  median_ms: number | null;
  timed_calls: number;
}

export interface ChatFeedbackToolUsage {
  totals: Record<
    ChatFeedbackVote,
    ChatFeedbackToolStats & { turns: number; turns_with_trace: number }
  >;
  by_tool: Array<{ tool: string } & Record<ChatFeedbackVote, ChatFeedbackToolStats>>;
}

export interface ListChatFeedbackResponse {
  total: number;
  limit: number;
  offset: number;
  items: ChatFeedbackItem[];
  // The chat backend stopped reading at its scan cap: counts may be partial.
  truncated?: boolean;
}

export interface ChatFeedbackUpDown {
  up: number;
  down: number;
}

export interface ChatFeedbackCountsResponse {
  range: { since: string | null; until: string | null };
  truncated?: boolean;
  totals: ChatFeedbackUpDown & { with_comment: number; total: number };
  by_day: Array<ChatFeedbackUpDown & { date: string }>;
  by_week: Array<ChatFeedbackUpDown & { week_start: string }>;
  by_category: Array<{ vote: ChatFeedbackVote; category: string; count: number }>;
  by_specialist: Array<ChatFeedbackUpDown & { specialist: string }>;
  by_skill: Array<ChatFeedbackUpDown & { skill: string }>;
  by_harness_version: Array<ChatFeedbackUpDown & { harness_version: string }>;
  // Absent from an older chat backend.
  tool_usage?: ChatFeedbackToolUsage;
}

/** GET /v1/orchestrator/settings: the chat backend's default answer language. */
export interface ChatSettingsResponse {
  chat_default_language: 'fr' | 'en' | null;
}
