// Interface to track series information
export interface SeriesInfo {
  SeriesInstanceUID: string;
  info: string;
  imageSrc?: string;
  seriesDescription?: string;
  seriesNumber?: string;
  modality?: string;
}

// Chat message type
export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  isThinking?: boolean;
  status?: 'sending' | 'sent' | 'error';
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
