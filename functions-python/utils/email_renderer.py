"""
Email Rendering Module

Converts Markdown content to HTML and renders email templates.
Uses markdown library for Markdown-to-HTML conversion.
"""

from pathlib import Path

import markdown

from utils.logger import info


def markdown_to_html(markdown_text: str) -> str:
    """
    Convert Markdown text to HTML with inline styles for email compatibility.
    
    Args:
        markdown_text: Markdown-formatted text
        
    Returns:
        HTML string with inline styles
        
    Example:
        >>> markdown_to_html("**Bold text** and *italic*")
        '<p style="margin: 0 0 16px 0; color: #374151;">...'
    """
    # Convert Markdown to HTML
    # Extensions:
    # - extra: tables, fenced code blocks, footnotes
    # - nl2br: newlines become <br> tags
    html = markdown.markdown(
        markdown_text,
        extensions=['extra', 'nl2br']
    )
    
    # Apply inline styles for email compatibility
    # Email clients don't support external CSS or <style> tags well
    html = apply_email_styles(html)
    
    return html


def apply_email_styles(html: str) -> str:
    """
    Apply inline styles to HTML for email client compatibility.
    
    Replaces HTML tags with styled versions using inline CSS.
    
    Args:
        html: Plain HTML string
        
    Returns:
        HTML with inline styles
    """
    # Paragraph styles
    html = html.replace('<p>', '<p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">')
    
    # Heading styles
    html = html.replace('<h1>', '<h1 style="margin: 0 0 16px 0; font-size: 28px; font-weight: 600; color: #111827; line-height: 1.3;">')
    html = html.replace('<h2>', '<h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 600; color: #111827; line-height: 1.3;">')
    html = html.replace('<h3>', '<h3 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #111827; line-height: 1.3;">')
    html = html.replace('<h4>', '<h4 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #111827; line-height: 1.3;">')
    
    # Link styles
    html = html.replace('<a ', '<a style="color: #2563eb; text-decoration: underline;" ')
    
    # List styles
    html = html.replace('<ul>', '<ul style="margin: 0 0 16px 0; padding-left: 24px; color: #374151;">')
    html = html.replace('<ol>', '<ol style="margin: 0 0 16px 0; padding-left: 24px; color: #374151;">')
    html = html.replace('<li>', '<li style="margin-bottom: 8px; line-height: 1.6;">')
    
    # Strong/bold styles
    html = html.replace('<strong>', '<strong style="font-weight: 600; color: #111827;">')
    
    # Emphasis/italic styles
    html = html.replace('<em>', '<em style="font-style: italic;">')
    
    # Code styles
    html = html.replace('<code>', '<code style="background-color: #f3f4f6; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 14px; color: #dc2626;">')
    
    # Blockquote styles
    html = html.replace('<blockquote>', '<blockquote style="margin: 0 0 16px 0; padding: 12px 20px; border-left: 4px solid #e5e7eb; background-color: #f9fafb; color: #6b7280; font-style: italic;">')
    
    # Horizontal rule styles
    html = html.replace('<hr>', '<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">')
    
    return html


def render_email_html(title: str, body_markdown: str) -> str:
    """
    Render complete email HTML from title and Markdown body.
    
    Loads email template, converts Markdown to HTML, and injects content.
    
    Args:
        title: Email subject/title (plain text)
        body_markdown: Email body in Markdown format
        
    Returns:
        Complete HTML email ready for Mailgun
        
    Example:
        >>> html = render_email_html(
        ...     "Welcome to BossUp!",
        ...     "Hello **John**, welcome to our platform!"
        ... )
        >>> "<!DOCTYPE html>" in html
        True
    """
    info(
        "Rendering email HTML",
        {
            "title_length": len(title),
            "body_length": len(body_markdown),
        }
    )
    
    # Convert Markdown body to HTML
    body_html = markdown_to_html(body_markdown)
    
    # Load email template
    template_path = Path(__file__).parent.parent / "templates" / "email_template.html"
    
    if not template_path.exists():
        raise FileNotFoundError(f"Email template not found: {template_path}")
    
    with open(template_path, 'r', encoding='utf-8') as f:
        template = f.read()
    
    # Replace template variables
    html = template.replace('{{ title }}', title)
    html = html.replace('{{ body_html }}', body_html)
    
    info(
        "Email HTML rendered successfully",
        {"html_length": len(html)}
    )
    
    return html

