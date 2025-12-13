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
from constants import FUNCTION_TIMEOUTS  # type: ignore
from orchestrators.notification_orchestrator import (
    process_notification_orchestration,
    send_onboarding_welcome_email,
)
from timeout_monitor import create_timeout_monitor  # type: ignore
from utils.logger import error, info, warn
from utils.sentry import init_sentry

# Initialize Sentry for error monitoring
init_sentry()

# Define secrets
mailgun_api_key = SecretParam('MAILGUN_API_KEY')
openai_api_key = SecretParam('OPENAI_API_KEY')
langfuse_public_key = SecretParam('LANGFUSE_PUBLIC_KEY')
langfuse_secret_key = SecretParam('LANGFUSE_SECRET_KEY')
amplitude_api_key = SecretParam('AMPLITUDE_API_KEY')


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
        'AMPLITUDE_API_KEY',
    ]
    
    for secret_name in secrets_to_clean:
        original_value = os.getenv(secret_name)
        if original_value:
            cleaned_value = original_value.strip()
            if original_value != cleaned_value:
                os.environ[secret_name] = cleaned_value
                info(f"{secret_name} contained whitespace characters (cleaned)", {
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
    timeout_sec=FUNCTION_TIMEOUTS['notificationOrchestrator'],  # type: ignore
    memory=512,  # 512 MB - increased from default 256 MB for parallel processing
    secrets=[mailgun_api_key, openai_api_key, langfuse_public_key, langfuse_secret_key, amplitude_api_key]
)
def notificationOrchestrator(event: scheduler_fn.ScheduledEvent) -> None:
    """
    Cloud Function wrapper for notification orchestration.
    
    Thin wrapper that handles Cloud Function lifecycle and calls business logic.
    Triggered automatically every 2 hours by Cloud Scheduler.
    
    Configuration:
    - Timeout: 30 minutes (1800s) - maximum for scheduled Cloud Functions 2nd gen
    - Memory: 512 MB for parallel AI generation and Firestore batch operations
    - Expected duration: 15-25 minutes for typical user base (see orchestrator logs)
    """
    try:
        # Initialize environment (clean secrets, configure Langfuse)
        _initialize_cloud_function()
        
        # Create timeout monitor (starts background timer automatically)
        timeout = create_timeout_monitor(FUNCTION_TIMEOUTS['notificationOrchestrator'])  # type: ignore
        timeout.check('Starting notification orchestration')
        
        db = get_firestore_client()
        process_notification_orchestration(db)
        
        # Success - cancel timeout monitor
        timeout.cancel()
        
    except Exception as e:
        # Error occurred - cancel timeout monitor
        if 'timeout' in locals():
            timeout.cancel()  # type: ignore
        error("Error in notification orchestrator", {"error": str(e)})
        raise


@firestore_fn.on_document_created(
    document="users/{userId}/chatThreads/{threadId}/messages/{messageId}",
    region="us-central1",
    timeout_sec=FUNCTION_TIMEOUTS['onChatMessageCreatedSendWelcomeEmail'],  # type: ignore
    memory=256,  # 256 MB - default is sufficient for single email
    secrets=[mailgun_api_key, openai_api_key, langfuse_public_key, langfuse_secret_key, amplitude_api_key]
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
    
    Configuration:
    - Timeout: 9 minutes (540s) - maximum for event-driven Cloud Functions 2nd gen (OpenAI timeout is 8.5 minutes)
    - Memory: 256 MB (default) - sufficient for single user processing
    """
    try:
        # Initialize environment (clean secrets, configure Langfuse)
        _initialize_cloud_function()
        
        # Create timeout monitor (starts background timer automatically)
        timeout = create_timeout_monitor(FUNCTION_TIMEOUTS['onChatMessageCreatedSendWelcomeEmail'])  # type: ignore
        
        # Extract user ID from document path
        if not event.params:
            timeout.cancel()
            return
        
        user_id: str = event.params.get("userId", "")
        thread_id: str = event.params.get("threadId", "")
        
        if not user_id or not thread_id:
            timeout.cancel()
            return
        
        # Get message data
        message_data = event.data.to_dict() if event.data else None  # type: ignore
        if not message_data:
            timeout.cancel()
            return
        
        # Only trigger for assistant messages (not user messages)
        if message_data.get('role') != 'assistant':
            timeout.cancel()
            return
        
        # Get Firestore client
        db = get_firestore_client()
        
        # Check if this is the first message in the thread
        thread_ref = db.collection('users').document(user_id).collection('chatThreads').document(thread_id)  # type: ignore
        thread_doc = thread_ref.get()  # type: ignore
        
        if not thread_doc.exists:  # type: ignore
            timeout.cancel()
            return
        
        thread_data = thread_doc.to_dict()  # type: ignore
        if not thread_data:
            timeout.cancel()
            return
        
        # Only send email for first message (welcome message from web funnel)
        message_count = thread_data.get('messageCount', 0)
        if message_count != 1:
            timeout.cancel()
            return
        
        # Check if user has logged into app yet
        # If they have lastActivityAt, they signed up via app, not web funnel
        user_ref = db.collection('users').document(user_id)  # type: ignore
        user_doc = user_ref.get()  # type: ignore
        
        if not user_doc.exists:  # type: ignore
            timeout.cancel()
            return
        
        user_data = user_doc.to_dict()  # type: ignore
        if not user_data:
            timeout.cancel()
            return
        
        # Skip if user has already logged into app (has lastActivityAt)
        if user_data.get('lastActivityAt'):
            info("Skipping onboarding email - user already logged in", {"user_id": user_id})
            timeout.cancel()
            return
        
        timeout.check('Sending onboarding welcome email')
        
        # Send onboarding welcome email
        send_onboarding_welcome_email(db, user_id)
        
        # Success - cancel timeout monitor
        timeout.cancel()
        
    except Exception as e:
        # Error occurred - cancel timeout monitor
        if 'timeout' in locals():
            timeout.cancel()  # type: ignore
        error("Error in onChatMessageCreatedSendWelcomeEmail trigger", {"error": str(e)})
        # Don't raise - we don't want to fail chat creation if email fails

