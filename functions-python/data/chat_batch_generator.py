"""
Parallel Chat Message Generation with Batching and Rate Limiting

Generates chat messages for multiple users in parallel using ThreadPoolExecutor.
Messages trigger push notifications automatically via Firestore triggers.

Implements batching to respect OpenAI rate limits and error isolation
to ensure one failure doesn't block the entire batch.

Key Features:
- Parallel processing with configurable concurrency
- Batch processing to avoid rate limits
- Per-user error isolation
- Firestore batch writes for efficiency
- Built-in retry logic via openai_client
- Automatic push notifications via triggers
"""

import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any

import sentry_sdk  # type: ignore
from firebase_admin import firestore  # type: ignore

from data.batch_models import (
    ChatBatchGenerationResult,
    FailedChatGeneration,
    GeneratedChatMessage,
    UserChatTask,
)
from data.notification_content import (
    generate_first_push_notification,  # type: ignore
    generate_ongoing_push_notification,  # type: ignore
)
from utils.logger import error, info, warn


def chunk_list(items: list[Any], chunk_size: int) -> list[list[Any]]:
    """
    Split a list into chunks of specified size.
    
    Pure utility function for batching operations.
    
    Args:
        items: List to split into chunks
        chunk_size: Maximum size of each chunk
        
    Returns:
        List of chunks (each chunk is a list)
        
    Example:
        >>> chunk_list([1, 2, 3, 4, 5], 2)
        [[1, 2], [3, 4], [5]]
    """
    chunks: list[list[Any]] = []
    for i in range(0, len(items), chunk_size):
        chunks.append(items[i:i + chunk_size])
    return chunks


