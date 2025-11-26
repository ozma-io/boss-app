"""
Cloud Functions Entry Points

Infrastructure layer that defines Cloud Function decorators and entry points.
All business logic is delegated to separate modules for testability.
"""

import os
from typing import Any

import firebase_admin  # type: ignore
from firebase_admin import firestore  # type: ignore
from firebase_functions import scheduler_fn, firestore_fn
from firebase_functions.params import SecretParam
from orchestrators.notification_orchestrator import (
    process_notification_orchestration,
    send_onboarding_welcome_email,
)
from utils.logger import error, info, warn
from utils.sentry import init_sentry

# Initialize Sentry for error monitoring
init_sentry()

# Define secrets
mailgun_api_key = SecretParam('MAILGUN_API_KEY')
openai_api_key = SecretParam('OPENAI_API_KEY')
langfuse_public_key = SecretParam('LANGFUSE_PUBLIC_KEY')
langfuse_secret_key = SecretParam('LANGFUSE_SECRET_KEY')


def _clean_environment_secrets() -> None:
    """
    Clean Firebase secrets from trailing newlines and whitespace.
    
    Firebase Functions secrets sometimes contain trailing newlines (\n)
    which break API authentication. This function cleans all secrets
    at the entry point before any module uses them.
    
    Called once per Cloud Function invocation before any business logic.
    """
    secrets_to_clean = [
        'MAILGUN_API_KEY',
        'OPENAI_API_KEY',
        'LANGFUSE_PUBLIC_KEY',
        'LANGFUSE_SECRET_KEY',
    ]
    
    for secret_name in secrets_to_clean:
        original_value = os.getenv(secret_name)
        if original_value:
            cleaned_value = original_value.strip()
            if original_value != cleaned_value:
                os.environ[secret_name] = cleaned_value
                warn(f"{secret_name} contained whitespace characters (cleaned)", {
                    "secret_name": secret_name,
                    "had_leading_space": original_value != original_value.lstrip(),
                    "had_trailing_space": original_value != original_value.rstrip(),
                })


def _configure_langfuse() -> None:
    """
    Configure Langfuse environment for SDK singleton.
    
    Sets Langfuse host (US region) if not already set.
    The Langfuse SDK will automatically create a singleton client
    using LANGFUSE_* environment variables when get_client() is called.
    
    Note: @observe decorator uses native Langfuse API automatically.
    """
    public_key = os.getenv("LANGFUSE_PUBLIC_KEY")
    secret_key = os.getenv("LANGFUSE_SECRET_KEY")
    
    if not public_key or not secret_key:
        warn("Langfuse keys not found - observability disabled", {
            "has_public_key": bool(public_key),
            "has_secret_key": bool(secret_key),
        })
        return
    
    # Set Langfuse host (US region) - SDK will use this automatically
    os.environ.setdefault("LANGFUSE_HOST", "https://us.cloud.langfuse.com")
    
    info("Langfuse environment configured", {
        "host": os.environ["LANGFUSE_HOST"],
        "public_key_prefix": public_key[:7] if len(public_key) > 7 else "invalid",
    })


def _initialize_cloud_function() -> None:
    """
    Initialize Cloud Function environment.
    
    Called at the start of each Cloud Function invocation to:
    1. Clean Firebase secrets from trailing whitespace/newlines
    2. Configure Langfuse SDK environment variables
    
    This ensures all modules have clean environment variables.
    """
    _clean_environment_secrets()
    _configure_langfuse()


def get_firestore_client() -> Any:
    """
    Get Firestore client instance, initializing Firebase Admin if needed.
    
    Lazy initialization to avoid credential issues during module import.
    """
    if not firebase_admin._apps:  # type: ignore
        firebase_admin.initialize_app()  # type: ignore
    return firestore.client()  # type: ignore


@scheduler_fn.on_schedule(
    schedule="every 2 hours",
    region="us-central1",
    secrets=[mailgun_api_key, openai_api_key, langfuse_public_key, langfuse_secret_key]
)
def notificationOrchestrator(event: scheduler_fn.ScheduledEvent) -> None:
    """
    Cloud Function wrapper for notification orchestration.
    
    Thin wrapper that handles Cloud Function lifecycle and calls business logic.
    Triggered automatically every 2 hours by Cloud Scheduler.
    """
    try:
        # Initialize environment (clean secrets, configure Langfuse)
        _initialize_cloud_function()
        
        db = get_firestore_client()
        process_notification_orchestration(db)
        
    except Exception as e:
        error("Error in notification orchestrator", {"error": str(e)})
        raise


@firestore_fn.on_document_created(
    document="users/{userId}/chatThreads/{threadId}/messages/{messageId}",
    region="us-central1",
    secrets=[mailgun_api_key, openai_api_key, langfuse_public_key, langfuse_secret_key]
)
def onChatMessageCreatedSendWelcomeEmail(
    event: firestore_fn.Event[firestore_fn.DocumentSnapshot | None]  # type: ignore
) -> None:
    """
    Send onboarding welcome email when chat message is created.
    
    Triggered when web funnel creates chat welcome message (final step in user creation).
    By this point, ALL Firebase records are guaranteed to exist:
    - User document
    - Boss document
    - Timeline entries
    - Chat thread + welcome message
    
    Only sends email for:
    1. First message in thread (messageCount == 1)
    2. Assistant messages (from system, not user)
    3. Users who don't have lastActivityAt (web funnel users who haven't opened app yet)
    
    This ensures we only send onboarding email to web funnel users, not app users.
    """
    try:
        # Initialize environment (clean secrets, configure Langfuse)
        _initialize_cloud_function()
        
        # Extract user ID from document path
        if not event.params:
            return
        
        user_id: str = event.params.get("userId", "")
        thread_id: str = event.params.get("threadId", "")
        
        if not user_id or not thread_id:
            return
        
        # Get message data
        message_data = event.data.to_dict() if event.data else None  # type: ignore
        if not message_data:
            return
        
        # Only trigger for assistant messages (not user messages)
        if message_data.get('role') != 'assistant':
            return
        
        # Get Firestore client
        db = get_firestore_client()
        
        # Check if this is the first message in the thread
        thread_ref = db.collection('users').document(user_id).collection('chatThreads').document(thread_id)  # type: ignore
        thread_doc = thread_ref.get()  # type: ignore
        
        if not thread_doc.exists:  # type: ignore
            return
        
        thread_data = thread_doc.to_dict()  # type: ignore
        if not thread_data:
            return
        
        # Only send email for first message (welcome message from web funnel)
        message_count = thread_data.get('messageCount', 0)
        if message_count != 1:
            return
        
        # Check if user has logged into app yet
        # If they have lastActivityAt, they signed up via app, not web funnel
        user_ref = db.collection('users').document(user_id)  # type: ignore
        user_doc = user_ref.get()  # type: ignore
        
        if not user_doc.exists:  # type: ignore
            return
        
        user_data = user_doc.to_dict()  # type: ignore
        if not user_data:
            return
        
        # Skip if user has already logged into app (has lastActivityAt)
        if user_data.get('lastActivityAt'):
            info("Skipping onboarding email - user already logged in", {"user_id": user_id})
            return
        
        # Send onboarding welcome email
        send_onboarding_welcome_email(db, user_id)
        
    except Exception as e:
        error("Error in onChatMessageCreatedSendWelcomeEmail trigger", {"error": str(e)})
        # Don't raise - we don't want to fail chat creation if email fails

