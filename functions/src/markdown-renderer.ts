/**
 * Markdown to HTML Renderer
 * 
 * Converts Markdown to HTML with inline styles for email compatibility.
 * Uses a lightweight, zero-dependency approach suitable for email clients.
 */

/**
 * Convert Markdown to HTML with inline styles
 */
export function markdownToHtml(markdown: string): string {
  let html = markdown;

  // Headers (must be done before paragraphs)
  html = html.replace(/^#### (.+)$/gm, '<h4 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #111827; line-height: 1.3;">$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #111827; line-height: 1.3;">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 600; color: #111827; line-height: 1.3;">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 style="margin: 0 0 16px 0; font-size: 28px; font-weight: 600; color: #111827; line-height: 1.3;">$1</h1>');

  // Bold and italic (must be done before other inline elements)
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong style="font-weight: 600; color: #111827;"><em style="font-style: italic;">$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight: 600; color: #111827;">$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em style="font-style: italic;">$1</em>');

  // Links
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color: #2563eb; text-decoration: underline;">$1</a>');

  // Inline code
  html = html.replace(/`(.+?)`/g, '<code style="background-color: #f3f4f6; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 14px; color: #dc2626;">$1</code>');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">');

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li style="margin-bottom: 8px; line-height: 1.6;">$1</li>');
  html = html.replace(/(<li[^>]*>.*<\/li>)/s, (match) => {
    return '<ul style="margin: 0 0 16px 0; padding-left: 24px; color: #374151;">' + match + '</ul>';
  });

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li style="margin-bottom: 8px; line-height: 1.6;">$1</li>');
  // Note: This regex won't perfectly handle ordered lists, but it's a reasonable approximation
  // For production use, consider using a proper markdown library like 'marked'

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote style="margin: 0 0 16px 0; padding: 12px 20px; border-left: 4px solid #e5e7eb; background-color: #f9fafb; color: #6b7280; font-style: italic;">$1</blockquote>');

  // Paragraphs (last to avoid breaking other elements)
  // Split by double newlines, wrap non-tag content in <p>
  const lines = html.split('\n\n');
  html = lines
    .map((line) => {
      const trimmed = line.trim();
      // Don't wrap if it's already a block element
      if (
        trimmed.startsWith('<h') ||
        trimmed.startsWith('<ul') ||
        trimmed.startsWith('<ol') ||
        trimmed.startsWith('<blockquote') ||
        trimmed.startsWith('<hr') ||
        trimmed.length === 0
      ) {
        return trimmed;
      }
      // Replace single newlines with <br> within paragraphs
      const withBreaks = trimmed.replace(/\n/g, '<br>');
      return `<p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">${withBreaks}</p>`;
    })
    .join('\n');

  return html;
}

