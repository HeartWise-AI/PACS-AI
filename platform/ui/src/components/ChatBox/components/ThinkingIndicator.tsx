import React from 'react';

const thinkingDotsStyle: React.CSSProperties = {
  animation: 'thinking-dots 1.4s infinite ease-in-out',
  display: 'inline-block',
};

export const ThinkingIndicator: React.FC = () => {
  return (
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
  );
};
