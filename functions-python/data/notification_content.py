"""
AI-Powered Notification Content Generation

Generates personalized notification content using OpenAI structured output.
Provides four main functions for different notification scenarios:
- First email notification (for EMAIL_ONLY_USER)
- Ongoing email notifications (follow-up emails)
- First push notification (for NEW_USER_PUSH)
- Ongoing push notifications (follow-up push/chat)

All functions use OpenAI structured output for type-safe, validated responses.
"""

from firebase_admin import firestore  # type: ignore

from data.notification_models import ChatNotificationContent, EmailNotificationContent
from data.notification_prompts import (
    FIRST_EMAIL_SYSTEM_PROMPT,
    FIRST_PUSH_SYSTEM_PROMPT,
    ONGOING_EMAIL_SYSTEM_PROMPT,
    ONGOING_PUSH_SYSTEM_PROMPT,
    ONBOARDING_WELCOME_EMAIL_PROMPT,
    build_notification_prompt,
)
from data.user_context import fetch_user_context, format_user_context_as_text
from utils.logger import info
from utils.openai_client import call_openai_with_structured_output


def generate_first_email_notification(
    db: firestore.Client,  # type: ignore
    user_id: str,
    session_id: str | None = None,
) -> EmailNotificationContent:
    """
    Generate first welcome email notification for new users.
    
    Uses EMAIL_ONLY_USER scenario prompt to create a warm, personalized
    introduction email that demonstrates understanding of the user's situation.
    
    Args:
        db: Firestore client instance
        user_id: User document ID
        session_id: Optional session ID for LangFuse tracking
        
    Returns:
        EmailNotificationContent with reasoning, title, and body fields
        
    Example:
        content = generate_first_email_notification(db, "user123")
        # content.title - "Welcome to BossUp, Sarah! Let's tackle that promotion goal"
        # content.body - Markdown-formatted email body
        # content.reasoning - AI's chain-of-thought (not sent to user)
    """
    info(
        "Generating first email notification",
        {"user_id": user_id, "session_id": session_id}
    )
    
    # Fetch and format user context
    context = fetch_user_context(db, user_id)
    context_text = format_user_context_as_text(context)
    
    # Build prompt
    prompt = build_notification_prompt(FIRST_EMAIL_SYSTEM_PROMPT, context_text)
    
    # Generate content with structured output
    content = call_openai_with_structured_output(
        prompt=prompt,
        response_model=EmailNotificationContent,
        user_id=user_id,
        session_id=session_id,
        generation_name="first_email_notification",
        metadata={"notification_type": "first_email"},
    )
    
    info(
        "First email notification generated successfully",
        {
            "user_id": user_id,
            "title_length": len(content.title),
            "body_length": len(content.body),
        }
    )
    
    return content


def generate_ongoing_email_notification(
    db: firestore.Client,  # type: ignore
    user_id: str,
    scenario: str,
    session_id: str | None = None,
) -> EmailNotificationContent:
    """
    Generate follow-up email notification for existing users.
    
    Uses ONGOING_EMAIL_SYSTEM_PROMPT to create timely, relevant emails
    that reference recent activity and show continuity.
    
    Args:
        db: Firestore client instance
        user_id: User document ID
        scenario: Notification scenario name (for logging/tracking)
        session_id: Optional session ID for LangFuse tracking
        
    Returns:
        EmailNotificationContent with reasoning, title, and body fields
        
    Example:
        content = generate_ongoing_email_notification(db, "user123", "weekly_checkin")
        # content.title - "How did that 1:1 with your boss go?"
        # content.body - Markdown-formatted follow-up email
        # content.reasoning - AI's chain-of-thought (not sent to user)
    """
    info(
        "Generating ongoing email notification",
        {"user_id": user_id, "scenario": scenario, "session_id": session_id}
    )
    
    # Fetch and format user context
    context = fetch_user_context(db, user_id)
    context_text = format_user_context_as_text(context)
    
    # Build prompt
    prompt = build_notification_prompt(ONGOING_EMAIL_SYSTEM_PROMPT, context_text)
    
    # Generate content with structured output
    content = call_openai_with_structured_output(
        prompt=prompt,
        response_model=EmailNotificationContent,
        user_id=user_id,
        session_id=session_id,
        generation_name=f"ongoing_email_{scenario}",
        metadata={"notification_type": "ongoing_email", "scenario": scenario},
    )
    
    info(
        "Ongoing email notification generated successfully",
        {
            "user_id": user_id,
            "scenario": scenario,
            "title_length": len(content.title),
            "body_length": len(content.body),
        }
    )
    
    return content


