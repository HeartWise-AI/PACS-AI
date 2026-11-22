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

  /* Resize handle styles */
  .resize-handle {
    cursor: nwse-resize !important;
  }
  .resize-handle:hover svg path {
    stroke: #C8F469;
    stroke-width: 2;
  }
  .resize-handle:hover > div {
    opacity: 1 !important;
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
  .markdown-table-wrapper {
    max-width: 100%;
    overflow-x: auto;
    margin-bottom: 0.5rem;
  }
  .markdown-content table {
    border-collapse: collapse;
    width: max-content;
    min-width: 100%;
  }
  .markdown-content th,
  .markdown-content td {
    border: 1px solid rgba(255, 255, 255, 0.2);
    padding: 0.25rem;
    text-align: left;
    white-space: nowrap;
  }
  .markdown-content th {
    background-color: rgba(0, 0, 0, 0.2);
  }

  /* Structured clinical summary & evidence cards */
  .chat-structured-answer {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    white-space: normal;
  }
  .chat-answer-eyebrow {
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.65);
    margin-bottom: 0.1rem;
  }
  .chat-summary-card {
    background: linear-gradient(145deg, rgba(200, 244, 105, 0.14) 0%, rgba(32, 43, 30, 0.96) 100%);
    border: 1px solid rgba(200, 244, 105, 0.45);
    border-left: 3px solid #C8F469;
    border-radius: 0.625rem;
    padding: 0.75rem 0.875rem;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.28);
  }
  .chat-summary-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.45rem;
  }
  .chat-summary-badge {
    display: inline-flex;
    align-items: center;
    background-color: rgba(200, 244, 105, 0.2);
    color: #C8F469;
    border: 1px solid rgba(200, 244, 105, 0.45);
    border-radius: 9999px;
    padding: 0.125rem 0.55rem;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .chat-summary-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-bottom: 0.55rem;
  }
  .chat-summary-pill {
    background-color: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 0.375rem;
    padding: 0.15rem 0.45rem;
    font-size: 0.72rem;
    line-height: 1.3;
    color: rgba(255, 255, 255, 0.92);
  }
  .chat-section-card {
    background-color: rgba(20, 23, 21, 0.68);
    border: 1px solid rgba(255, 255, 255, 0.13);
    border-radius: 0.5rem;
    padding: 0.65rem 0.8rem;
  }
  .chat-caveats-card {
    background-color: rgba(120, 83, 20, 0.16);
    border: 1px solid rgba(251, 191, 36, 0.28);
    border-radius: 0.5rem;
    padding: 0.65rem 0.8rem;
  }
  /* Citation chips by kind. Colours are theme tokens (pacs-ai-theme):
     a model result is lime (primary) on 20% lime over the page background
     (contrast 8.2:1), a published source is neutral-light on neutral-dark
     (7.5:1). Both backgrounds are opaque, so the number keeps its contrast
     on any card. */
  .chat-citation-chip-model {
    color: hsl(var(--primary, 79 86.3% 68.4%));
    background-color: color-mix(in srgb, hsl(var(--primary, 79 86.3% 68.4%)) 20%, hsl(var(--background, 120 6.7% 8.8%)));
    border-color: hsl(var(--primary, 79 86.3% 68.4%) / 0.55);
  }
  .chat-citation-chip-source {
    color: hsl(var(--neutral-light, 214 69% 81%));
    background-color: hsl(var(--neutral-dark, 214 16% 21%));
    border-color: hsl(var(--neutral, 213 22% 59%) / 0.6);
  }
  .chat-citation-chip-model:hover,
  .chat-citation-chip-model[aria-expanded='true'] {
    border-color: hsl(var(--primary, 79 86.3% 68.4%));
  }
  .chat-citation-chip-source:hover,
  .chat-citation-chip-source[aria-expanded='true'] {
    border-color: hsl(var(--neutral-light, 214 69% 81%));
  }
  .chat-citation-key {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 0.35rem;
    font-size: 0.7rem;
    color: rgba(255, 255, 255, 0.7);
  }
  .chat-citation-key-model::before,
  .chat-citation-key-source::before {
    content: '●';
    margin-right: 0.25rem;
  }
  .chat-citation-key-model::before {
    color: hsl(var(--primary, 79 86.3% 68.4%));
  }
  .chat-citation-key-source::before {
    color: hsl(var(--neutral-light, 214 69% 81%));
  }
  .chat-sources-card {
    background-color: rgba(0, 0, 0, 0.22);
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 0.5rem;
    padding: 0.55rem 0.75rem;
    font-size: 0.8rem;
  }
  .chat-section-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5rem;
    padding-bottom: 0.35rem;
    margin-bottom: 0.4rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  .chat-section-title {
    font-size: 0.82rem;
    font-weight: 700;
    color: #ffffff;
  }
  .chat-section-subtitle {
    font-size: 0.74rem;
    line-height: 1.35;
    color: rgba(255, 255, 255, 0.72);
    margin-top: 0.125rem;
  }
  .chat-card-provenance {
    font-size: 0.68rem;
    color: rgba(255, 255, 255, 0.55);
    font-style: italic;
  }
  .chat-card-markdown p:last-child,
  .chat-card-markdown ul:last-child,
  .chat-card-markdown ol:last-child {
    margin-bottom: 0;
  }
  .chat-card-markdown ul,
  .chat-card-markdown ol {
    margin-left: 1.15rem;
  }
  .chat-answer-footer {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding-top: 0.15rem;
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.82);
  }
`;
