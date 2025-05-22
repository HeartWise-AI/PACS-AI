// Orchestrator API DTO definitions

// Request DTOs
export interface CreateThreadRequest {
  // Empty object as per backend implementation
}

export interface GetThreadRequest {
  threadId: string;
}

export interface CreateMessageRequest {
  threadId: string;
  message: string;
  metadata?: Record<string, any>;
}

export interface UploadDicomPayloadRequest {
  threadId: string;
  studyInstanceUID: string;
  seriesInstanceUIDs: string[];
  additionalMetadata?: Record<string, any>;
  containerID?: string;
}

// Response DTOs
export interface ThreadResponse {
  thread_id: string;
  created_at?: string;
  metadata?: Record<string, any>;
}

export interface MessageResponse {
  // Fields from the root of the response
  thread_id: string;
  message_id?: string;
  content?: string;     // The user message content
  response?: string;    // The assistant's response text
  response_id?: string;
  status?: string;
  error?: string;
  metadata?: Record<string, any>;
  created_at?: string;
  completed_at?: string;

  // Nested message object
  message?: {
    role?: string;
    content?: string;
    createdAt?: string;
    tool_results?: Array<{
      tool_name: string;
      result: any;
    }>;
  };
}

export interface DicomPayloadResponse {
  thread_id: string;
  status?: string;
  message?: string;
  success?: boolean;
}
