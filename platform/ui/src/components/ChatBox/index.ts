// Main component
export { default } from './ChatBox';
export { default as ChatBox } from './ChatBox';

// Types
export type { Message, SeriesInfo, ChatBoxProps, InitialSeriesSelection } from './types';

// Hooks (for advanced usage)
export { useChatBox } from './hooks/useChatBox';
export { useSeriesSelection } from './hooks/useSeriesSelection';
export { useDraggable } from './hooks/useDraggable';

// Components (for custom compositions)
export { ChatHeader } from './components/ChatHeader';
export { InputArea } from './components/InputArea';
export { MessageBubble } from './components/MessageBubble';
export { MessageList } from './components/MessageList';
export { SeriesCarousel } from './components/SeriesCarousel';
export { ThinkingIndicator } from './components/ThinkingIndicator';
export { EmptyState } from './components/EmptyState';

// Utilities
export { parseMarkdown } from './utils/markdown';
export { formatSeriesInfo } from './utils/formatSeriesInfo';
