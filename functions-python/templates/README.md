# Email Templates

HTML email templates for BossUp notifications.

## Overview

This directory contains email templates used with Mailgun for sending AI-generated notification emails to users.

## Template Structure

### `email_template.html`

Main email template with the following features:

- **Responsive design** - Mobile-first approach, looks great on all devices
- **Email client compatibility** - Inline styles for Gmail, Outlook, Apple Mail
- **Mailgun integration** - Uses `%unsubscribe_url%` variable for automatic unsubscribe links
- **Clean layout** - Card-based design with proper spacing and typography

### Template Variables

The template uses simple string replacement for variables:

- `{{ title }}` - Email subject/title (plain text)
- `{{ body_html }}` - Email body content (HTML, converted from Markdown)

## Usage

### With AI-Generated Content

```python
from data.notification_content import generate_first_email_notification
from utils.email_renderer import render_email_html

# Generate content with AI
ai_content = generate_first_email_notification(db, user_id="user123")

# Convert to HTML email
html = render_email_html(
    title=ai_content.title,
    body_markdown=ai_content.body
)

# Send via Mailgun
# (see Mailgun integration code)
```

### Manual Content

```python
from utils.email_renderer import render_email_html

html = render_email_html(
    title="Welcome to BossUp!",
    body_markdown="Hello **John**, welcome to our platform!"
)
```

## Markdown Support

The body content is written in Markdown by the AI and converted to HTML with proper styling.

Supported Markdown features:

- **Headings** - `#`, `##`, `###`, etc.
- **Bold text** - `**bold**`
- **Italic text** - `*italic*`
- **Links** - `[text](url)`
- **Lists** - Bullet and numbered lists
- **Code** - Inline `code` snippets
- **Blockquotes** - `> quote`
- **Horizontal rules** - `---`

All HTML elements are styled with inline CSS for email client compatibility.

## Styling

Email styling follows these principles:

1. **Inline styles only** - External CSS not supported by most email clients
2. **Table-based layout** - Better compatibility than div-based layouts
3. **Limited color palette** - Neutral grays for professional look
4. **Mobile-first** - Proper padding and font sizes for mobile devices
5. **Accessible** - Good contrast ratios and readable font sizes

## Testing

To test the email template locally:

```bash
cd functions-python
source .venv/bin/activate
python -m utils.email_renderer_example
```

This generates HTML files in `/tmp/` that you can open in a browser to preview.

## Mailgun Integration

The template is ready for Mailgun:

- Uses `%unsubscribe_url%` variable (Mailgun replaces this automatically)
- Includes proper HTML structure required by email clients
- Compatible with Mailgun's HTML email sending API

### Sending Email via Mailgun

```python
import requests

mailgun_api_key = os.getenv("MAILGUN_API_KEY")
mailgun_domain = "mg.bossup.ai"

response = requests.post(
    f"https://api.mailgun.net/v3/{mailgun_domain}/messages",
    auth=("api", mailgun_api_key),
    data={
        "from": "BossUp <hello@bossup.ai>",
        "to": user_email,
        "subject": ai_content.title,
        "html": html,
    }
)
```

## Design Philosophy

The email template follows these design principles:

- **Simple and clean** - Focus on content, not decoration
- **Professional** - Suitable for career coaching context
- **Trustworthy** - Clear branding and unsubscribe options
- **Scannable** - Good typography and spacing for quick reading
- **Action-oriented** - Clear CTAs and next steps

## Future Improvements

Potential enhancements:

- [ ] Add BossUp logo to header
- [ ] Support for CTA buttons with custom links
- [ ] Different templates for different notification scenarios
- [ ] Dark mode support (email client dependent)
- [ ] More sophisticated Markdown styling (tables, task lists)

