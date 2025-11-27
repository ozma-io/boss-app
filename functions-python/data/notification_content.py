"""
AI-Powered Notification Content Generation

Generates personalized notification content using OpenAI structured output.
Provides functions for different notification scenarios:

Email notifications:
- email_ONBOARDING_WELCOME: Sent once after web funnel completion
- email_EMAIL_ONLY_USER: For users who never logged into app (can be sent multiple times)
- email_NEW_USER_EMAIL: For new users who logged in (first 14 days)
- email_ACTIVE_USER_EMAIL: For regularly active users
- email_INACTIVE_USER: For users with unread messages (6+ days inactive)

Push notifications:
- push_NEW_USER_PUSH: For new users who logged in (first 14 days)
- push_ACTIVE_USER_PUSH: For regularly active users
- push_INACTIVE_USER: For users with unread messages (6+ days inactive)

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
    Generate email notification for EMAIL_ONLY_USER scenario.
    
    For users who never logged into app (lastActivityAt is null).
    Can be sent multiple times until user activates.
    
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
        "Generating EMAIL_ONLY_USER email notification",
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
        generation_name="email_EMAIL_ONLY_USER",
        metadata={"notification_type": "email", "scenario": "EMAIL_ONLY_USER"},
    )
    
    info(
        "EMAIL_ONLY_USER email notification generated successfully",
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
    Generate email notification for ongoing scenarios.
    
    For users who have logged into app at least once.
    Scenarios: NEW_USER_EMAIL, ACTIVE_USER_EMAIL, INACTIVE_USER
    
    Uses ONGOING_EMAIL_SYSTEM_PROMPT to create timely, relevant emails
    that reference recent activity and show continuity.
    
    Args:
        db: Firestore client instance
        user_id: User document ID
        scenario: Notification scenario name (NEW_USER_EMAIL, ACTIVE_USER_EMAIL, INACTIVE_USER)
        session_id: Optional session ID for LangFuse tracking
        
    Returns:
        EmailNotificationContent with reasoning, title, and body fields
        
    Example:
        content = generate_ongoing_email_notification(db, "user123", "ACTIVE_USER_EMAIL")
        # content.title - "How did that 1:1 with your boss go?"
        # content.body - Markdown-formatted follow-up email
        # content.reasoning - AI's chain-of-thought (not sent to user)
    """
    info(
        "Generating email notification",
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
        generation_name=f"email_{scenario}",
        metadata={"notification_type": "email", "scenario": scenario},
    )
    
    info(
        "Email notification generated successfully",
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
    Generate push notification for NEW_USER_PUSH scenario.
    
    For users who logged into app within first 14 days with PUSH channel enabled.
    Can be sent multiple times during onboarding period.
    
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
        "Generating NEW_USER_PUSH push notification",
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
        generation_name="push_NEW_USER_PUSH",
        metadata={"notification_type": "push", "scenario": "NEW_USER_PUSH"},
    )
    
    info(
        "NEW_USER_PUSH push notification generated successfully",
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
    Generate push notification for ongoing scenarios.
    
    For active users with PUSH channel enabled.
    Scenarios: ACTIVE_USER_PUSH, INACTIVE_USER
    
    Uses ONGOING_PUSH_SYSTEM_PROMPT to create timely, relevant
    push messages that reference recent activity.
    
    Args:
        db: Firestore client instance
        user_id: User document ID
        scenario: Notification scenario name (ACTIVE_USER_PUSH, INACTIVE_USER)
        session_id: Optional session ID for LangFuse tracking
        
    Returns:
        ChatNotificationContent with reasoning and message fields
        
    Example:
        content = generate_ongoing_push_notification(db, "user123", "ACTIVE_USER_PUSH")
        # content.message - "Quick question about yesterday's meeting - how'd it go?"
        # content.reasoning - AI's chain-of-thought (not sent to user)
    """
    info(
        "Generating push notification",
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
        generation_name=f"push_{scenario}",
        metadata={"notification_type": "push", "scenario": scenario},
    )
    
    info(
        "Push notification generated successfully",
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
    Generate email notification for ONBOARDING_WELCOME scenario.
    
    Sent ONCE immediately after user submits email in web funnel.
    This is reactive communication (not proactive), so it does NOT increase notification_count.
    
    Firebase records are already created (User, Boss, Timeline entries, Chat).
    Heavily emphasizes app download and references their onboarding data.
    
    Args:
        db: Firestore client instance
        user_id: User document ID
        session_id: Optional session ID for LangFuse tracking
        
    Returns:
        EmailNotificationContent with reasoning, title, and body fields
    """
    info(
        "Generating ONBOARDING_WELCOME email notification",
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
        generation_name="email_ONBOARDING_WELCOME",
        metadata={"notification_type": "email", "scenario": "ONBOARDING_WELCOME"},
    )
    
    info(
        "ONBOARDING_WELCOME email notification generated successfully",
        {
            "user_id": user_id,
            "title_length": len(content.title),
            "body_length": len(content.body),
        }
    )
    
    return content

