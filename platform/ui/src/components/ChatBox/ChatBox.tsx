import React, { useState, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useGlobalStateData } from '@ohif/app/src/GlobalStateProvider';
import SelectSeriesModal from '@ohif/app/src/components/inference/SelectSeriesModal';
import orchestratorRepository from '@ohif/app/src/api/orchestratorRepository';

// Hooks
import { useChatBox } from './hooks/useChatBox';
import { useSeriesSelection } from './hooks/useSeriesSelection';
import { useDraggable } from './hooks/useDraggable';

// Components
import { ChatHeader } from './components/ChatHeader';
import { SeriesCarousel } from './components/SeriesCarousel';
import { MessageList } from './components/MessageList';
import { InputArea } from './components/InputArea';

// Styles & Types
import { chatBoxStyles } from './ChatBox.styles';
import type { ChatBoxProps, Message, ModalityData } from './types';

const ChatBox: React.FC<ChatBoxProps> = ({
  servicesManager,
  isOpen,
  onClose,
  messages,
  onMessagesChange,
  onClearChat,
}) => {
  const { selectedModalities = {} } = useGlobalStateData();
  const chatboxRef = useRef<HTMLDivElement>(null);

  // State for message feedback (thumbs up/down)
  const [messageFeedback, setMessageFeedback] = useState<Record<string, 'up' | 'down' | null>>({});

  // Custom hooks
  const chat = useChatBox(isOpen, messages.length);
  const series = useSeriesSelection();
  const drag = useDraggable(isOpen);

  // Handle feedback for assistant messages
  const handleFeedback = useCallback(
    async (messageId: string, type: 'up' | 'down') => {
      const currentFeedback = messageFeedback[messageId];
      const newFeedback = currentFeedback === type ? null : type;

      // Optimistically update UI
      setMessageFeedback(prev => ({
        ...prev,
        [messageId]: newFeedback,
      }));

      // Only send to API if we have a threadId and feedback is being set (not cleared)
      if (chat.threadId && newFeedback) {
        try {
          await orchestratorRepository.SubmitFeedback({
            threadId: chat.threadId,
            messageId,
            feedback: newFeedback,
          });
        } catch (error) {
          console.error('Failed to submit feedback:', error);
          // Revert on error
          setMessageFeedback(prev => ({
            ...prev,
            [messageId]: currentFeedback,
          }));
        }
      }
    },
    [chat.threadId, messageFeedback]
  );

  // Handle message submission
  const handleSubmit = useCallback(
    async (inputValue: string) => {
      if (inputValue.trim() === '' || chat.isProcessing || !chat.threadId) return;

      const savedInput = inputValue.trim();

      // Add user message
      const userMessage: Message = {
        id: Date.now().toString(),
        text: savedInput,
        sender: 'user',
        timestamp: new Date(),
      };

      // Create a thinking message
      const thinkingId = (Date.now() + 1).toString();
      const thinkingMessage: Message = {
        id: thinkingId,
        text: 'Thinking...',
        sender: 'assistant',
        timestamp: new Date(),
        isThinking: true,
      };

      // Add the user message and thinking message to the chat
      const messagesWithThinking = [...messages, userMessage, thinkingMessage];
      onMessagesChange(messagesWithThinking);

      try {
        // Send the message to the backend
        const responseData = await chat.sendMessage(
          chat.threadId,
          savedInput,
          series.selectedSeries
        );

        // Remove thinking message and add the assistant's response
        if (responseData && responseData.content) {
          const assistantMessage: Message = {
            id: responseData.response_id || (Date.now() + 2).toString(),
            text: responseData.content.trim(),
            sender: 'assistant',
            timestamp: responseData.completed_at ? new Date(responseData.completed_at) : new Date(),
          };

          // Filter out the thinking message and add the real response
          const updatedMessages = messages
            .concat(userMessage)
            .filter(msg => msg.id !== thinkingId)
            .concat(assistantMessage);

          onMessagesChange(updatedMessages);
        } else {
          if (responseData && responseData.error) {
            throw new Error(responseData.error);
          } else if (responseData && responseData.status === 'error') {
            throw new Error('Request failed with error status');
          } else {
            throw new Error('No response content received');
          }
        }
      } catch (error: any) {
        console.error('Error handling message submission:', error);

        let errorMessage = 'Unknown error';
        if (error.message) {
          errorMessage = error.message;
        } else if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        } else if (error.response?.data?.error) {
          errorMessage = error.response.data.error;
        }

        // Add error message, replacing the thinking message
        const errorMessageObj: Message = {
          id: (Date.now() + 2).toString(),
          text: `Error: ${errorMessage}. Please try again.`,
          sender: 'assistant',
          timestamp: new Date(),
        };

        // Filter out the thinking message and add the error message
        const updatedMessages = messages
          .concat(userMessage)
          .filter(msg => msg.id !== thinkingId)
          .concat(errorMessageObj);

        onMessagesChange(updatedMessages);
      }
    },
    [chat, messages, onMessagesChange, series.selectedSeries]
  );

  // Handle clear chat
  const handleClearChat = useCallback(async () => {
    series.resetSelection();
    chat.resetThread();
    onClearChat();
  }, [series, chat, onClearChat]);

  // Handle series selection from modal
  const handleSeriesSelected = useCallback(
    async (
      seriesInstanceUIDs: string[],
      studyInstanceUID?: string
    ) => {
      await series.handleSeriesSelected(
        seriesInstanceUIDs,
        studyInstanceUID,
        selectedModalities as Record<string, ModalityData>,
        chat.threadId,
        async (threadId, studyUID, seriesUIDs) => {
          await chat.uploadDicomPayload(
            threadId,
            studyUID,
            seriesUIDs,
            selectedModalities as Record<string, ModalityData>
          );
        }
      );
    },
    [series, chat, selectedModalities]
  );

  // Handle series removal
  const handleRemoveSeries = useCallback(
    (seriesInstanceUID: string) => {
      series.removeSeries(
        seriesInstanceUID,
        chat.threadId,
        async (threadId, studyUID, seriesUIDs) => {
          await chat.uploadDicomPayload(
            threadId,
            studyUID,
            seriesUIDs,
            selectedModalities as Record<string, ModalityData>
          );
        }
      );
    },
    [series, chat, selectedModalities]
  );

  // Dummy function for the SelectSeriesModal
  const applyDummyPredictInferenceModel = useCallback(
    (
      containerId: string,
      seriesInstanceUIDs: string[],
      studyInstanceUID: string,
      additionalMetadata: any,
      outputMode: string
    ) => {
      handleSeriesSelected(seriesInstanceUIDs, studyInstanceUID);
    },
    [handleSeriesSelected]
  );

  // Create an initial series selection object for the modal
  const initialSeriesSelection = {
    selectedSeries: series.selectedSeries,
    studyInstanceUID: series.currentStudyInstanceUID,
  };

  return (
    <div
      className={`fixed z-50 flex flex-col rounded-lg bg-[#1E211F] text-white shadow-xl transition-all duration-300 ease-in-out ${
        isOpen ? 'h-[650px] w-[400px] opacity-100' : 'pointer-events-none h-0 w-0 opacity-0'
      }`}
      ref={chatboxRef}
      style={{
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        maxHeight: 'calc(100vh - 100px)',
        top: 'auto',
        left: 'auto',
        bottom: '24px',
        right: '32px',
        transform: isOpen ? `translate(${drag.position.x}px, ${drag.position.y}px)` : 'none',
        cursor: drag.isDragging ? 'grabbing' : 'auto',
      }}
      onMouseDown={drag.handleMouseDown}
    >
      {isOpen && (
        <>
          <style>{chatBoxStyles}</style>

          <ChatHeader
            onAddSeries={() => series.setIsSeriesModalOpen(true)}
            onClearChat={handleClearChat}
            onClose={onClose}
          />

          <SeriesCarousel
            selectedSeries={series.selectedSeries}
            selectedSeriesDetails={series.selectedSeriesDetails}
            carouselPage={series.carouselPage}
            seriesPerPage={series.seriesPerPage}
            getCurrentPageItems={series.getCurrentPageItems}
            goToPrevPage={series.goToPrevPage}
            goToNextPage={series.goToNextPage}
            onRemoveSeries={handleRemoveSeries}
          />

          <MessageList
            messages={messages}
            isLoading={chat.isLoading}
            errorDetails={chat.errorDetails}
            onRetry={chat.handleRetryThreadCreation}
            messageFeedback={messageFeedback}
            onFeedback={handleFeedback}
          />

          <InputArea
            onSubmit={handleSubmit}
            disabled={chat.isProcessing || !chat.threadId}
            isProcessing={chat.isProcessing}
            threadId={chat.threadId}
            threadCreationPending={chat.threadCreationPending}
          />

          {series.isSeriesModalOpen && (
            <SelectSeriesModal
              isOpen={series.isSeriesModalOpen}
              onClose={() => series.setIsSeriesModalOpen(false)}
              applyPredictInferenceModel={applyDummyPredictInferenceModel}
              loading={chat.isLoading}
              title="Select Series for Chat"
              selectedInferenceModel={{
                modelName: 'Series Selector',
                containerName: 'chat-series-selector',
                containerId: 'chat-series-selector',
                version: '1.0',
                dicomTargetLevel: 'SERIES',
                dicomUploadMin: 1,
                dicomUploadMax: 99,
                supportedDicomModalities: [],
                supportedDicomTags: [],
                outputMode: 'NONE',
                supportedAdditionalMetadata: [],
                modelFacts: {
                  en: {
                    Changelogs: {},
                    Summary: {},
                    Mechanism: {},
                    Validation_and_performance: {},
                    Other_information: {},
                    Other_results: {},
                    Uses_and_directions: {},
                    Warnings_and_limitations: {},
                  },
                },
              }}
              initialSeriesSelection={initialSeriesSelection}
            />
          )}
        </>
      )}
    </div>
  );
};

ChatBox.propTypes = {
  servicesManager: PropTypes.object.isRequired,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  messages: PropTypes.array.isRequired,
  onMessagesChange: PropTypes.func.isRequired,
  onClearChat: PropTypes.func.isRequired,
};

export default ChatBox;
