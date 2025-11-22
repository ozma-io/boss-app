"""
Notification Orchestrator Cloud Function

This function is triggered automatically every 2 hours to:
1. Query users from Firestore
2. Decide who needs notifications
3. Create messages in chatThreads/messages
4. Create email operations in users/{userId}/emails
"""

import logging
from typing import Any

import firebase_admin  # type: ignore
from firebase_admin import firestore  # type: ignore
from firebase_functions import scheduler_fn

logger = logging.getLogger(__name__)


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
    Orchestrate notification sending for all users.
    
    Triggered automatically every 2 hours by Cloud Scheduler.
    Currently contains stub logic - notification scenarios to be implemented later.
    """
    try:
        logger.info("Starting notification orchestrator")
        
        db = get_firestore_client()
        
        # STUB: Query users (will add filtering logic later)
        users_ref = db.collection('users')  # type: ignore
        users = users_ref.limit(10).stream()  # type: ignore
        
        processed_count: int = 0
        for user_doc in users:  # type: ignore
            user_id: str = user_doc.id  # type: ignore
            user_data: dict[str, Any] | None = user_doc.to_dict()  # type: ignore
            
            if user_data is None:
                logger.warning(f"User {user_id} has no data, skipping")
                continue
            
            # STUB: Check if user is eligible for notifications
            if user_data.get('email_unsubscribed', False):  # type: ignore
                logger.info(f"User {user_id} is unsubscribed, skipping")
                continue
            
            # STUB: Notification logic placeholder
            # TODO: Add scenarios:
            # - Onboarding reminder
            # - Weekly check-in
            # - N-day silence reminder
            # - Check notification_state.last_notification_at
            # TODO: 
            # - Add sentry
            # - Add logic to get and store mailgun unsubscribe list
            
            logger.info(f"Processed user {user_id}")
            processed_count += 1
        
        logger.info(f"Notification orchestrator completed. Processed {processed_count} users")
        
    except Exception as e:
        logger.error(f"Error in notification orchestrator: {str(e)}", exc_info=True)
        raise


def create_notification_email(user_id: str, email: str, subject: str, body: str) -> str:
    """
    Create an email notification document in Firestore.
    
    Args:
        user_id: User ID
        email: Recipient email address
        subject: Email subject
        body: Email body text
        
    Returns:
        Email document ID
    """
    db = get_firestore_client()
    email_ref = db.collection('users').document(user_id).collection('emails').document()  # type: ignore
    
    email_data: dict[str, Any] = {  # type: ignore
        'to': email,
        'subject': subject,
        'body_text': body,
        'state': 'PLANNED',
        'createdAt': firestore.SERVER_TIMESTAMP,  # type: ignore
    }
    
    email_ref.set(email_data)  # type: ignore
    logger.info(f"Created email document {email_ref.id} for user {user_id}")  # type: ignore
    
    return email_ref.id  # type: ignore


def create_notification_message(user_id: str, content: str) -> str:
    """
    Create a notification message in user's chat thread.
    
    Args:
        user_id: User ID
        content: Message content
        
    Returns:
        Message document ID
    """
    db = get_firestore_client()
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
    logger.info(f"Created message {message_ref.id} for user {user_id}")  # type: ignore
    
    return message_ref.id  # type: ignore

