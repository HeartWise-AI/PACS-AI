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
  imageSrc?: string; // Added for thumbnail preview
  seriesDescription?: string;
  seriesNumber?: string;
  modality?: string;
}

// Chat message type
interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  isThinking?: boolean; // Added for thinking animation
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

// Utility function to parse markdown
function parseMarkdown(text) {
  if (!text) return '';

  // Replace ** for bold
  let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Replace * or _ for italics
  formatted = formatted.replace(/(\*|_)(.*?)\1/g, '<em>$2</em>');

  // Replace headings with h tags
  formatted = formatted.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
  formatted = formatted.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
  formatted = formatted.replace(/^# (.*?)$/gm, '<h1>$1</h1>');

  // First process ordered lists (important to do this before unordered)
  let orderedListItems = [];
  formatted = formatted.replace(/^(\d+)\. (.*?)$/gm, function (match, number, content) {
    orderedListItems.push(content.trim());
    return '<!-ORDERED-LIST-ITEM-!>';
  });

  if (orderedListItems.length > 0) {
    let olHtml = '<ol>';
    orderedListItems.forEach(item => {
      olHtml += `<li>${item}</li>`;
    });
    olHtml += '</ol>';
    formatted = formatted.replace(/<!-ORDERED-LIST-ITEM-!>(\s*<!-ORDERED-LIST-ITEM-!>)*/g, olHtml);
  }

  // Handle unordered list items
  let unorderedListMatch = false;
  formatted = formatted.replace(/^(- |\* |• )(.*?)$/gm, function (match, bullet, content) {
    unorderedListMatch = true;
    return `<li>${content.trim()}</li>`;
  });

  if (unorderedListMatch) {
    formatted = formatted.replace(/(<li>.*?<\/li>\s*)+/g, '<ul>$&</ul>');
  }

  // Handle blockquotes
  formatted = formatted.replace(/^> (.*?)$/gm, '<blockquote>$1</blockquote>');

  // Handle tables
  let tableRows = [];
  let isTable = false;
  let headerRow = null;

  // Process table by splitting into lines and analyzing
  const lines = formatted.split('\n');
  let inTable = false;
  let tableHtml = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check if this is a table row (starts and ends with |)
    if (line.startsWith('|') && line.endsWith('|')) {
      // Skip separator rows (contains only |, -, and spaces)
      if (line.replace(/[\|\-\s]/g, '') === '') {
        continue;
      }

      if (!inTable) {
        inTable = true;
        tableHtml = '<table>';
      }

      // Parse the row content
      const cells = line.substring(1, line.length - 1).split('|');

      // Determine if this is a header row (usually the first row)
      const isHeader = !tableHtml.includes('<tr>');

      // Start row
      tableHtml += '<tr>';

      // Add cells
      cells.forEach(cell => {
        const tag = isHeader ? 'th' : 'td';
        tableHtml += `<${tag}>${cell.trim()}</${tag}>`;
      });

      // End row
      tableHtml += '</tr>';

      // Replace the original line
      lines[i] = '<!-TABLE-ROW-!>';
    } else if (inTable) {
      // End the table when we find a non-table row
      tableHtml += '</table>';
      inTable = false;

      // Replace the last table marker
      for (let j = i - 1; j >= 0; j--) {
        if (lines[j] === '<!-TABLE-ROW-!>') {
          lines[j] = tableHtml;

          // Remove other table markers
          for (let k = j - 1; k >= 0; k--) {
            if (lines[k] === '<!-TABLE-ROW-!>') {
              lines[k] = '';
            } else {
              break;
            }
          }
          break;
        }
      }
    }
  }

  // Handle any unclosed table
  if (inTable) {
    tableHtml += '</table>';

    // Replace the last table marker
    for (let j = lines.length - 1; j >= 0; j--) {
      if (lines[j] === '<!-TABLE-ROW-!>') {
        lines[j] = tableHtml;

        // Remove other table markers
        for (let k = j - 1; k >= 0; k--) {
          if (lines[k] === '<!-TABLE-ROW-!>') {
            lines[k] = '';
          } else {
            break;
          }
        }
        break;
      }
    }
  }

  formatted = lines.join('\n');

  // Links
  formatted = formatted.replace(
    /\[(.*?)\]\((.*?)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Code blocks with ```
  formatted = formatted.replace(/```(.*?)```/gs, '<pre><code>$1</code></pre>');

  // Code blocks with $1 syntax (used in the example)
  formatted = formatted.replace(
    /\$1([\w]*)\n([\s\S]*?)\n\$1/g,
    '<pre><code class="language-$1">$2</code></pre>'
  );

  // Inline code with `
  formatted = formatted.replace(/`([^`]*?)`/g, '<code>$1</code>');

  // Line breaks with two trailing spaces
  formatted = formatted.replace(/  \n/g, '<br>\n');

  // Handle paragraphs - looking for double newlines
  formatted = formatted.replace(/\n\n+/g, '</p><p>');

  // Wrap with paragraph tags if not already starting with HTML tag
  if (!formatted.match(/^<[a-z]+>/i)) {
    formatted = '<p>' + formatted + '</p>';
  }

  // Fix any cases where we might have broken HTML
  formatted = formatted.replace(/<\/p><p>\s*<(ul|ol|h[1-6]|table|blockquote)/g, '</p><$1');
  formatted = formatted.replace(/<\/(ul|ol|h[1-6]|table|blockquote)>\s*<p>/g, '</$1>');

  // Replace single newlines with line breaks for remaining text (but not inside code blocks)
  formatted = formatted.replace(/(<\/code><\/pre>|<pre><code>|<table>|<\/table>)/g, '<!-BLOCK-!>');
  formatted = formatted.replace(/\n/g, '<br>');
  formatted = formatted.replace(/<!-BLOCK-!>/g, '$1');

  return formatted;
}

const ChatBox: React.FC<ChatBoxProps> = ({
  servicesManager,
  isOpen,
  onClose,
  messages,
  onMessagesChange,
  onClearChat,
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
  // Add state for the thinking animation
  const [thinkingMessageId, setThinkingMessageId] = useState<string | null>(null);

  // Add state for thread tracking
  const [threadId, setThreadId] = useState<string | null>(null);

  // Add state for draggable functionality
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPosition, setDragStartPosition] = useState({ x: 0, y: 0 });

  // Add state for tracking study instance UID consistently
  const [currentStudyInstanceUID, setCurrentStudyInstanceUID] = useState<string>('');

  // Add state for carousel
  const [carouselPage, setCarouselPage] = useState(0);
  const seriesPerPage = 3; // Number of series thumbnails to show per page

  // Helper function to format series info
  const formatSeriesInfo = displaySet => {
    if (!displaySet) return 'No display set data';

    const studyInstanceUID =
      displaySet.StudyInstanceUID || displaySet.studyInstanceUID || 'Unknown';
    const seriesInstanceUID =
      displaySet.SeriesInstanceUID || displaySet.seriesInstanceUID || 'Unknown';
    const seriesDescription =
      displaySet.SeriesDescription ||
      displaySet.seriesDescription ||
      displaySet.description ||
      'No description';
    const seriesNumber = displaySet.SeriesNumber || displaySet.seriesNumber || 'Unknown';
    const modality = displaySet.Modality || displaySet.modality || 'Unknown';
    const instanceCount =
      displaySet.numImageFrames ||
      displaySet.numInstances ||
      displaySet.images?.length ||
      'Unknown';

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
      `Accession: ${accessionNumber}`,
    ].join('\n');
  };

  // Function to create a new thread
  const createThread = useCallback(async () => {
    if (threadCreationPending) return; // Prevent duplicate calls

    try {
      setThreadCreationPending(true);
      setIsLoading(true);
      setErrorDetails(''); // Clear any previous errors
      console.log('Creating thread...');

      const response = await orchestratorRepository.CreateThread();

      if (response.success && response.data) {
        const threadId = response.data.thread_id;

        if (threadId) {
          console.log('Thread created with ID:', threadId);
          setThreadId(threadId);
          setErrorDetails(''); // Clear any previous errors on success
        } else {
          console.error('Thread ID not found in response:', response);
          setErrorDetails('Thread ID not found in server response');
        }
      } else {
        console.error('Invalid response format:', response);
        const errorMsg = response.message || 'Invalid response format from server';
        setErrorDetails(errorMsg);
      }
    } catch (error) {
      console.error('Error creating thread:', error);

      // Extract error message from different possible sources
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

      // Adding a retry after a short delay for network errors
      if (error.response?.status >= 500 || error.code === 'NETWORK_ERROR') {
        console.log('Network or server error detected, will retry in 3 seconds...');
        setTimeout(() => {
          setThreadCreationPending(false);
          setErrorDetails(''); // Clear error before retry
        }, 3000);
      } else {
        setThreadCreationPending(false);
      }
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
          selectedSeries: selectedSeries,
        },
      });

      if (response.success) {
        // Handle the new API response structure
        const responseData = response.data;

        // Get the assistant's response content from the nested message object or legacy fields
        const responseText = responseData.message?.content || responseData.response || '';

        return {
          message_id: responseData.message_id,
          response_id: responseData.response_id,
          content: responseText,
          role: responseData.message?.role || 'assistant',
          thread_id: responseData.thread_id,
          created_at: responseData.created_at,
          completed_at: responseData.completed_at,
          user_content: responseData.content, // Original user message
          metadata: responseData.metadata,
          status: responseData.status,
          error: responseData.error,
          tool_results: responseData.message?.tool_results || [],
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
  const uploadDicomPayload = async (
    threadId: string,
    studyInstanceUID: string,
    seriesInstanceUIDs: string[]
  ) => {
    try {
      // Extract modality and preview image from the selected series data
      let modality = '';
      let previewImageBase64 = '';
      const modalities = new Set<string>();

      // Find all matching series to get modality information and the best preview image
      for (const modalityData of Object.values(selectedModalities)) {
        if (modalityData.displaySets) {
          const matchingSeries = modalityData.displaySets.filter(series =>
            seriesInstanceUIDs.includes(series.SeriesInstanceUID)
          );

          matchingSeries.forEach(series => {
            // Collect modalities
            const seriesModality =
              series.Modality || series.modality || modalityData.modality || '';
            if (seriesModality) {
              modalities.add(seriesModality);
            }

            // Get preview image from the first series that has one (prioritize thumbnailSrc)
            if (!previewImageBase64) {
              const imageSource = series.thumbnailSrc || series.imageSrc;
              if (imageSource && imageSource.startsWith('data:image/')) {
                // Extract base64 data from data URL
                const base64Match = imageSource.match(/^data:image\/[^;]+;base64,(.+)$/);
                if (base64Match) {
                  previewImageBase64 = base64Match[1];
                }
              }
            }
          });
        }
      }

      // Set modality: if multiple modalities, join them; otherwise use the single modality
      modality = Array.from(modalities).join(', ') || '';

      console.log('Uploading DICOM payload:', {
        studyInstanceUID,
        seriesInstanceUIDs,
        modality,
        hasPreviewImage: !!previewImageBase64,
      });

      const response = await orchestratorRepository.UploadDicomPayload({
        threadId,
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

        // Check if the upload was successful
        if (responseData.status === 'success' || responseData.success) {
          return {
            thread_id: responseData.thread_id,
            status: responseData.status,
            message: responseData.message,
            success: responseData.success,
          };
        } else {
          // Handle error response from the server
          const errorMsg = responseData.message || 'DICOM payload upload failed';
          throw new Error(errorMsg);
        }
      } else {
        // Handle API response error
        const errorMsg = response.message || 'Failed to upload DICOM payload';
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('Error uploading DICOM payload:', error);

      // Extract error message from different possible sources
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
  const handleSeriesSelected = async (seriesInstanceUIDs, passedStudyInstanceUID?: string) => {
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
    // Use the passed studyInstanceUID if provided, otherwise fall back to current
    let studyInstanceUID = passedStudyInstanceUID || currentStudyInstanceUID;

    // Iterate through all modalities to find the selected series
    for (const modality of Object.values(selectedModalities)) {
      if (modality.displaySets) {
        const matchingSeries = modality.displaySets.filter(series =>
          seriesInstanceUIDs.includes(series.SeriesInstanceUID)
        );

        if (matchingSeries.length > 0 && !studyInstanceUID) {
          // Get studyInstanceUID from the first matching series if not already provided
          studyInstanceUID =
            matchingSeries[0].StudyInstanceUID || matchingSeries[0].studyInstanceUID;
        }

        matchingSeries.forEach(series => {
          // Get thumbnail image if available
          // The thumbnailSrc property is the correct property for thumbnail images
          const thumbnailImageSrc = series.thumbnailSrc || series.imageSrc || '';

          newSeriesInfo.push({
            SeriesInstanceUID: series.SeriesInstanceUID,
            info: formatSeriesInfo(series),
            imageSrc: thumbnailImageSrc,
            seriesDescription:
              series.SeriesDescription ||
              series.seriesDescription ||
              series.description ||
              'No description',
            seriesNumber: String(series.SeriesNumber || series.seriesNumber || 'Unknown'),
            modality: series.Modality || series.modality || 'Unknown',
          });
        });
      }
    }

    // Update the selected series state with the new selection
    setSelectedSeries(seriesInstanceUIDs);

    // Update the study instance UID state if we have a valid value
    if (studyInstanceUID && studyInstanceUID !== currentStudyInstanceUID) {
      setCurrentStudyInstanceUID(studyInstanceUID);
    }

    // Update the series details with the new selection's info
    setSelectedSeriesDetails(newSeriesInfo);

    // Reset carousel page when new series are selected
    setCarouselPage(0);

    // Update the current series info display with the selected series
    const allSeriesInfo = newSeriesInfo.map(seriesInfo => seriesInfo.info).join('\n\n');

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

  // Carousel navigation functions
  const goToPrevPage = () => {
    setCarouselPage(prev => Math.max(0, prev - 1));
  };

  const goToNextPage = () => {
    const maxPage = Math.ceil(selectedSeriesDetails.length / seriesPerPage) - 1;
    setCarouselPage(prev => Math.min(maxPage, prev + 1));
  };

  // Get current page items for carousel
  const getCurrentPageItems = () => {
    const startIndex = carouselPage * seriesPerPage;
    return selectedSeriesDetails.slice(startIndex, startIndex + seriesPerPage);
  };

  // Function to remove a series from selection
  const removeSeries = seriesInstanceUID => {
    const updatedSelection = selectedSeries.filter(uid => uid !== seriesInstanceUID);
    const updatedDetails = selectedSeriesDetails.filter(
      series => series.SeriesInstanceUID !== seriesInstanceUID
    );

    setSelectedSeries(updatedSelection);
    setSelectedSeriesDetails(updatedDetails);

    // Update the current series info display
    const allSeriesInfo = updatedDetails.map(seriesInfo => seriesInfo.info).join('\n\n');

    setCurrentSeriesInfo(allSeriesInfo);

    // Adjust carousel page if necessary
    const maxPage = Math.ceil(updatedDetails.length / seriesPerPage) - 1;
    if (carouselPage > maxPage && maxPage >= 0) {
      setCarouselPage(maxPage);
    }

    // If we have a thread ID and study instance UID, upload the updated DICOM payload
    if (threadId && currentStudyInstanceUID) {
      uploadDicomPayload(threadId, currentStudyInstanceUID, updatedSelection).catch(error =>
        console.error('Failed to update DICOM payload:', error)
      );
    }
  };

  // Dummy function for the SelectSeriesModal (since we don't actually apply AI models here)
  const applyDummyPredictInferenceModel = (
    containerId,
    seriesInstanceUIDs,
    studyInstanceUID,
    additionalMetadata,
    outputMode
  ) => {
    handleSeriesSelected(seriesInstanceUIDs, studyInstanceUID);
  };

  // Scroll to bottom of messages whenever a new message is added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Add drag event handlers
  const handleMouseDown = e => {
    if (e.target.closest('.draggable-header')) {
      setIsDragging(true);
      setDragStartPosition({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  const handleMouseMove = e => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStartPosition.x,
        y: e.clientY - dragStartPosition.y,
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
    setThinkingMessageId(thinkingId);
    setInputValue('');
    setIsProcessing(true);

    try {
      // Send the message to the backend
      const responseData = await sendMessage(threadId, savedInput);

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
        console.warn('No content in response data:', responseData);

        // Check if there's an error in the response
        if (responseData && responseData.error) {
          throw new Error(responseData.error);
        } else if (responseData && responseData.status === 'error') {
          throw new Error('Request failed with error status');
        } else {
          throw new Error('No response content received');
        }
      }
    } catch (error) {
      console.error('Error handling message submission:', error);

      // Extract error message from different possible sources
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
    } finally {
      setThinkingMessageId(null);
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
    studyInstanceUID: currentStudyInstanceUID,
  };

  // CSS for the thinking animation (the dots)
  const thinkingDotsStyle = {
    animation: 'thinking-dots 1.4s infinite ease-in-out',
    display: 'inline-block',
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
        bottom: '24px',
        right: '32px',
        transform: isOpen ? `translate(${position.x}px, ${position.y}px)` : 'none',
        cursor: isDragging ? 'grabbing' : 'auto',
      }}
      onMouseDown={handleMouseDown}
    >
      {isOpen && (
        <>
          <style>
            {`
            @keyframes thinking-dots {
              0%, 20% {
                opacity: 0.2;
              }
              40% {
                opacity: 1;
              }
              60%, 100% {
                opacity: 0.2;
              }
            }
            .thinking-dot:nth-child(1) {
              animation-delay: 0s;
            }
            .thinking-dot:nth-child(2) {
              animation-delay: 0.2s;
            }
            .thinking-dot:nth-child(3) {
              animation-delay: 0.4s;
            }

            /* Series carousel styling */
            .series-carousel {
              background-color: rgba(0, 0, 0, 0.2);
              border-bottom: 1px solid rgba(255, 255, 255, 0.1);
              padding: 10px;
              display: flex;
              flex-direction: column;
              overflow: hidden;
            }
            .series-carousel-title {
              font-size: 0.875rem;
              font-weight: 500;
              margin-bottom: 8px;
              color: rgba(255, 255, 255, 0.9);
            }
            .series-carousel-container {
              display: flex;
              align-items: center;
              justify-content: space-between;
            }
            .series-carousel-button {
              background-color: rgba(255, 255, 255, 0.1);
              border-radius: 50%;
              width: 28px;
              height: 28px;
              display: flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
            }
            .series-carousel-button:hover {
              background-color: rgba(255, 255, 255, 0.2);
            }
            .series-carousel-button:disabled {
              opacity: 0.3;
              cursor: not-allowed;
            }
            .series-thumbnails {
              display: flex;
              flex: 1;
              overflow-x: hidden;
              padding: 0 8px;
              gap: 8px;
            }
            .series-thumbnail {
              position: relative;
              border-radius: 4px;
              overflow: hidden;
              width: calc(33% - 6px);
              border: 1px solid rgba(255, 255, 255, 0.2);
              flex-shrink: 0;
            }
            .series-thumbnail:hover {
              border-color: rgba(200, 244, 105, 0.7);
            }
            .series-thumbnail img {
              width: 100%;
              height: 80px;
              object-fit: cover;
              background-color: rgba(0, 0, 0, 0.3);
            }
            .series-thumbnail-info {
              padding: 4px;
              font-size: 0.75rem;
              background-color: rgba(0, 0, 0, 0.5);
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .series-thumbnail-remove {
              position: absolute;
              top: 2px;
              right: 2px;
              background-color: rgba(0, 0, 0, 0.6);
              border-radius: 50%;
              width: 20px;
              height: 20px;
              display: flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              opacity: 0;
              transition: opacity 0.2s;
            }
            .series-thumbnail:hover .series-thumbnail-remove {
              opacity: 1;
            }
            .series-thumbnail-remove:hover {
              background-color: rgba(255, 0, 0, 0.6);
            }
            .series-thumbnail-badge {
              position: absolute;
              top: 2px;
              left: 2px;
              background-color: rgba(0, 0, 0, 0.6);
              border-radius: 4px;
              padding: 2px 4px;
              font-size: 0.7rem;
              font-weight: bold;
              color: #C8F469;
            }
            .series-placeholder {
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100px;
              width: 100%;
              background-color: rgba(0, 0, 0, 0.2);
              border-radius: 4px;
              font-size: 0.75rem;
              color: rgba(255, 255, 255, 0.7);
              text-align: center;
              padding: 8px;
            }

            /* Markdown styling */
            .markdown-content {
              font-size: 0.875rem;
              line-height: 1.5;
            }
            .markdown-content h1,
            .markdown-content h2,
            .markdown-content h3,
            .markdown-content h4,
            .markdown-content h5,
            .markdown-content h6 {
              margin-top: 0.5rem;
              margin-bottom: 0.5rem;
              font-weight: 600;
            }
            .markdown-content h1 {
              font-size: 1.25rem;
            }
            .markdown-content h2 {
              font-size: 1.15rem;
            }
            .markdown-content h3 {
              font-size: 1.05rem;
            }
            .markdown-content p {
              margin-bottom: 0.5rem;
            }
            .markdown-content ul,
            .markdown-content ol {
              margin-left: 1.5rem;
              margin-bottom: 0.5rem;
            }
            .markdown-content ul {
              list-style-type: disc;
            }
            .markdown-content ol {
              list-style-type: decimal;
            }
            .markdown-content li {
              margin-bottom: 0.25rem;
            }
            .markdown-content strong {
              font-weight: 700;
            }
            .markdown-content em {
              font-style: italic;
            }
            .markdown-content code {
              font-family: monospace;
              background-color: rgba(0, 0, 0, 0.2);
              padding: 0.1rem 0.2rem;
              border-radius: 0.25rem;
            }
            .markdown-content pre {
              background-color: rgba(0, 0, 0, 0.2);
              padding: 0.5rem;
              border-radius: 0.25rem;
              overflow-x: auto;
              margin-bottom: 0.5rem;
            }
            .markdown-content blockquote {
              border-left: 3px solid rgba(255, 255, 255, 0.3);
              padding-left: 0.5rem;
              margin-left: 0.5rem;
              margin-bottom: 0.5rem;
              color: rgba(255, 255, 255, 0.8);
            }
            .markdown-content a {
              color: #C8F469;
              text-decoration: underline;
            }
            .markdown-content hr {
              border: 0;
              border-top: 1px solid rgba(255, 255, 255, 0.2);
              margin: 0.5rem 0;
            }
            .markdown-content table {
              border-collapse: collapse;
              width: 100%;
              margin-bottom: 0.5rem;
            }
            .markdown-content th,
            .markdown-content td {
              border: 1px solid rgba(255, 255, 255, 0.2);
              padding: 0.25rem;
              text-align: left;
            }
            .markdown-content th {
              background-color: rgba(0, 0, 0, 0.2);
            }
            `}
          </style>
          <div
            className="draggable-header flex items-center justify-between rounded-t-lg border-b border-white border-opacity-10 bg-gradient-to-r from-[rgba(100,200,100,0.8)] to-[rgba(200,244,105,0.8)] px-4 py-3"
            style={{ cursor: 'grab' }}
          >
            <h2 className="text-lg font-bold text-white">{t('Chat')}</h2>
            <div className="flex space-x-2">
              {/* Add Series button */}
              <button
                onClick={() => setIsSeriesModalOpen(true)}
                className="flex items-center text-white hover:text-gray-300 focus:outline-none"
                aria-label="Add Series"
                title={t('Add Series')}
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
              </button>
              {/* Clear chat button */}
              <button
                onClick={handleClearChat}
                className="text-white hover:text-gray-300 focus:outline-none"
                aria-label="Clear chat"
                title={t('Clear chat history')}
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
              {/* Close button */}
              <button
                onClick={onClose}
                className="text-white hover:text-gray-300 focus:outline-none"
                aria-label="Close chat"
                title={t('Close chat')}
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Series Carousel - Only show if there are selected series */}
          {selectedSeries.length > 0 && (
            <div className="series-carousel">
              <div className="series-carousel-title">
                {t('Selected Series')} ({selectedSeries.length})
              </div>
              <div className="series-carousel-container">
                <button
                  className="series-carousel-button"
                  onClick={goToPrevPage}
                  disabled={carouselPage === 0}
                  aria-label="Previous series"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>

                <div className="series-thumbnails">
                  {getCurrentPageItems().length > 0 ? (
                    getCurrentPageItems().map(series => (
                      <div
                        key={series.SeriesInstanceUID}
                        className="series-thumbnail"
                      >
                        <div className="series-thumbnail-badge">
                          {series.modality} {series.seriesNumber}
                        </div>
                        <button
                          className="series-thumbnail-remove"
                          onClick={() => removeSeries(series.SeriesInstanceUID)}
                          aria-label="Remove series"
                        >
                          <svg
                            className="h-3 w-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                        {series.imageSrc ? (
                          <img
                            src={series.imageSrc}
                            alt={`Series ${series.seriesNumber}`}
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-[80px] w-full items-center justify-center bg-black bg-opacity-30">
                            <div className="flex flex-col items-center justify-center">
                              <span className="text-sm font-bold text-[#C8F469]">
                                {series.modality}
                              </span>
                              <span className="mt-1 text-xs text-white opacity-70">
                                Series {series.seriesNumber}
                              </span>
                            </div>
                          </div>
                        )}
                        <div className="series-thumbnail-info">{series.seriesDescription}</div>
                      </div>
                    ))
                  ) : (
                    <div className="series-placeholder">
                      {t(
                        'No series selected. Click the "+" button to add series to the conversation.'
                      )}
                    </div>
                  )}
                </div>

                <button
                  className="series-carousel-button"
                  onClick={goToNextPage}
                  disabled={
                    carouselPage >= Math.ceil(selectedSeriesDetails.length / seriesPerPage) - 1 ||
                    selectedSeriesDetails.length <= seriesPerPage
                  }
                  aria-label="Next series"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Chat messages */}
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-gray-400">
                <svg
                  className="mb-4 h-12 w-12"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1"
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                  />
                </svg>
                <p>{t('No messages yet')}</p>
                <p className="mt-2 text-sm">
                  {t(
                    'Click the "+" button to select series, or start a conversation to get assistance with your medical images.'
                  )}
                </p>
                {errorDetails && (
                  <div className="mt-4 max-w-full rounded-lg border border-red-500 border-opacity-30 bg-red-900 bg-opacity-30 p-3 text-red-400">
                    <p className="font-medium">{t('Error initializing chat:')}</p>
                    <p className="mt-1 break-words text-sm">{errorDetails}</p>
                    <div className="mt-3 space-y-2">
                      <button
                        onClick={handleRetryThreadCreation}
                        className="rounded-md bg-[rgba(100,180,100,0.7)] px-3 py-1 text-white transition-colors hover:bg-[rgba(100,180,100,0.9)]"
                      >
                        {t('Retry')}
                      </button>
                      <p className="mt-1 text-xs text-gray-500">
                        {t(
                          'If the error persists, please check your network connection or contact support.'
                        )}
                      </p>
                    </div>
                  </div>
                )}
                {isLoading && !errorDetails && (
                  <div className="mt-4 flex items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-white"></div>
                    <span className="ml-2 text-sm">{t('Initializing chat...')}</span>
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
                        ? 'bg-gradient-to-r from-[rgba(100,180,100,0.7)] to-[rgba(180,230,100,0.7)] text-white'
                        : 'bg-[#333633] text-white'
                    }`}
                  >
                    <div className="whitespace-pre-wrap text-sm">
                      {message.isThinking ? (
                        <div>
                          Thinking
                          <span
                            className="thinking-dot ml-1"
                            style={thinkingDotsStyle}
                          >
                            .
                          </span>
                          <span
                            className="thinking-dot ml-1"
                            style={thinkingDotsStyle}
                          >
                            .
                          </span>
                          <span
                            className="thinking-dot ml-1"
                            style={thinkingDotsStyle}
                          >
                            .
                          </span>
                        </div>
                      ) : (
                        <div
                          className="markdown-content"
                          dangerouslySetInnerHTML={{
                            __html: parseMarkdown(message.text?.trim() || ''),
                          }}
                        />
                      )}
                    </div>
                    <div className="mt-1 text-xs opacity-70">
                      {message.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <form
            onSubmit={handleSubmit}
            className="rounded-b-lg border-t border-white border-opacity-10 p-3"
          >
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
                className="w-full rounded-full bg-[#333633] py-2 px-4 pr-10 text-sm text-white focus:outline-none"
                autoFocus={isOpen && threadId !== null}
              />
              <button
                type="submit"
                disabled={inputValue.trim() === '' || isProcessing || !threadId}
                className={`absolute right-2 top-1/2 -translate-y-1/2 transform rounded-full p-1 ${
                  inputValue.trim() === '' || isProcessing || !threadId
                    ? 'cursor-not-allowed opacity-50'
                    : 'opacity-100 hover:bg-[#444844]'
                }`}
              >
                <svg
                  className="h-5 w-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
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
                dicomUploadMax: 99,
                supportedDicomModalities: [], // Allow all modalities
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
