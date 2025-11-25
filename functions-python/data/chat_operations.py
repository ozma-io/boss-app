"""
Chat Operations for Firestore

Functions to add messages to user's chat thread.
Push notifications are handled automatically by Firestore triggers when new assistant messages are added.
"""

from datetime import datetime, timezone
from typing import cast

import sentry_sdk  # type: ignore
from firebase_admin import firestore  # type: ignore

from utils.logger import error, info, warn


def add_assistant_message_to_chat(
    db: firestore.Client,  # type: ignore
    user_id: str,
    message_text: str,
    thread_id: str | None = None,
) -> str:
    """
    Add assistant message to user's chat thread.
    
    This triggers push notification automatically via Firestore trigger.
    The trigger listens for new messages with role='assistant' and sends FCM notification.
    
    Smart thread detection:
    - If thread_id is provided: use that specific thread
    - If thread_id is None: auto-detect threads
      - If exactly 1 thread exists: use it
      - If multiple threads exist: add message to all threads + send Sentry alert
      - If no threads exist: create new thread with ID "main"
    
    Args:
        db: Firestore client instance
        user_id: User document ID
        message_text: Message text from AI
        thread_id: Optional thread ID. If None, auto-detects threads.
        
    Returns:
        Message ID of created message (if multiple threads, returns first message ID)
        
    Example:
        >>> # Auto-detect thread
        >>> message_id = add_assistant_message_to_chat(
        ...     db=db,
        ...     user_id="user123",
        ...     message_text="Hey! How did that 1:1 meeting go?"
        ... )
        >>> message_id
        'msg_abc123xyz'
        
        >>> # Use specific thread
        >>> message_id = add_assistant_message_to_chat(
        ...     db=db,
        ...     user_id="user123",
        ...     message_text="Hey! How did that 1:1 meeting go?",
        ...     thread_id="main"
        ... )
    """
    info(
        "Adding assistant message to chat",
        {
            "user_id": user_id,
            "thread_id": thread_id,
            "message_length": len(message_text),
        }
    )
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Auto-detect threads if thread_id not provided
    if thread_id is None:
        threads_ref = db.collection('users').document(user_id).collection('chatThreads')  # type: ignore
        existing_threads = list(threads_ref.stream())  # type: ignore
        thread_count = len(existing_threads)
        
        if thread_count == 0:
            # No threads - create default "main" thread
            thread_id = "main"
            info("No threads found, creating default thread", {"user_id": user_id, "thread_id": thread_id})
            
        elif thread_count == 1:
            # Exactly one thread - use it
            thread_id = existing_threads[0].id
            info("Found single thread, using it", {"user_id": user_id, "thread_id": thread_id})
            
        else:
            # Multiple threads - this shouldn't happen in MVP, send to Sentry
            thread_ids = [thread.id for thread in existing_threads]
            
            error(
                "UNEXPECTED: User has multiple chat threads (MVP expects single thread)",
                {
                    "user_id": user_id,
                    "thread_count": thread_count,
                    "thread_ids": thread_ids,
                }
            )
            
            # Send to Sentry
            sentry_sdk.capture_message(  # type: ignore
                f"User has {thread_count} chat threads (expected 1)",
                level="error",
                extras={
                    "user_id": user_id,
                    "thread_count": thread_count,
                    "thread_ids": thread_ids,
                }
            )
            
            # Add message to ALL threads to ensure user sees it
            message_ids: list[str] = []
            for thread in existing_threads:
                tid = thread.id
                warn(f"Adding message to thread {tid}", {"user_id": user_id, "thread_id": tid})
                mid = _add_message_to_thread(db, user_id, tid, message_text, now)
                message_ids.append(mid)
            
            info(
                "Messages added to all threads",
                {
                    "user_id": user_id,
                    "thread_count": thread_count,
                    "message_ids": message_ids,
                }
            )
            
            return message_ids[0]  # Return first message ID
    
    # Add message to single thread
    message_id = _add_message_to_thread(db, user_id, thread_id, message_text, now)
    
    info(
        "Assistant message added to chat successfully",
        {
            "user_id": user_id,
            "thread_id": thread_id,
            "message_id": message_id,
        }
    )
    
    return message_id


def _add_message_to_thread(
    db: firestore.Client,  # type: ignore
    user_id: str,
    thread_id: str,
    message_text: str,
    timestamp: str,
) -> str:
    """
    Internal helper to add message to specific thread.
    
    Args:
        db: Firestore client instance
        user_id: User document ID
        thread_id: Thread document ID
        message_text: Message text from AI
        timestamp: ISO timestamp string
        
    Returns:
        Message ID of created message
    """
    # Get thread reference
    thread_ref = db.collection('users').document(user_id).collection('chatThreads').document(thread_id)  # type: ignore
    
    # Check if thread exists, create if not
    thread_doc = thread_ref.get()  # type: ignore
    
    if not thread_doc.exists:  # type: ignore
        # Create new thread
        thread_ref.set({  # type: ignore
            'createdAt': timestamp,
            'updatedAt': timestamp,
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
        'timestamp': timestamp,
    }
    
    # Add message (auto-generated ID)
    update_time, message_ref = messages_ref.add(message_data)  # type: ignore
    message_id = cast(str, message_ref.id)
    
    # Update thread metadata
    thread_ref.update({  # type: ignore
        'updatedAt': timestamp,
        'messageCount': firestore.Increment(1),  # type: ignore
        'unreadCount': firestore.Increment(1),  # type: ignore
        'lastMessageAt': timestamp,
        'lastMessageRole': 'assistant',
    })
    
    return message_id

