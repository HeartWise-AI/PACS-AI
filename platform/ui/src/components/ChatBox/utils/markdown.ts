/**
 * Utility function to parse markdown text to HTML
 */
export function parseMarkdown(text: string): string {
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
  const orderedListItems: string[] = [];
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
