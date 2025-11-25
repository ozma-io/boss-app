"""
Email Renderer Usage Example

Demonstrates how to use the email renderer with AI-generated content.
"""

from data.notification_models import EmailNotificationContent
from utils.email_renderer import render_email_html


def example_render_email_from_ai_content() -> None:
    """
    Example: Convert AI-generated notification content to HTML email.
    """
    # Simulate AI-generated content (this would come from OpenAI)
    ai_content = EmailNotificationContent(
        reasoning="User is new to the platform and needs encouragement...",
        title="Welcome to BossUp, Sarah! Let's tackle that promotion goal",
        body="""Hi Sarah,

Welcome to **BossUp**! I'm excited to help you achieve your career goals.

Based on what you shared, here are some actionable steps:

1. **Schedule a 1:1 with your manager** - Discuss your career aspirations
2. **Document your wins** - Keep track of your achievements
3. **Seek feedback regularly** - This shows initiative and growth mindset

**Quick question:** When was your last performance review?

Looking forward to working with you!

Best,  
Your AI Career Coach"""
    )
    
    # Convert to HTML email
    html = render_email_html(
        title=ai_content.title,
        body_markdown=ai_content.body
    )
    
    # Save to file for preview
    with open('/tmp/email_preview.html', 'w', encoding='utf-8') as f:
        f.write(html)
    
    print("✅ Email HTML generated successfully!")
    print(f"📧 Title: {ai_content.title}")
    print(f"📝 Body length: {len(ai_content.body)} chars")
    print(f"📄 HTML length: {len(html)} chars")
    print(f"🔍 Preview saved to: /tmp/email_preview.html")


def example_markdown_features() -> None:
    """
    Example: Test various Markdown features in email rendering.
    """
    markdown_content = """# Main Heading

This is a **bold statement** and this is *italic text*.

## Features List

Here's what you can do:

- Use **bullet points** for lists
- Add [links](https://bossup.ai) easily
- Include `inline code` snippets
- Write paragraphs with proper spacing

## Numbered Steps

1. First, do this
2. Then, do that
3. Finally, wrap up

> **Pro tip:** Always follow up within 24 hours!

---

That's it for now!
"""
    
    html = render_email_html(
        title="Test Email with Markdown Features",
        body_markdown=markdown_content
    )
    
    # Save to file for preview
    with open('/tmp/email_markdown_test.html', 'w', encoding='utf-8') as f:
        f.write(html)
    
    print("✅ Markdown test email generated!")
    print("🔍 Preview saved to: /tmp/email_markdown_test.html")


if __name__ == "__main__":
    print("=== Email Renderer Examples ===\n")
    
    print("1. AI-Generated Content Example:")
    example_render_email_from_ai_content()
    
    print("\n2. Markdown Features Example:")
    example_markdown_features()

