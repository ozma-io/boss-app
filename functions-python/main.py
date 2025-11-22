"""
Notification Orchestrator Cloud Function

This function is triggered by Cloud Scheduler every 2 hours to:
1. Query users from Firestore
2. Decide who needs notifications
3. Create messages in chatThreads/messages
4. Create email operations in users/{userId}/emails
"""

import logging

import firebase_admin
from firebase_admin import firestore
from firebase_functions import https_fn

# Initialize Firebase Admin
if not firebase_admin._apps:
    firebase_admin.initialize_app()

db = firestore.client()

logger = logging.getLogger(__name__)


@https_fn.on_request()
def notificationOrchestrator(req: https_fn.Request) -> https_fn.Response:
    """
    Orchestrate notification sending for all users.
    
    Called by Cloud Scheduler every 2 hours.
    Currently contains stub logic - notification scenarios to be implemented later.
    """
    try:
        logger.info("Starting notification orchestrator")
        
        # STUB: Query users (will add filtering logic later)
        users_ref = db.collection('users')
        users = users_ref.limit(10).stream()
        
        processed_count = 0
        for user_doc in users:
            user_id = user_doc.id
            user_data = user_doc.to_dict()
            
            # STUB: Check if user is eligible for notifications
            if user_data.get('email_unsubscribed', False):
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
        
        return https_fn.Response(
            response=f"Success: processed {processed_count} users",
            status=200
        )
        
    except Exception as e:
        logger.error(f"Error in notification orchestrator: {str(e)}", exc_info=True)
        return https_fn.Response(
            response=f"Error: {str(e)}",
            status=500
        )


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
    email_ref = db.collection('users').document(user_id).collection('emails').document()
    
    email_data = {
        'to': email,
        'subject': subject,
        'body_text': body,
        'state': 'PLANNED',
        'createdAt': firestore.SERVER_TIMESTAMP,
    }
    
    email_ref.set(email_data)
    logger.info(f"Created email document {email_ref.id} for user {user_id}")
    
    return email_ref.id


def create_notification_message(user_id: str, content: str) -> str:
    """
    Create a notification message in user's chat thread.
    
    Args:
        user_id: User ID
        content: Message content
        
    Returns:
        Message document ID
    """
    thread_id = 'main'  # Single thread per user
    message_ref = (
        db.collection('users')
        .document(user_id)
        .collection('chatThreads')
        .document(thread_id)
        .collection('messages')
        .document()
    )
    
    message_data = {
        'role': 'assistant',
        'content': [{'type': 'text', 'text': content}],
        'timestamp': firestore.SERVER_TIMESTAMP,
    }
    
    message_ref.set(message_data)
    logger.info(f"Created message {message_ref.id} for user {user_id}")
    
    return message_ref.id

