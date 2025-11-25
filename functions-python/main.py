"""
Notification Orchestrator Cloud Function

This function is triggered automatically every 2 hours to:
1. Query users from Firestore
2. Decide who needs notifications
3. Create messages in chatThreads/messages
4. Create email operations in users/{userId}/emails
"""

from typing import Any

import firebase_admin  # type: ignore
from firebase_admin import firestore  # type: ignore
from firebase_functions import scheduler_fn
from logger import error, info, warn
from sentry import init_sentry

# Initialize Sentry for error monitoring
init_sentry()


# ============================================================================
# BUSINESS LOGIC - Pure functions that can be tested independently
# ============================================================================

def process_notification_orchestration(db: Any) -> int:
    """
    Core business logic for notification orchestration.
    
    Pure function that takes db client and processes notifications.
    Can be tested independently without Cloud Function decorators.
    
    Args:
        db: Firestore client instance
        
    Returns:
        Number of users processed
    """
    info("Starting notification orchestration logic", {})
    
    # STUB: Query users (will add filtering logic later)
    users_ref = db.collection('users')  # type: ignore
    users = users_ref.limit(10).stream()  # type: ignore
    
    processed_count: int = 0
    for user_doc in users:  # type: ignore
        user_id: str = user_doc.id  # type: ignore
        user_data: dict[str, Any] | None = user_doc.to_dict()  # type: ignore
        
        if user_data is None:
            warn("User has no data, skipping", {"user_id": user_id})
            continue
        
        # STUB: Check if user is eligible for notifications
        if user_data.get('email_unsubscribed', False):  # type: ignore
            info("User is unsubscribed, skipping", {"user_id": user_id})
            continue
        
        # STUB: Notification logic placeholder
        # TODO: Add scenarios:
        # - Onboarding reminder
        # - Weekly check-in
        # - N-day silence reminder
        # - Check notification_state.last_notification_at
        # TODO: 
        # - Add logic to get and store mailgun unsubscribe list
        
        info("Processed user", {"user_id": user_id})
        processed_count += 1
    
    info("Notification orchestration completed", {"processed_count": processed_count})
    return processed_count


def create_email_document(db: Any, user_id: str, email: str, subject: str, body: str) -> str:
    """
    Create an email notification document in Firestore.
    
    Pure function that takes db client as parameter.
    
    Args:
        db: Firestore client instance
        user_id: User ID
        email: Recipient email address
        subject: Email subject
        body: Email body text
        
    Returns:
        Email document ID
    """
    email_ref = db.collection('users').document(user_id).collection('emails').document()  # type: ignore
    
    email_data: dict[str, Any] = {  # type: ignore
        'to': email,
        'subject': subject,
        'body_text': body,
        'state': 'PLANNED',
        'createdAt': firestore.SERVER_TIMESTAMP,  # type: ignore
    }
    
    email_ref.set(email_data)  # type: ignore
    info("Created email document", {"email_doc_id": email_ref.id, "user_id": user_id})  # type: ignore
    
    return email_ref.id  # type: ignore


def create_chat_message(db: Any, user_id: str, content: str) -> str:
    """
    Create a notification message in user's chat thread.
    
    Pure function that takes db client as parameter.
    
    Args:
        db: Firestore client instance
        user_id: User ID
        content: Message content
        
    Returns:
        Message document ID
    """
    thread_id = 'main'  # Single thread per user
    message_ref = (  # type: ignore
        db.collection('users')  # type: ignore
        .document(user_id)  # type: ignore
        .collection('chatThreads')  # type: ignore
        .document(thread_id)  # type: ignore
        .collection('messages')  # type: ignore
        .document()  # type: ignore
    )
    
    message_data: dict[str, Any] = {  # type: ignore
        'role': 'assistant',
        'content': [{'type': 'text', 'text': content}],
        'timestamp': firestore.SERVER_TIMESTAMP,  # type: ignore
    }
    
    message_ref.set(message_data)  # type: ignore
    info("Created message", {"message_id": message_ref.id, "user_id": user_id})  # type: ignore
    
    return message_ref.id  # type: ignore


# ============================================================================
# INFRASTRUCTURE - Cloud Function decorator wrapper
# ============================================================================

def get_firestore_client() -> Any:
    """
    Get Firestore client instance, initializing Firebase Admin if needed.
    
    Lazy initialization to avoid credential issues during module import.
    """
    if not firebase_admin._apps:  # type: ignore
        firebase_admin.initialize_app()  # type: ignore
    return firestore.client()  # type: ignore


@scheduler_fn.on_schedule(schedule="every 2 hours", region="us-central1")
def notificationOrchestrator(event: scheduler_fn.ScheduledEvent) -> None:
    """
    Cloud Function wrapper for notification orchestration.
    
    Thin wrapper that handles Cloud Function lifecycle and calls business logic.
    Triggered automatically every 2 hours by Cloud Scheduler.
    """
    try:
        db = get_firestore_client()
        process_notification_orchestration(db)
        
    except Exception as e:
        error("Error in notification orchestrator", {"error": str(e)})
        raise

