import { useState, useCallback, useEffect } from 'react';
import orchestratorRepository from '@ohif/app/src/api/orchestratorRepository';
import type { Message, ModalityData } from '../types';

interface SendMessageResponse {
  message_id?: string;
  response_id?: string;
  content: string;
  role: string;
  thread_id?: string;
  created_at?: string;
  completed_at?: string;
  user_content?: string;
  metadata?: any;
  status?: string;
  error?: string;
  tool_results?: any[];
}

interface UseChatBoxReturn {
  threadId: string | null;
  isLoading: boolean;
  isProcessing: boolean;
  errorDetails: string;
  thinkingMessageId: string | null;
  threadCreationPending: boolean;
  createThread: () => Promise<void>;
  sendMessage: (threadId: string, message: string, selectedSeries: string[]) => Promise<SendMessageResponse>;
  uploadDicomPayload: (
    threadId: string,
    studyInstanceUID: string,
    seriesInstanceUIDs: string[],
    selectedModalities: Record<string, ModalityData>
  ) => Promise<any>;
  setErrorDetails: (error: string) => void;
  handleRetryThreadCreation: () => void;
  resetThread: () => void;
}

export function useChatBox(isOpen: boolean, messagesLength: number): UseChatBoxReturn {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [threadCreationPending, setThreadCreationPending] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string>('');
  const [thinkingMessageId, setThinkingMessageId] = useState<string | null>(null);

  // Function to create a new thread
  const createThread = useCallback(async () => {
    if (threadCreationPending) return;

    try {
      setThreadCreationPending(true);
      setIsLoading(true);
      setErrorDetails('');
      console.log('Creating thread...');

      const response = await orchestratorRepository.CreateThread();

      if (response.success && response.data) {
        const newThreadId = response.data.thread_id;

        if (newThreadId) {
          console.log('Thread created with ID:', newThreadId);
          setThreadId(newThreadId);
          setErrorDetails('');
        } else {
          console.error('Thread ID not found in response:', response);
          setErrorDetails('Thread ID not found in server response');
        }
      } else {
        console.error('Invalid response format:', response);
        const errorMsg = response.message || 'Invalid response format from server';
        setErrorDetails(errorMsg);
      }
    } catch (error: any) {
      console.error('Error creating thread:', error);

      let errorMessage = 'Unknown error occurred while creating thread';
      if (error.message) {
        errorMessage = error.message;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.statusText) {
        errorMessage = `HTTP Error: ${error.response.statusText}`;
      }

      setErrorDetails(errorMessage);

      if (error.response?.status >= 500 || error.code === 'NETWORK_ERROR') {
        console.log('Network or server error detected, will retry in 3 seconds...');
        setTimeout(() => {
          setThreadCreationPending(false);
          setErrorDetails('');
        }, 3000);
      } else {
        setThreadCreationPending(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, [threadCreationPending]);

  // Function to send a message to the backend
  const sendMessage = useCallback(
    async (
      currentThreadId: string,
      message: string,
      selectedSeries: string[]
    ): Promise<SendMessageResponse> => {
      try {
        setIsLoading(true);
        setIsProcessing(true);

        const response = await orchestratorRepository.CreateMessage({
          threadId: currentThreadId,
          message,
          metadata: {
            selectedSeries: selectedSeries,
          },
        });

        if (response.success) {
          const responseData = response.data;
          const responseText = responseData.message?.content || responseData.response || '';

          return {
            message_id: responseData.message_id,
            response_id: responseData.response_id,
            content: responseText,
            role: responseData.message?.role || 'assistant',
            thread_id: responseData.thread_id,
            created_at: responseData.created_at,
            completed_at: responseData.completed_at,
            user_content: responseData.content,
            metadata: responseData.metadata,
            status: responseData.status,
            error: responseData.error,
            tool_results: responseData.message?.tool_results || [],
          };
        } else {
          throw new Error(response.message || 'Failed to send message');
        }
      } finally {
        setIsLoading(false);
        setIsProcessing(false);
      }
    },
    []
  );

  // Function to upload DICOM payload
  const uploadDicomPayload = useCallback(
    async (
      currentThreadId: string,
      studyInstanceUID: string,
      seriesInstanceUIDs: string[],
      selectedModalities: Record<string, ModalityData>
    ) => {
      try {
        let modality = '';
        let previewImageBase64 = '';
        const modalities = new Set<string>();

        for (const modalityData of Object.values(selectedModalities)) {
          if (modalityData.displaySets) {
            const matchingSeries = modalityData.displaySets.filter(series =>
              seriesInstanceUIDs.includes(series.SeriesInstanceUID || '')
            );

            matchingSeries.forEach(series => {
              const seriesModality =
                series.Modality || series.modality || modalityData.modality || '';
              if (seriesModality) {
                modalities.add(seriesModality);
              }

              if (!previewImageBase64) {
                const imageSource = series.thumbnailSrc || series.imageSrc;
                if (imageSource && imageSource.startsWith('data:image/')) {
                  const base64Match = imageSource.match(/^data:image\/[^;]+;base64,(.+)$/);
                  if (base64Match) {
                    previewImageBase64 = base64Match[1];
                  }
                }
              }
            });
          }
        }

        modality = Array.from(modalities).join(', ') || '';

        console.log('Uploading DICOM payload:', {
          studyInstanceUID,
          seriesInstanceUIDs,
          modality,
          hasPreviewImage: !!previewImageBase64,
        });

        const response = await orchestratorRepository.UploadDicomPayload({
          threadId: currentThreadId,
          studyInstanceUID,
          seriesInstanceUIDs,
          additionalMetadata: {
            modality,
            previewImageBase64: previewImageBase64 || undefined,
            seriesCount: seriesInstanceUIDs.length,
            timestamp: new Date().toISOString(),
          },
        });

        if (response.success && response.data) {
          const responseData = response.data;

          if (responseData.status === 'success' || responseData.success) {
            return {
              thread_id: responseData.thread_id,
              status: responseData.status,
              message: responseData.message,
              success: responseData.success,
            };
          } else {
            const errorMsg = responseData.message || 'DICOM payload upload failed';
            throw new Error(errorMsg);
          }
        } else {
          const errorMsg = response.message || 'Failed to upload DICOM payload';
          throw new Error(errorMsg);
        }
      } catch (error: any) {
        console.error('Error uploading DICOM payload:', error);

        let errorMessage = 'Failed to upload DICOM payload';
        if (error.message) {
          errorMessage = error.message;
        } else if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        } else if (error.response?.data?.error) {
          errorMessage = error.response.data.error;
        }

        throw new Error(errorMessage);
      }
    },
    []
  );

  // Initialize thread when chat opens or is reset
  useEffect(() => {
    if (isOpen && !threadId && messagesLength === 0 && !threadCreationPending) {
      setThreadCreationPending(true);
      createThread();
    }
  }, [isOpen, threadId, messagesLength, createThread, threadCreationPending]);

  // Reset thread creation pending when threadId is set
  useEffect(() => {
    if (threadId) {
      setThreadCreationPending(false);
    }
  }, [threadId]);

  const handleRetryThreadCreation = useCallback(() => {
    setThreadCreationPending(false);
    setThreadId(null);
    createThread();
  }, [createThread]);

  const resetThread = useCallback(() => {
    setThreadId(null);
  }, []);

  return {
    threadId,
    isLoading,
    isProcessing,
    errorDetails,
    thinkingMessageId,
    threadCreationPending,
    createThread,
    sendMessage,
    uploadDicomPayload,
    setErrorDetails,
    handleRetryThreadCreation,
    resetThread,
  };
}
