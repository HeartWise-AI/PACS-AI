export const chatBoxStyles = `
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
`;
