"""
Firestore Data Operations

Pure functions for creating and updating Firestore documents.
All functions take db client as first parameter for dependency injection.
"""

from typing import Any

from firebase_admin import firestore  # type: ignore
from utils.logger import info


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

