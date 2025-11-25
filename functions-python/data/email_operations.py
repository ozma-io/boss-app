"""
Email Operations for Firestore

Functions to create email documents that will be processed by TypeScript triggers.
The trigger converts Markdown to HTML, wraps in template, and sends via Mailgun.
"""

from datetime import datetime, timezone

from firebase_admin import firestore  # type: ignore

from utils.logger import info


def create_email_for_sending(
    db: firestore.Client,  # type: ignore
    user_id: str,
    to_email: str,
    subject: str,
    body_markdown: str,
) -> str:
    """
    Create email document in Firestore for async processing.
    
    TypeScript trigger will:
    1. Convert Markdown to HTML
    2. Wrap in email template
    3. Send via Mailgun
    4. Update state to SENT or FAILED
    
    Args:
        db: Firestore client instance
        user_id: User document ID
        to_email: Recipient email address
        subject: Email subject line
        body_markdown: Email body in Markdown format (from AI)
        
    Returns:
        Email document ID
        
    Example:
        >>> email_id = create_email_for_sending(
        ...     db=db,
        ...     user_id="user123",
        ...     to_email="user@example.com",
        ...     subject="Welcome to BossUp!",
        ...     body_markdown="Hello **John**, welcome!"
        ... )
        >>> email_id
        'email_abc123xyz'
    """
    info(
        "Creating email document for sending",
        {
            "user_id": user_id,
            "to_email": to_email,
            "subject": subject,
            "body_length": len(body_markdown),
        }
    )
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Create email document
    emails_ref = db.collection('users').document(user_id).collection('emails')  # type: ignore
    
    email_data = {
        'to': to_email,
        'subject': subject,
        'body_markdown': body_markdown,
        'state': 'PLANNED',
        'createdAt': now,
    }
    
    # Add document with auto-generated ID
    update_time, email_ref = emails_ref.add(email_data)  # type: ignore
    email_id: str = str(email_ref.id)  # type: ignore
    
    info(
        "Email document created successfully",
        {
            "user_id": user_id,
            "email_id": email_id,
            "to_email": to_email,
        }
    )
    
    return email_id