def generate_first_push_notification(
    db: firestore.Client,  # type: ignore
    user_id: str,
    session_id: str | None = None,
) -> ChatNotificationContent:
    """
    Generate first welcome push notification for new users.
    
    Uses NEW_USER_PUSH scenario prompt to create a warm, concise
    welcome message that sparks curiosity to open the app.
    
    Args:
        db: Firestore client instance
        user_id: User document ID
        session_id: Optional session ID for LangFuse tracking
        
    Returns:
        ChatNotificationContent with reasoning and message fields
        
    Example:
        content = generate_first_push_notification(db, "user123")
        # content.message - "Hey Sarah! I noticed your goal to get promoted. Want to talk strategy?"
        # content.reasoning - AI's chain-of-thought (not sent to user)
    """
    info(
        "Generating first push notification",
        {"user_id": user_id, "session_id": session_id}
    )
    
    # Fetch and format user context
    context = fetch_user_context(db, user_id)
    context_text = format_user_context_as_text(context)
    
    # Build prompt
    prompt = build_notification_prompt(FIRST_PUSH_SYSTEM_PROMPT, context_text)
    
    # Generate content with structured output
    content = call_openai_with_structured_output(
        prompt=prompt,
        response_model=ChatNotificationContent,
        user_id=user_id,
        session_id=session_id,
        generation_name="first_push_notification",
        metadata={"notification_type": "first_push"},
    )
    
    info(
        "First push notification generated successfully",
        {
            "user_id": user_id,
            "message_length": len(content.message),
        }
    )
    
    return content


def generate_ongoing_push_notification(
    db: firestore.Client,  # type: ignore
    user_id: str,
    scenario: str,
    session_id: str | None = None,
) -> ChatNotificationContent:
    """
    Generate follow-up push notification for existing users.
    
    Uses ONGOING_PUSH_SYSTEM_PROMPT to create timely, relevant
    push messages that reference recent activity.
    
    Args:
        db: Firestore client instance
        user_id: User document ID
        scenario: Notification scenario name (for logging/tracking)
        session_id: Optional session ID for LangFuse tracking
        
    Returns:
        ChatNotificationContent with reasoning and message fields
        
    Example:
        content = generate_ongoing_push_notification(db, "user123", "daily_checkin")
        # content.message - "Quick question about yesterday's meeting - how'd it go?"
        # content.reasoning - AI's chain-of-thought (not sent to user)
    """
    info(
        "Generating ongoing push notification",
        {"user_id": user_id, "scenario": scenario, "session_id": session_id}
    )
    
    # Fetch and format user context
    context = fetch_user_context(db, user_id)
    context_text = format_user_context_as_text(context)
    
    # Build prompt
    prompt = build_notification_prompt(ONGOING_PUSH_SYSTEM_PROMPT, context_text)
    
    # Generate content with structured output
    content = call_openai_with_structured_output(
        prompt=prompt,
        response_model=ChatNotificationContent,
        user_id=user_id,
        session_id=session_id,
        generation_name=f"ongoing_push_{scenario}",
        metadata={"notification_type": "ongoing_push", "scenario": scenario},
    )
    
    info(
        "Ongoing push notification generated successfully",
        {
            "user_id": user_id,
            "scenario": scenario,
            "message_length": len(content.message),
        }
    )
    
    return content


def generate_onboarding_welcome_email(
    db: firestore.Client,  # type: ignore
    user_id: str,
    session_id: str | None = None,
) -> EmailNotificationContent:
    """
    Generate onboarding welcome email sent immediately after funnel completion.
    
    This email is sent right after user submits email in web funnel and all
    Firebase records are created (User, Boss, Timeline entries, Chat).
    Heavily emphasizes app download and references their onboarding data.
    
    Args:
        db: Firestore client instance
        user_id: User document ID
        session_id: Optional session ID for LangFuse tracking
        
    Returns:
        EmailNotificationContent with reasoning, title, and body fields
    """
    info(
        "Generating onboarding welcome email",
        {"user_id": user_id, "session_id": session_id}
    )
    
    # Fetch and format user context
    context = fetch_user_context(db, user_id)
    context_text = format_user_context_as_text(context)
    
    # Build prompt with new onboarding-specific system prompt
    prompt = build_notification_prompt(ONBOARDING_WELCOME_EMAIL_PROMPT, context_text)
    
    # Generate content with structured output
    content = call_openai_with_structured_output(
        prompt=prompt,
        response_model=EmailNotificationContent,
        user_id=user_id,
        session_id=session_id,
        generation_name="onboarding_welcome_email",
        metadata={"notification_type": "onboarding_welcome"},
    )
    
    info(
        "Onboarding welcome email generated successfully",
        {
            "user_id": user_id,
            "title_length": len(content.title),
            "body_length": len(content.body),
        }
    )
    
    return content

