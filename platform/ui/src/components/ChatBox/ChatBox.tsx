import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useGlobalStateData } from '@ohif/app/src/GlobalStateProvider';
// Import SelectSeriesModal component
import SelectSeriesModal from '@ohif/app/src/components/inference/SelectSeriesModal';
// Import orchestratorRepository
import orchestratorRepository from '@ohif/app/src/api/orchestratorRepository';

// Interface to track series information
interface SeriesInfo {
  SeriesInstanceUID: string;
  info: string;
}

// Chat message type
interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

// Create an interface for the initial series selection prop for the modal
interface InitialSeriesSelection {
  selectedSeries: string[];
  studyInstanceUID: string;
}

interface ChatBoxProps {
  servicesManager: any;
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  onMessagesChange: (messages: Message[]) => void;
  onClearChat: () => void;
}

const ChatBox: React.FC<ChatBoxProps> = ({
  servicesManager,
  isOpen,
  onClose,
  messages,
  onMessagesChange,
  onClearChat
}) => {
  const { t } = useTranslation();
  const { selectedModalities = {} } = useGlobalStateData();
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentSeriesInfo, setCurrentSeriesInfo] = useState<string>('');
  const [errorDetails, setErrorDetails] = useState<string>('');
  const chatboxRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Add state for SelectSeriesModal
  const [isSeriesModalOpen, setIsSeriesModalOpen] = useState(false);
  const [selectedSeries, setSelectedSeries] = useState<string[]>([]);
  const [selectedSeriesDetails, setSelectedSeriesDetails] = useState<SeriesInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [threadCreationPending, setThreadCreationPending] = useState(false);

  // Add state for thread tracking
  const [threadId, setThreadId] = useState<string | null>(null);

  // Add state for draggable functionality
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPosition, setDragStartPosition] = useState({ x: 0, y: 0 });

  // Add state for tracking study instance UID consistently
  const [currentStudyInstanceUID, setCurrentStudyInstanceUID] = useState<string>('');

  // Function to update the series information (kept for manual updates)
  const updateSeriesInfo = () => {
    try {
      // Check if selectedModalities has data
      if (selectedModalities && Object.keys(selectedModalities).length > 0) {
        // Get the first available series from selectedModalities
        const firstModality = Object.values(selectedModalities)[0];
        if (firstModality.displaySets && firstModality.displaySets.length > 0) {
          const firstDisplaySet = firstModality.displaySets[0];
          const seriesInfo = formatSeriesInfo(firstDisplaySet);
          setCurrentSeriesInfo(seriesInfo);
          setErrorDetails('');
          return;
        }
      }

      // If not available from GlobalStateData, try using the services
      if (!servicesManager?.services) {
        setCurrentSeriesInfo('Services not available');
        setErrorDetails('servicesManager.services is undefined');
        return;
      }

      const { displaySetService } = servicesManager.services;

      // If still not found, try to get any available series in the viewer
      if (displaySetService) {
        const allDisplaySets = displaySetService.getDisplaySets();

        if (allDisplaySets && allDisplaySets.length > 0) {
          const displaySet = allDisplaySets[0];
          const seriesInfo = formatSeriesInfo(displaySet);
          setCurrentSeriesInfo(seriesInfo);
          setErrorDetails('');
          return;
        }
      }

      // If still nothing found
      setCurrentSeriesInfo('No active series found');
      setErrorDetails('Could not find active series in the viewer');
    } catch (error) {
      console.error('Error getting series information:', error);
      setCurrentSeriesInfo('Error retrieving series information');
      setErrorDetails(error instanceof Error ? error.message : String(error));
    }
  };

  // Helper function to get first series details
  const getFirstSeriesDetails = () => {
    if (!selectedModalities || Object.keys(selectedModalities).length === 0) {
      return 'No series available in the study.';
    }

    // Get the first available series from selectedModalities
    for (const modality of Object.values(selectedModalities)) {
      if (modality.displaySets && modality.displaySets.length > 0) {
        return formatSeriesInfo(modality.displaySets[0]);
      }
    }

    return 'No series available in the study.';
  };

  // Helper function to format series info
  const formatSeriesInfo = (displaySet) => {
    if (!displaySet) return 'No display set data';

    const studyInstanceUID = displaySet.StudyInstanceUID || displaySet.studyInstanceUID || 'Unknown';
    const seriesInstanceUID = displaySet.SeriesInstanceUID || displaySet.seriesInstanceUID || 'Unknown';
    const seriesDescription = displaySet.SeriesDescription || displaySet.seriesDescription || displaySet.description || 'No description';
    const seriesNumber = displaySet.SeriesNumber || displaySet.seriesNumber || 'Unknown';
    const modality = displaySet.Modality || displaySet.modality || 'Unknown';
    const instanceCount = displaySet.numImageFrames || displaySet.numInstances || displaySet.images?.length || 'Unknown';

    // Additional data if available
    const studyDate = displaySet.StudyDate || displaySet.studyDate || 'Unknown';
    const accessionNumber = displaySet.AccessionNumber || displaySet.accessionNumber || 'Unknown';

    return [
      `Study UID: ${studyInstanceUID}`,
      `Series ID: ${seriesInstanceUID}`,
      `Description: ${seriesDescription}`,
      `Number: ${seriesNumber}`,
      `Modality: ${modality}`,
      `Instance Count: ${instanceCount}`,
      `Study Date: ${studyDate}`,
      `Accession: ${accessionNumber}`
    ].join('\n');
  };

  // Function to create a new thread
  const createThread = useCallback(async () => {
    if (threadCreationPending) return; // Prevent duplicate calls

    try {
      setThreadCreationPending(true);
      setIsLoading(true);
      console.log('Creating thread...');

      const response = await orchestratorRepository.CreateThread();

      if (response.success && response.data) {
        const threadId = response.data.thread_id;

        if (threadId) {
          console.log('Thread created with ID:', threadId);
          setThreadId(threadId);
        } else {
          console.error('Thread ID not found in response:', response);
          setErrorDetails('Thread ID not found in server response');
        }
      } else {
        console.error('Invalid response format:', response);
        setErrorDetails('Invalid response format from server');
      }
    } catch (error) {
      console.error('Error creating thread:', error);
      setErrorDetails(`Error creating thread: ${error.message || 'Unknown error'}`);
      // Adding a retry after a short delay
      setTimeout(() => {
        setThreadCreationPending(false);
      }, 3000);
    } finally {
      setIsLoading(false);
    }
  }, [threadCreationPending]);

  // Function to send a message to the backend
  const sendMessage = async (threadId: string, message: string) => {
    try {
      setIsLoading(true);
      const response = await orchestratorRepository.CreateMessage({
        threadId,
        message,
        metadata: {
          selectedSeries: selectedSeries
        }
      });

      if (response.success) {
        // The response structure can have the assistant's response in either:
        // - response.data.message.content
        // - response.data.response
        const responseText = response.data.message?.content || response.data.response || '';

        return {
          message_id: response.data.message_id,
          response_id: response.data.response_id,
          content: responseText,
          role: response.data.message?.role || 'assistant',
          thread_id: response.data.thread_id,
          created_at: response.data.created_at,
          completed_at: response.data.completed_at,
          user_content: response.data.content, // Original user message
          metadata: response.data.metadata
        };
      } else {
        throw new Error(response.message || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Function to upload DICOM payload
  const uploadDicomPayload = async (threadId: string, studyInstanceUID: string, seriesInstanceUIDs: string[]) => {
    try {
      const response = await orchestratorRepository.UploadDicomPayload({
        threadId,
        studyInstanceUID,
        seriesInstanceUIDs,
        additionalMetadata: {}
      });

      if (response.success) {
        return {
          thread_id: response.data.thread_id,
          status: response.data.status,
          message: response.data.message,
          success: response.data.success
        };
      } else {
        throw new Error(response.message || 'Failed to upload DICOM payload');
      }
    } catch (error) {
      console.error('Error uploading DICOM payload:', error);
      throw error;
    }
  };

  // Initialize thread when chat opens or is reset
  useEffect(() => {
    // Only create a thread if the chat is open, there's no thread yet,
    // no messages, and no thread creation is already in progress
    if (isOpen && !threadId && messages.length === 0 && !threadCreationPending) {
      setThreadCreationPending(true);
      createThread();
    }
  }, [isOpen, threadId, messages.length, createThread, threadCreationPending]);

  // Reset thread creation pending when threadId is set
  useEffect(() => {
    if (threadId) {
      setThreadCreationPending(false);
    }
  }, [threadId]);

  // Function to handle selecting series - modified to replace selection instead of just adding
  const handleSeriesSelected = async (seriesInstanceUIDs) => {
    // If no series are selected, just close the modal without any changes
    if (seriesInstanceUIDs.length === 0) {
      setIsSeriesModalOpen(false);
      return;
    }

    // Check if the selection has changed by comparing arrays
    const selectionChanged =
      seriesInstanceUIDs.length !== selectedSeries.length ||
      !seriesInstanceUIDs.every(uid => selectedSeries.includes(uid));

    if (!selectionChanged) {
      // No changes to the selection, just close the modal
      setIsSeriesModalOpen(false);
      return;
    }

    // Get information for the selected series
    const newSeriesInfo = [];
    let studyInstanceUID = currentStudyInstanceUID;

    // Iterate through all modalities to find the selected series
    for (const modality of Object.values(selectedModalities)) {
      if (modality.displaySets) {
        const matchingSeries = modality.displaySets.filter(
          series => seriesInstanceUIDs.includes(series.SeriesInstanceUID)
        );

        if (matchingSeries.length > 0 && !studyInstanceUID) {
          // Get studyInstanceUID from the first matching series
          studyInstanceUID = matchingSeries[0].StudyInstanceUID || matchingSeries[0].studyInstanceUID;
          setCurrentStudyInstanceUID(studyInstanceUID);
        }

        matchingSeries.forEach(series => {
          newSeriesInfo.push({
            SeriesInstanceUID: series.SeriesInstanceUID,
            info: formatSeriesInfo(series)
          });
        });
      }
    }

    // Update the selected series state with the new selection
    setSelectedSeries(seriesInstanceUIDs);

    // Update the series details with the new selection's info
    setSelectedSeriesDetails(newSeriesInfo);

    // Update the current series info display with the selected series
    const allSeriesInfo = newSeriesInfo
      .map(seriesInfo => seriesInfo.info)
      .join('\n\n');

    setCurrentSeriesInfo(allSeriesInfo);

    // If we have a thread ID and study instance UID, upload the DICOM payload
    if (threadId && studyInstanceUID) {
      try {
        await uploadDicomPayload(threadId, studyInstanceUID, seriesInstanceUIDs);
        console.log('DICOM payload uploaded successfully');
      } catch (error) {
        console.error('Failed to upload DICOM payload:', error);
      }
    }

    setIsSeriesModalOpen(false);
  };

  // Dummy function for the SelectSeriesModal (since we don't actually apply AI models here)
  const applyDummyPredictInferenceModel = (containerId, seriesInstanceUIDs, studyInstanceUID, additionalMetadata, outputMode) => {
    handleSeriesSelected(seriesInstanceUIDs);
  };

  // Scroll to bottom of messages whenever a new message is added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Add drag event handlers
  const handleMouseDown = (e) => {
    if (e.target.closest('.draggable-header')) {
      setIsDragging(true);
      setDragStartPosition({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStartPosition.x,
        y: e.clientY - dragStartPosition.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Add global event listeners for drag handling
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isOpen, isDragging, dragStartPosition]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() === '' || isProcessing || !threadId) return;

    const savedInput = inputValue.trim();

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      text: savedInput,
      sender: 'user',
      timestamp: new Date(),
    };

    // Add the user message to the chat
    const updatedMessages = [...messages, userMessage];
    onMessagesChange(updatedMessages);
    setInputValue('');
    setIsProcessing(true);

    try {
      // Send the message to the backend
      const responseData = await sendMessage(threadId, savedInput);

      // Add the assistant's response
      if (responseData && responseData.content) {
        const assistantMessage: Message = {
          id: responseData.response_id || (Date.now() + 1).toString(), // Use response_id if available
          text: responseData.content,
          sender: 'assistant',
          timestamp: responseData.completed_at ? new Date(responseData.completed_at) : new Date(),
        };

        onMessagesChange([...updatedMessages, assistantMessage]);
      } else {
        console.warn('No content in response data:', responseData);
        throw new Error('No response content received');
      }
    } catch (error) {
      console.error('Error handling message submission:', error);

      // Add error message
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: `Error: ${error.message || 'Unknown error'}. Please try again.`,
        sender: 'assistant',
        timestamp: new Date(),
      };

      onMessagesChange([...updatedMessages, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearChat = async () => {
    // Reset selected series when clearing chat
    setSelectedSeries([]);
    setSelectedSeriesDetails([]);
    setCurrentSeriesInfo('');

    // Reset thread ID to force creation of a new thread
    setThreadId(null);

    // Use the callback to clear messages
    onClearChat();

    // Create a new thread after a small delay to ensure states are updated
    setTimeout(() => {
      createThread();
    }, 100);
  };

  // Add additional button to retry thread creation if needed
  const handleRetryThreadCreation = () => {
    setThreadCreationPending(false);
    setThreadId(null);
    createThread();
  };

  // Create an initial series selection object for the modal
  const initialSeriesSelection: InitialSeriesSelection = {
    selectedSeries: selectedSeries,
    studyInstanceUID: currentStudyInstanceUID
  };

  return (
    <div
      className={`fixed z-50 flex flex-col rounded-lg bg-[#1E211F] text-white transition-all duration-300 ease-in-out shadow-xl ${
        isOpen ? 'h-[650px] w-[400px] opacity-100' : 'h-0 w-0 opacity-0 pointer-events-none'
      }`}
      ref={chatboxRef}
      style={{
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        maxHeight: 'calc(100vh - 100px)',
        bottom: '24px',
        right: '32px',
        transform: isOpen ? `translate(${position.x}px, ${position.y}px)` : 'none',
        cursor: isDragging ? 'grabbing' : 'auto'
      }}
      onMouseDown={handleMouseDown}
    >
      {isOpen && (
        <>
          <div
            className="draggable-header flex justify-between items-center px-4 py-3 border-b border-white border-opacity-10 rounded-t-lg bg-gradient-to-r from-[rgba(40,120,255,0.8)] to-[rgba(0,210,255,0.8)]"
            style={{ cursor: 'grab' }}
          >
            <h2 className="text-white text-lg font-bold">{t('Chat')}</h2>
            <div className="flex space-x-2">
              {/* Add Series button */}
              <button
                onClick={() => setIsSeriesModalOpen(true)}
                className="text-white hover:text-gray-300 focus:outline-none flex items-center"
                aria-label="Add Series"
                title={t('Add Series')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                {selectedSeries.length > 0 && (
                  <span className="ml-1 text-xs bg-[#C8F469] text-black rounded-full px-2 py-0.5">
                    {selectedSeries.length}
                  </span>
                )}
              </button>
              {/* Clear chat button */}
              <button
                onClick={handleClearChat}
                className="text-white hover:text-gray-300 focus:outline-none"
                aria-label="Clear chat"
                title={t('Clear chat history')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              {/* Close button */}
              <button
                onClick={onClose}
                className="text-white hover:text-gray-300 focus:outline-none"
                aria-label="Close chat"
                title={t('Close chat')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
                <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <p>{t('No messages yet')}</p>
                <p className="text-sm mt-2">
                  {t('Click the "+" button to select series, or start a conversation to get assistance with your medical images.')}
                </p>
                {errorDetails && (
                  <div className="mt-4 text-red-400">
                    <p>{t('Error initializing chat:')}</p>
                    <p className="text-xs mt-1">{errorDetails}</p>
                    <button
                      onClick={handleRetryThreadCreation}
                      className="mt-2 px-3 py-1 bg-[rgba(40,120,255,0.7)] rounded-md text-white hover:bg-[rgba(40,120,255,0.9)]"
                    >
                      {t('Retry')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              messages.map(message => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      message.sender === 'user'
                        ? 'bg-gradient-to-r from-[rgba(40,120,255,0.7)] to-[rgba(0,210,255,0.7)] text-white'
                        : 'bg-[#333633] text-white'
                    }`}
                  >
                    <div className="text-sm whitespace-pre-wrap">{message.text}</div>
                    <div className="text-xs opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <form onSubmit={handleSubmit} className="p-3 border-t border-white border-opacity-10 rounded-b-lg">
            <div className="relative">
              <input
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                disabled={isProcessing || !threadId}
                placeholder={
                  isProcessing
                    ? t('Processing...')
                    : !threadId
                      ? threadCreationPending
                        ? t('Initializing chat...')
                        : t('Error initializing chat. Please retry.')
                      : t('Type your message...')
                }
                className="w-full rounded-full bg-[#333633] text-white py-2 px-4 pr-10 focus:outline-none text-sm"
                autoFocus={isOpen && threadId !== null}
              />
              <button
                type="submit"
                disabled={inputValue.trim() === '' || isProcessing || !threadId}
                className={`absolute right-2 top-1/2 transform -translate-y-1/2 rounded-full p-1 ${
                  inputValue.trim() === '' || isProcessing || !threadId
                    ? 'opacity-50 cursor-not-allowed'
                    : 'opacity-100 hover:bg-[#444844]'
                }`}
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              </button>
            </div>
          </form>

          {/* Add Series Modal */}
          {isSeriesModalOpen && (
            <SelectSeriesModal
              isOpen={isSeriesModalOpen}
              onClose={() => setIsSeriesModalOpen(false)}
              applyPredictInferenceModel={applyDummyPredictInferenceModel}
              loading={isLoading}
              title="Select Series for Chat"
              selectedInferenceModel={{
                modelName: 'Series Selector',
                containerName: 'chat-series-selector',
                containerId: 'chat-series-selector',
                version: '1.0',
                dicomTargetLevel: 'SERIES',
                dicomUploadMin: 1,
                dicomUploadMax: 10,
                supportedDicomModalities: ['XA'], // Allow all modalities
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
                    Warnings_and_limitations: {}
                  }
                }
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
