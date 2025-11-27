/**
 * Markdown to HTML Renderer
 * 
 * Converts Markdown to HTML with inline styles for email compatibility.
 * Uses markdown-it with custom rendering rules optimized for email clients.
 */

import MarkdownIt from 'markdown-it';

/**
 * Configure markdown-it with custom renderer rules for email inline styles
 */
function createEmailMarkdownRenderer(): MarkdownIt {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: false, // Disabled to prevent special Unicode characters (em-dash, curly quotes, etc.) in emails
  });

  // Paragraph
  md.renderer.rules.paragraph_open = (): string => {
    return '<p class="markdown-text" style="margin: 0 0 16px 0; color: #666666; font-size: 16px; line-height: 1.6; font-family: \'Manrope\', sans-serif;">';
  };
  md.renderer.rules.paragraph_close = (): string => '</p>';

  // Headings
  md.renderer.rules.heading_open = (tokens, idx): string => {
    const level = tokens[idx].tag;
    const styles: Record<string, string> = {
      h1: 'margin: 0 0 16px 0; font-size: 28px; font-weight: 700; color: #000000; line-height: 1.3; font-family: \'Manrope\', sans-serif;',
      h2: 'margin: 0 0 16px 0; font-size: 24px; font-weight: 700; color: #000000; line-height: 1.3; font-family: \'Manrope\', sans-serif;',
      h3: 'margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #000000; line-height: 1.3; font-family: \'Manrope\', sans-serif;',
      h4: 'margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #000000; line-height: 1.3; font-family: \'Manrope\', sans-serif;',
    };
    return `<${level} class="markdown-heading" style="${styles[level] || styles.h4}">`;
  };
  md.renderer.rules.heading_close = (tokens, idx): string => `</${tokens[idx].tag}>`;

  // Strong (bold)
  md.renderer.rules.strong_open = (): string => '<strong class="markdown-strong" style="font-weight: 600; color: #000000;">';
  md.renderer.rules.strong_close = (): string => '</strong>';

  // Emphasis (italic)
  md.renderer.rules.em_open = (): string => '<em style="font-style: italic;">';
  md.renderer.rules.em_close = (): string => '</em>';

  // Links
  md.renderer.rules.link_open = (tokens, idx): string => {
    const href = tokens[idx].attrGet('href') || '';
    return `<a href="${href}" class="markdown-link" style="color: #000000; text-decoration: underline;">`;
  };
  md.renderer.rules.link_close = (): string => '</a>';

  // Unordered list
  md.renderer.rules.bullet_list_open = (): string => {
    return '<ul class="markdown-list" style="margin: 0 0 16px 0; padding-left: 24px; color: #666666;">';
  };
  md.renderer.rules.bullet_list_close = (): string => '</ul>';

  // Ordered list
  md.renderer.rules.ordered_list_open = (): string => {
    return '<ol class="markdown-list" style="margin: 0 0 16px 0; padding-left: 24px; color: #666666;">';
  };
  md.renderer.rules.ordered_list_close = (): string => '</ol>';

  // List item
  md.renderer.rules.list_item_open = (): string => {
    return '<li style="margin-bottom: 8px; line-height: 1.6;">';
  };
  md.renderer.rules.list_item_close = (): string => '</li>';

  // Code inline
  md.renderer.rules.code_inline = (tokens, idx): string => {
    const content = tokens[idx].content;
    return `<code style="background-color: #f0f0f0; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 14px; color: #000000;">${content}</code>`;
  };

  // Blockquote
  md.renderer.rules.blockquote_open = (): string => {
    return '<blockquote style="margin: 0 0 16px 0; padding: 12px 20px; border-left: 4px solid #f0f0f0; background-color: #fafafa; color: #666666; font-style: italic;">';
  };
  md.renderer.rules.blockquote_close = (): string => '</blockquote>';

  // Horizontal rule
  md.renderer.rules.hr = (): string => {
    return '<hr style="border: none; border-top: 1px solid #f0f0f0; margin: 24px 0;">';
  };

  return md;
}

// Create singleton instance
const emailMarkdownRenderer = createEmailMarkdownRenderer();

/**
 * Normalize text by replacing special Unicode characters with simple ASCII equivalents
 * This prevents issues with email clients not rendering special typography correctly
 */
function normalizeText(text: string): string {
  return text
    // Replace various dash types with regular hyphen-minus
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015]/g, '-') // non-breaking hyphen, en-dash, em-dash, etc.
    // Replace various quote types with straight quotes
    .replace(/[\u2018\u2019]/g, "'") // single curly quotes
    .replace(/[\u201C\u201D]/g, '"') // double curly quotes
    // Replace ellipsis with three dots
    .replace(/\u2026/g, '...')
    // Replace various space types with regular space
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ');
}

/**
 * Convert Markdown to HTML with inline styles optimized for email clients
 */
export function markdownToHtml(markdown: string): string {
  // First normalize the text to remove special Unicode characters
  const normalizedMarkdown = normalizeText(markdown);
  return emailMarkdownRenderer.render(normalizedMarkdown);
}

