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
  };
  status: string;
  error?: string;
  // What the assistant used to answer; absent with an older backend.
  activity?: ChatActivityResponse | null;

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

// Feedback DTOs
export interface SubmitFeedbackRequest {
  threadId: string;
  messageId: string;
  feedback: 'up' | 'down';
}

export interface FeedbackResponse {
  success: boolean;
  message?: string;
}