def _generate_single_chat_message(
    db: firestore.Client,  # type: ignore
    task: UserChatTask,
) -> tuple[UserChatTask, dict[str, Any]] | FailedChatGeneration:
    """
    Generate a single chat message for one user with full error isolation.
    
    Fetches user context, calls appropriate AI generation function based on
    scenario, and prepares message data. All errors are caught and returned
    as FailedChatGeneration objects to prevent one failure from blocking others.
    
    Args:
        db: Firestore client instance
        task: User chat task with user_id, fcm_token, and scenario
        
    Returns:
        Tuple of (task, message_data) on success, FailedChatGeneration on any error
    """
    try:
        info(
            "Generating chat message for user",
            {
                "user_id": task.user_id,
                "scenario": task.scenario,
                "thread_id": task.thread_id,
            }
        )
        
        # Validate user exists (AI generation functions will fetch full context)
        try:
            user_ref = db.collection('users').document(task.user_id)  # type: ignore
            user_doc = user_ref.get()  # type: ignore
            if not user_doc.exists:  # type: ignore
                raise ValueError(f"User not found: {task.user_id}")
        except Exception as err:
            error_msg = f"Failed to validate user exists: {str(err)}"
            error(error_msg, {"user_id": task.user_id, "error": str(err)})
            return FailedChatGeneration(
                user_id=task.user_id,
                fcm_token=task.fcm_token,
                scenario=task.scenario,
                error_message=error_msg,
            )
        
        # Route to appropriate AI generation function based on scenario
        # Generate unique session ID per user (format: notification_<scenario>_<user_id>_<uuid>)
        # This ensures proper tracking in Langfuse with unique session per notification
        session_id = f"notification_{task.scenario}_{task.user_id}_{uuid.uuid4().hex[:8]}"
        
        try:
            if task.scenario == "NEW_USER_PUSH":
                chat_content = generate_first_push_notification(
                    db=db,  # type: ignore
                    user_id=task.user_id,
                    session_id=session_id,
                )
            elif task.scenario in ["ACTIVE_USER_PUSH"]:
                chat_content = generate_ongoing_push_notification(
                    db=db,  # type: ignore
                    user_id=task.user_id,
                    scenario=task.scenario,
                    session_id=session_id,
                )
            else:
                raise ValueError(f"Unknown scenario: {task.scenario}")
        except Exception as err:
            error_msg = f"Failed to generate AI content: {str(err)}"
            error(error_msg, {
                "user_id": task.user_id,
                "scenario": task.scenario,
                "error": str(err),
            })
            
            # Capture in Sentry with context
            with sentry_sdk.push_scope() as scope:  # type: ignore
                scope.set_extra("user_id", task.user_id)  # type: ignore
                scope.set_extra("scenario", task.scenario)  # type: ignore
                scope.set_extra("fcm_token", task.fcm_token)  # type: ignore
                sentry_sdk.capture_exception(err)  # type: ignore
            
            return FailedChatGeneration(
                user_id=task.user_id,
                fcm_token=task.fcm_token,
                scenario=task.scenario,
                error_message=error_msg,
            )
        
        # Prepare message data structure (OpenAI-compatible format)
        # Note: thread_id will be determined during write phase
        message_data = {
            "role": "assistant",
            "content": [
                {
                    "type": "text",
                    "text": chat_content.message,
                }
            ],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        
        info(
            "Chat message generated successfully",
            {
                "user_id": task.user_id,
                "message_length": len(chat_content.message),
                "message_preview": chat_content.message[:50],
            }
        )
        
        # Return task and prepared message data for batch write
        return (task, message_data)
        
    except Exception as err:
        # Catch-all for any unexpected errors
        error_msg = f"Unexpected error in chat message generation: {str(err)}"
        error(error_msg, {
            "user_id": task.user_id,
            "scenario": task.scenario,
            "error": str(err),
        })
        
        with sentry_sdk.push_scope() as scope:  # type: ignore
            scope.set_extra("user_id", task.user_id)  # type: ignore
            scope.set_extra("scenario", task.scenario)  # type: ignore
            sentry_sdk.capture_exception(err)  # type: ignore
        
        return FailedChatGeneration(
            user_id=task.user_id,
            fcm_token=task.fcm_token,
            scenario=task.scenario,
            error_message=error_msg,
        )


def _update_notification_counters_for_chunk(
    db: firestore.Client,  # type: ignore
    user_ids: list[str],
) -> None:
    """
    Update notification counters for a chunk of users.
    
    CRITICAL: This must be called immediately after successfully writing messages
    to prevent spam if subsequent operations fail.
    
    Args:
        db: Firestore client instance
        user_ids: List of user IDs to update (from one chunk)
    """
    if not user_ids:
        return
    
    from datetime import datetime, timezone
    
    now = datetime.now(timezone.utc).isoformat()
    batch = db.batch()  # type: ignore
    
    for user_id in user_ids:
        user_ref = db.collection('users').document(user_id)  # type: ignore
        batch.update(user_ref, {  # type: ignore
            'notification_state.last_notification_at': now,
            'notification_state.notification_count': firestore.Increment(1),  # type: ignore
        })
    
    try:
        batch.commit()  # type: ignore
        info(
            "Notification counters updated for chunk",
            {"count": len(user_ids)}
        )
    except Exception as err:
        # CRITICAL: Log to Sentry but don't raise
        # Messages already sent - better to skip counter update than spam users
        error(
            "CRITICAL: Failed to update notification counters (messages already sent)",
            {
                "user_count": len(user_ids),
                "error": str(err),
            }
        )
        
        with sentry_sdk.push_scope() as scope:  # type: ignore
            scope.set_extra("user_count", len(user_ids))  # type: ignore
            scope.set_extra("user_ids_sample", user_ids[:10])  # type: ignore
            scope.set_level("error")  # type: ignore
            sentry_sdk.capture_message(  # type: ignore
                "Failed to update notification counters after sending messages",
                level="error"
            )


def _write_chat_messages_batch(
    db: firestore.Client,  # type: ignore
    prepared_messages: list[tuple[UserChatTask, dict[str, Any]]],
) -> list[GeneratedChatMessage]:
    """
    Write multiple chat message documents to Firestore using batch API.
    
    Uses Firestore batch writes for efficiency (up to 500 operations per batch).
    Each message document triggers Firestore Cloud Function for push notification.
    
    CRITICAL: Updates notification counters immediately after each chunk to prevent
    spam if subsequent operations fail.
    
    Handles thread detection logic:
    - If thread_id specified in task: use it
    - If thread_id is None: use "main" thread (default)
    - Creates thread if it doesn't exist
    
    Pre-checks thread existence to optimize batch operations:
    - Checks all threads once before batch write
    - Creates missing threads efficiently
    - Each message requires 2 operations (set message + update thread)
    - New threads require 3 operations (set thread + set message + update thread)
    - Safe batch size: 250 messages (worst case: 250 × 3 = 750, but realistically much less)
    
    Args:
        db: Firestore client instance
        prepared_messages: List of (task, message_data) tuples ready for writing
        
    Returns:
        List of GeneratedChatMessage objects with message_id and thread_id set
        
    Raises:
        Exception: If batch write fails (all or nothing)
    """
    if not prepared_messages:
        return []
    
    info(
        "Writing chat messages batch to Firestore",
        {"count": len(prepared_messages)}
    )
    
    # Split into chunks of 250 (conservative for thread updates)
    chunks = chunk_list(prepared_messages, 250)
    all_results: list[GeneratedChatMessage] = []
    
    for chunk_idx, chunk in enumerate(chunks):
        # === STEP 1: Pre-check thread existence for all messages in chunk ===
        info(
            "Pre-checking thread existence",
            {
                "chunk_index": chunk_idx + 1,
                "chunk_size": len(chunk),
            }
        )
        
        # Build map of (user_id, thread_id) -> thread_ref and check existence
        thread_refs: dict[tuple[str, str], Any] = {}
        thread_exists: dict[tuple[str, str], bool] = {}
        
        for task, message_data in chunk:
            thread_id = task.thread_id if task.thread_id else "main"
            key = (task.user_id, thread_id)
            
            # Skip if already checked
            if key in thread_exists:
                continue
            
            # Get thread reference
            thread_ref = (  # type: ignore
                db.collection('users')  # type: ignore
                .document(task.user_id)  # type: ignore
                .collection('chatThreads')  # type: ignore
                .document(thread_id)  # type: ignore
            )
            thread_refs[key] = thread_ref
            
            # Check if thread exists
            thread_doc = thread_ref.get()  # type: ignore
            thread_exists[key] = thread_doc.exists  # type: ignore
        
        # Count how many new threads we need to create
        new_threads_count = sum(1 for exists in thread_exists.values() if not exists)
        info(
            "Thread existence check complete",
            {
                "total_threads": len(thread_exists),
                "existing_threads": len(thread_exists) - new_threads_count,
                "new_threads": new_threads_count,
                "estimated_operations": len(chunk) * 2 + new_threads_count,
            }
        )
        
        # === STEP 2: Build batch with all operations ===
        batch = db.batch()  # type: ignore
        chunk_results: list[GeneratedChatMessage] = []
        
        for task, message_data in chunk:
            thread_id = task.thread_id if task.thread_id else "main"
            key = (task.user_id, thread_id)
            thread_ref = thread_refs[key]
            
            # Create thread if it doesn't exist (only once per unique thread)
            if not thread_exists[key]:
                batch.set(thread_ref, {  # type: ignore
                    'createdAt': message_data['timestamp'],
                    'updatedAt': message_data['timestamp'],
                    'messageCount': 0,
                    'assistantIsTyping': False,
                    'unreadCount': 0,
                    'lastReadAt': None,
                    'lastMessageAt': None,
                    'lastMessageRole': None,
                })
                # Mark as created so we don't create it again in this batch
                thread_exists[key] = True
            
            # Create message reference
            messages_ref = thread_ref.collection('messages')  # type: ignore
            message_ref = messages_ref.document()  # type: ignore
            
            # Add message to batch
            batch.set(message_ref, message_data)  # type: ignore
            
            # Update thread metadata in batch
            batch.update(thread_ref, {  # type: ignore
                'updatedAt': message_data['timestamp'],
                'messageCount': firestore.Increment(1),  # type: ignore
                'unreadCount': firestore.Increment(1),  # type: ignore
                'lastMessageAt': message_data['timestamp'],
                'lastMessageRole': 'assistant',
            })
            
            # Store result for return
            message_preview = message_data['content'][0]['text'][:50]
            chunk_results.append(
                GeneratedChatMessage(
                    user_id=task.user_id,
                    message_id=message_ref.id,  # type: ignore
                    thread_id=thread_id,
                    message_preview=message_preview,
                )
            )
        
        # === STEP 3: Commit batch ===
        try:
            batch.commit()  # type: ignore
            all_results.extend(chunk_results)
            info(
                "Chat messages batch write committed successfully",
                {
                    "chunk_index": chunk_idx + 1,
                    "chunk_size": len(chunk),
                    "total_chunks": len(chunks),
                    "new_threads_created": new_threads_count,
                }
            )
            
            # CRITICAL: Update notification counters immediately after successful write
            # to prevent spam if subsequent operations fail
            user_ids = [task.user_id for task, _ in chunk]
            _update_notification_counters_for_chunk(db, user_ids) # type: ignore
            
        except Exception as err:
            error(
                "Failed to commit chat messages batch write",
                {
                    "chunk_index": chunk_idx + 1,
                    "chunk_size": len(chunk),
                    "error": str(err),
                }
            )
            raise
    
    return all_results


def _generate_batch(
    db: firestore.Client,  # type: ignore
    batch_tasks: list[UserChatTask],
    max_workers: int,
) -> tuple[list[tuple[UserChatTask, dict[str, Any]]], list[FailedChatGeneration]]:
    """
    Process one batch of users in parallel using ThreadPoolExecutor.
    
    Generates chat message content for multiple users concurrently while respecting
    the max_workers limit to avoid overwhelming the OpenAI API.
    
    Args:
        db: Firestore client instance
        batch_tasks: List of user tasks to process in parallel
        max_workers: Maximum number of concurrent threads
        
    Returns:
        Tuple of (successful_messages, failed_generations)
        - successful_messages: List of (task, message_data) ready for batch write
        - failed_generations: List of FailedChatGeneration objects
    """
    successful_messages: list[tuple[UserChatTask, dict[str, Any]]] = []
    failed_generations: list[FailedChatGeneration] = []
    
    info(
        "Processing chat message batch in parallel",
        {
            "batch_size": len(batch_tasks),
            "max_workers": max_workers,
        }
    )
    
    # Use ThreadPoolExecutor for parallel processing
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all tasks
        future_to_task = {
            executor.submit(_generate_single_chat_message, db, task): task  # type: ignore
            for task in batch_tasks
        }
        
        # Collect results as they complete
        for future in as_completed(future_to_task):
            task = future_to_task[future]
            
            try:
                result = future.result()
                
                if isinstance(result, FailedChatGeneration):
                    failed_generations.append(result)
                    warn(
                        "Chat message generation failed for user",
                        {
                            "user_id": task.user_id,
                            "error": result.error_message,
                        }
                    )
                else:
                    # Success - result is (task, message_data) tuple
                    successful_messages.append(result)
                    info(
                        "Chat message generated for user",
                        {
                            "user_id": task.user_id,
                            "message_preview": result[1]['content'][0]['text'][:50],
                        }
                    )
                    
            except Exception as err:
                # Should not happen since _generate_single_chat_message catches all errors
                error_msg = f"Unexpected error processing future: {str(err)}"
                error(error_msg, {"user_id": task.user_id, "error": str(err)})
                failed_generations.append(
                    FailedChatGeneration(
                        user_id=task.user_id,
                        fcm_token=task.fcm_token,
                        scenario=task.scenario,
                        error_message=error_msg,
                    )
                )
    
    return successful_messages, failed_generations


def generate_chat_messages_in_parallel(
    db: firestore.Client,  # type: ignore
    user_tasks: list[UserChatTask],
    batch_size: int = 10,
    max_workers: int = 10,
) -> ChatBatchGenerationResult:
    """
    Generate chat messages for multiple users in parallel with batching and rate limiting.
    
    Core public API for parallel chat message generation. Processes users in batches
    to respect OpenAI rate limits, generates content concurrently within each
    batch, and writes results efficiently using Firestore batch API.
    
    Push notifications are sent automatically by Firestore trigger when assistant
    messages are created.
    
    Args:
        db: Firestore client instance
        user_tasks: List of UserChatTask objects to process
        batch_size: Number of users to process per batch (default: 15)
        max_workers: Max concurrent threads per batch (default: 15)
        
    Returns:
        ChatBatchGenerationResult with successful/failed lists and statistics
        
    Example:
        >>> tasks = [
        ...     UserChatTask(
        ...         user_id="u1",
        ...         fcm_token="token1",
        ...         scenario="NEW_USER_PUSH"
        ...     ),
        ...     UserChatTask(
        ...         user_id="u2",
        ...         fcm_token="token2",
        ...         scenario="ACTIVE_USER_PUSH",
        ...         thread_id="main"
        ...     ),
        ... ]
        >>> result = generate_chat_messages_in_parallel(db, tasks)
        >>> print(f"Success: {result.success_count}, Failed: {result.failure_count}")
    """
    info(
        "Starting parallel chat message generation",
        {
            "total_users": len(user_tasks),
            "batch_size": batch_size,
            "max_workers": max_workers,
        }
    )
    
    all_successful: list[GeneratedChatMessage] = []
    all_failed: list[FailedChatGeneration] = []
    
    # Split into batches to respect rate limits
    batches = chunk_list(user_tasks, batch_size)
    
    info(
        "Processing chat message batches",
        {
            "total_batches": len(batches),
            "batch_size": batch_size,
        }
    )
    
    for batch_idx, batch_tasks in enumerate(batches):
        info(
            "Processing chat message batch",
            {
                "batch_index": batch_idx + 1,
                "total_batches": len(batches),
                "batch_size": len(batch_tasks),
            }
        )
        
        # Generate chat messages in parallel for this batch
        successful_messages, failed_generations = _generate_batch(
            db=db,  # type: ignore
            batch_tasks=batch_tasks,
            max_workers=max_workers,
        )
        
        # Write successful messages to Firestore in batch
        if successful_messages:
            try:
                written_messages = _write_chat_messages_batch(db, successful_messages)  # type: ignore
                all_successful.extend(written_messages)
            except Exception as err:
                # If batch write fails, mark all as failed
                error(
                    "Chat messages batch write failed, marking all as failed",
                    {
                        "batch_index": batch_idx + 1,
                        "count": len(successful_messages),
                        "error": str(err),
                    }
                )
                
                for task, _ in successful_messages:
                    all_failed.append(
                        FailedChatGeneration(
                            user_id=task.user_id,
                            fcm_token=task.fcm_token,
                            scenario=task.scenario,
                            error_message=f"Batch write failed: {str(err)}",
                        )
                    )
        
        # Collect failed generations
        all_failed.extend(failed_generations)
    
    result = ChatBatchGenerationResult(
        successful=all_successful,
        failed=all_failed,
        total_count=len(user_tasks),
        success_count=len(all_successful),
        failure_count=len(all_failed),
    )
    
    info(
        "Parallel chat message generation completed",
        {
            "total": result.total_count,
            "successful": result.success_count,
            "failed": result.failure_count,
        }
    )
    
    return result

