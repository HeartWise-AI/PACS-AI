// Interface to track series information
export interface SeriesInfo {
  SeriesInstanceUID: string;
  info: string;
  imageSrc?: string;
  seriesDescription?: string;
  seriesNumber?: string;
  modality?: string;
}

// One tool call or delegation the assistant made for a request. `label` is the
// backend's English label; `key` (+ `model`) selects a translated template.
export interface ChatActivityStep {
  id: number;
  key: string;
  kind?: string;
  label: string;
  model?: string | null;
  status: 'running' | 'done' | 'failed' | string;
  started_at?: string;
  ended_at?: string | null;
  duration_ms?: number | null;
}

// What the assistant used for one request: live while thinking, final on the answer.
export interface ChatActivity {
  status?: string;
  started_at?: string | null;
  ended_at?: string | null;
  elapsed_ms?: number;
  steps: ChatActivityStep[];
}

// What a numeric marker "[index]" of an answer refers to (chat backend
// contract, "Citations"): a stored AI model result...
export interface ChatModelResultCitation {
  index: number;
  kind: 'model_result';
  modelName: string;
  modelVersion?: string | null;
  completedAt?: string | null;
  studyInstanceUID?: string | null;
  // The study-service job that produced the result.
  studyServiceJobId?: string | null;
  title?: string | null;
  // One line of what the result contributed to the answer.
  summary?: string | null;
  outputMode?: string | null;
}

// ...or a published source.
export interface ChatWebSourceCitation {
  index: number;
  kind: 'web_source';
  title?: string | null;
  url?: string | null;
}

export type ChatCitation = ChatModelResultCitation | ChatWebSourceCitation;

// Chat message type
export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  isThinking?: boolean;
  status?: 'sending' | 'sent' | 'error';
  // Completed steps of the request that produced this assistant message.
  activity?: ChatActivity;
  // What the "[n]" markers of this assistant message refer to. Not stored with
  // the conversation: a reloaded message has none and shows plain markers.
  citations?: ChatCitation[];
  // Stored id of this answer in the chat backend; thumbs are saved against it.
  // Absent with an older backend: the thumbs then stay local.
  backendMessageId?: string;
}

// Interface for the initial series selection prop for the modal
export interface InitialSeriesSelection {
  selectedSeries: string[];
  studyInstanceUID: string;
}

export interface ChatBoxProps {
  servicesManager: any;
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  onMessagesChange: (messages: Message[]) => void;
  onClearChat: () => void;
}

// Display set type for series formatting
export interface DisplaySet {
  StudyInstanceUID?: string;
  studyInstanceUID?: string;
  SeriesInstanceUID?: string;
  seriesInstanceUID?: string;
  SeriesDescription?: string;
  seriesDescription?: string;
  description?: string;
  SeriesNumber?: number | string;
  seriesNumber?: number | string;
  Modality?: string;
  modality?: string;
  numImageFrames?: number;
  numInstances?: number;
  images?: any[];
  StudyDate?: string;
  studyDate?: string;
  AccessionNumber?: string;
  accessionNumber?: string;
  thumbnailSrc?: string;
  imageSrc?: string;
}

// Modality data structure
export interface ModalityData {
  displaySets?: DisplaySet[];
  modality?: string;
}
