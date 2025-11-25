"""
Chat Operations for Firestore

Functions to add messages to user's chat thread.
Push notifications are handled automatically by Firestore triggers when new assistant messages are added.
"""

from datetime import datetime, timezone
from typing import cast

from firebase_admin import firestore  # type: ignore

from utils.logger import info


def add_assistant_message_to_chat(
    db: firestore.Client,  # type: ignore
    user_id: str,
    message_text: str,
    thread_id: str = "default",
) -> str:
    """
    Add assistant message to user's chat thread.
    
    This triggers push notification automatically via Firestore trigger.
    The trigger listens for new messages with role='assistant' and sends FCM notification.
    
    Args:
        db: Firestore client instance
        user_id: User document ID
        message_text: Message text from AI
        thread_id: Thread ID (default: "default" for MVP single thread)
        
    Returns:
        Message ID of created message
        
    Example:
        >>> message_id = add_assistant_message_to_chat(
        ...     db=db,
        ...     user_id="user123",
        ...     message_text="Hey! How did that 1:1 meeting go?"
        ... )
        >>> message_id
        'msg_abc123xyz'
    """
    info(
        "Adding assistant message to chat",
        {
            "user_id": user_id,
            "thread_id": thread_id,
            "message_length": len(message_text),
        }
    )
    
    # Get thread reference
    thread_ref = db.collection('users').document(user_id).collection('chatThreads').document(thread_id)  # type: ignore
    
    # Check if thread exists, create if not
    thread_doc = thread_ref.get()  # type: ignore
    
    now = datetime.now(timezone.utc).isoformat()
    
    if not thread_doc.exists:  # type: ignore
        # Create new thread
        thread_ref.set({  # type: ignore
            'createdAt': now,
            'updatedAt': now,
            'messageCount': 0,
            'assistantIsTyping': False,
            'unreadCount': 0,
            'lastReadAt': None,
            'lastMessageAt': None,
            'lastMessageRole': None,
        })
        info("Created new chat thread", {"user_id": user_id, "thread_id": thread_id})
    
    # Add message to thread
    messages_ref = thread_ref.collection('messages')  # type: ignore
    
    # Message document (OpenAI-compatible format)
    message_data = {
        'role': 'assistant',
        'content': [
            {
                'type': 'text',
                'text': message_text,
            }
        ],
        'timestamp': now,
    }
    
    # Add message (auto-generated ID)
    update_time, message_ref = messages_ref.add(message_data)  # type: ignore
    message_id = cast(str, message_ref.id)
    
    # Update thread metadata
    thread_ref.update({  # type: ignore
        'updatedAt': now,
        'messageCount': firestore.Increment(1),  # type: ignore
        'unreadCount': firestore.Increment(1),  # type: ignore
        'lastMessageAt': now,
        'lastMessageRole': 'assistant',
    })
    
    info(
        "Assistant message added to chat successfully",
        {
            "user_id": user_id,
            "thread_id": thread_id,
            "message_id": message_id,
        }
    )
    
    return message_id

