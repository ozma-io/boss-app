"""
Parallel Email Generation with Batching and Rate Limiting

Generates emails for multiple users in parallel using ThreadPoolExecutor.
Implements batching to respect OpenAI API rate limits and error isolation
to ensure one failure doesn't block the entire batch.

Key Features:
- Parallel processing with configurable concurrency
- Batch processing to avoid rate limits
- Per-user error isolation
- Firestore batch writes for efficiency
- Built-in retry logic via openai_client
"""

import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any

import sentry_sdk  # type: ignore
from firebase_admin import firestore  # type: ignore

from data.batch_models import (
    BatchGenerationResult,
    FailedGeneration,
    GeneratedEmail,
    UserEmailTask,
)
from data.notification_content import (
    generate_first_email_notification, # type: ignore
    generate_ongoing_email_notification, # type: ignore
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


def _generate_single_email(
    db: firestore.Client,  # type: ignore
    task: UserEmailTask,
) -> tuple[UserEmailTask, dict[str, Any]] | FailedGeneration:
    """
    Generate a single email for one user with full error isolation.
    
    Fetches user context, calls appropriate AI generation function based on
    scenario, and prepares email data. All errors are caught and returned
    as FailedGeneration objects to prevent one failure from blocking others.
    
    Args:
        db: Firestore client instance
        task: User email task with user_id, email, and scenario
        
    Returns:
        Tuple of (task, email_data) on success, FailedGeneration on any error
    """
    try:
        info(
            "Generating email for user",
            {
                "user_id": task.user_id,
                "scenario": task.scenario,
                "email": task.user_email,
            }
        )
        
        # Validate user context exists (required by all AI generation functions)
        # fetch_user_context is called inside the AI generation functions
        # We don't need to fetch it here, just validate the user exists
        try:
            user_ref = db.collection('users').document(task.user_id)  # type: ignore
            user_doc = user_ref.get()  # type: ignore
            if not user_doc.exists:  # type: ignore
                raise ValueError(f"User not found: {task.user_id}")
        except Exception as err:
            error_msg = f"Failed to validate user exists: {str(err)}"
            error(error_msg, {"user_id": task.user_id, "error": str(err)})
            return FailedGeneration(
                user_id=task.user_id,
                user_email=task.user_email,
                scenario=task.scenario,
                error_message=error_msg,
            )
        
        # Route to appropriate AI generation function based on scenario
        # Generate unique session ID per user (format: notification_<scenario>_<user_id>_<uuid>)
        # This ensures proper tracking in Langfuse with unique session per notification
        session_id = f"notification_{task.scenario}_{task.user_id}_{uuid.uuid4().hex[:8]}"
        
        try:
            if task.scenario == "EMAIL_ONLY_USER":
                email_content = generate_first_email_notification(
                    db=db,  # type: ignore
                    user_id=task.user_id,
                    session_id=session_id,
                )
            elif task.scenario in ["NEW_USER_EMAIL", "ACTIVE_USER_EMAIL", "INACTIVE_USER"]:
                email_content = generate_ongoing_email_notification(
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
                scope.set_extra("user_email", task.user_email)  # type: ignore
                sentry_sdk.capture_exception(err)  # type: ignore
            
            return FailedGeneration(
                user_id=task.user_id,
                user_email=task.user_email,
                scenario=task.scenario,
                error_message=error_msg,
            )
        
        # Prepare email data structure (not written yet, just prepared)
        email_data = {
            "to": task.user_email,
            "subject": email_content.title,
            "body_markdown": email_content.body,
            "state": "PLANNED",
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
        
        info(
            "Email generated successfully",
            {
                "user_id": task.user_id,
                "subject": email_content.title,
                "body_length": len(email_content.body),
            }
        )
        
        # Return task and prepared email data for batch write
        return (task, email_data)
        
    except Exception as err:
        # Catch-all for any unexpected errors
        error_msg = f"Unexpected error in email generation: {str(err)}"
        error(error_msg, {
            "user_id": task.user_id,
            "scenario": task.scenario,
            "error": str(err),
        })
        
        with sentry_sdk.push_scope() as scope:  # type: ignore
            scope.set_extra("user_id", task.user_id)  # type: ignore
            scope.set_extra("scenario", task.scenario)  # type: ignore
            sentry_sdk.capture_exception(err)  # type: ignore
        
        return FailedGeneration(
            user_id=task.user_id,
            user_email=task.user_email,
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


def _write_emails_batch(
    db: firestore.Client,  # type: ignore
    prepared_emails: list[tuple[UserEmailTask, dict[str, Any]]],
) -> list[GeneratedEmail]:
    """
    Write multiple email documents to Firestore using batch API.
    
    Uses Firestore batch writes for efficiency (up to 500 operations per batch).
    Each email document triggers TypeScript Cloud Function for sending.
    
    CRITICAL: Updates notification counters immediately after each chunk to prevent
    spam if subsequent operations fail.
    
    Args:
        db: Firestore client instance
        prepared_emails: List of (task, email_data) tuples ready for writing
        
    Returns:
        List of GeneratedEmail objects with email_id set
        
    Raises:
        Exception: If batch write fails (all or nothing)
    """
    if not prepared_emails:
        return []
    
    info(
        "Writing emails batch to Firestore",
        {"count": len(prepared_emails)}
    )
    
    # Split into chunks of 500 (Firestore batch limit)
    chunks = chunk_list(prepared_emails, 500)
    all_results: list[GeneratedEmail] = []
    
    for chunk_idx, chunk in enumerate(chunks):
        batch = db.batch()  # type: ignore
        chunk_results: list[GeneratedEmail] = []
        
        for task, email_data in chunk:
            # Create reference for new email document
            emails_ref = db.collection('users').document(task.user_id).collection('emails')  # type: ignore
            email_ref = emails_ref.document()  # type: ignore
            
            # Add to batch
            batch.set(email_ref, email_data)  # type: ignore
            
            # Store result for return
            chunk_results.append(
                GeneratedEmail(
                    user_id=task.user_id,
                    email_id=email_ref.id,  # type: ignore
                    user_email=task.user_email,
                    subject=email_data["subject"],
                )
            )
        
        # Commit batch
        try:
            batch.commit()  # type: ignore
            all_results.extend(chunk_results)
            info(
                "Batch write committed successfully",
                {
                    "chunk_index": chunk_idx + 1,
                    "chunk_size": len(chunk),
                    "total_chunks": len(chunks),
                }
            )
            
            # CRITICAL: Update notification counters immediately after successful write
            # to prevent spam if subsequent operations fail
            user_ids = [task.user_id for task, _ in chunk]
            _update_notification_counters_for_chunk(db, user_ids) # type: ignore
            
        except Exception as err:
            error(
                "Failed to commit batch write",
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
    batch_tasks: list[UserEmailTask],
    max_workers: int,
) -> tuple[list[tuple[UserEmailTask, dict[str, Any]]], list[FailedGeneration]]:
    """
    Process one batch of users in parallel using ThreadPoolExecutor.
    
    Generates email content for multiple users concurrently while respecting
    the max_workers limit to avoid overwhelming the OpenAI API.
    
    Args:
        db: Firestore client instance
        batch_tasks: List of user tasks to process in parallel
        max_workers: Maximum number of concurrent threads
        
    Returns:
        Tuple of (successful_emails, failed_generations)
        - successful_emails: List of (task, email_data) ready for batch write
        - failed_generations: List of FailedGeneration objects
    """
    successful_emails: list[tuple[UserEmailTask, dict[str, Any]]] = []
    failed_generations: list[FailedGeneration] = []
    
    info(
        "Processing batch in parallel",
        {
            "batch_size": len(batch_tasks),
            "max_workers": max_workers,
        }
    )
    
    # Use ThreadPoolExecutor for parallel processing
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all tasks
        future_to_task = {
            executor.submit(_generate_single_email, db, task): task # type: ignore
            for task in batch_tasks
        }
        
        # Collect results as they complete
        for future in as_completed(future_to_task):
            task = future_to_task[future]
            
            try:
                result = future.result()
                
                if isinstance(result, FailedGeneration):
                    failed_generations.append(result)
                    warn(
                        "Email generation failed for user",
                        {
                            "user_id": task.user_id,
                            "error": result.error_message,
                        }
                    )
                else:
                    # Success - result is (task, email_data) tuple
                    successful_emails.append(result)
                    info(
                        "Email generated for user",
                        {
                            "user_id": task.user_id,
                            "subject": result[1]["subject"],
                        }
                    )
                    
            except Exception as err:
                # Should not happen since _generate_single_email catches all errors
                error_msg = f"Unexpected error processing future: {str(err)}"
                error(error_msg, {"user_id": task.user_id, "error": str(err)})
                failed_generations.append(
                    FailedGeneration(
                        user_id=task.user_id,
                        user_email=task.user_email,
                        scenario=task.scenario,
                        error_message=error_msg,
                    )
                )
    
    return successful_emails, failed_generations


def generate_emails_in_parallel(
    db: firestore.Client,  # type: ignore
    user_tasks: list[UserEmailTask],
    batch_size: int = 10,
    max_workers: int = 10,
) -> BatchGenerationResult:
    """
    Generate emails for multiple users in parallel with batching and rate limiting.
    
    Core public API for parallel email generation. Processes users in batches
    to respect OpenAI rate limits, generates content concurrently within each
    batch, and writes results efficiently using Firestore batch API.
    
    Args:
        db: Firestore client instance
        user_tasks: List of UserEmailTask objects to process
        batch_size: Number of users to process per batch (default: 10)
        max_workers: Max concurrent threads per batch (default: 10)
        
    Returns:
        BatchGenerationResult with successful/failed lists and statistics
        
    Example:
        >>> tasks = [
        ...     UserEmailTask(
        ...         user_id="u1",
        ...         user_email="user1@example.com",
        ...         scenario="EMAIL_ONLY_USER"
        ...     ),
        ...     UserEmailTask(
        ...         user_id="u2",
        ...         user_email="user2@example.com",
        ...         scenario="NEW_USER_EMAIL"
        ...     ),
        ... ]
        >>> result = generate_emails_in_parallel(db, tasks)
        >>> print(f"Success: {result.success_count}, Failed: {result.failure_count}")
    """
    info(
        "Starting parallel email generation",
        {
            "total_users": len(user_tasks),
            "batch_size": batch_size,
            "max_workers": max_workers,
        }
    )
    
    all_successful: list[GeneratedEmail] = []
    all_failed: list[FailedGeneration] = []
    
    # Split into batches to respect rate limits
    batches = chunk_list(user_tasks, batch_size)
    
    info(
        "Processing batches",
        {
            "total_batches": len(batches),
            "batch_size": batch_size,
        }
    )
    
    for batch_idx, batch_tasks in enumerate(batches):
        info(
            "Processing batch",
            {
                "batch_index": batch_idx + 1,
                "total_batches": len(batches),
                "batch_size": len(batch_tasks),
            }
        )
        
        # Generate emails in parallel for this batch
        successful_emails, failed_generations = _generate_batch(
            db=db,  # type: ignore
            batch_tasks=batch_tasks,
            max_workers=max_workers,
        )
        
        # Write successful emails to Firestore in batch
        if successful_emails:
            try:
                written_emails = _write_emails_batch(db, successful_emails)  # type: ignore
                all_successful.extend(written_emails)
            except Exception as err:
                # If batch write fails, mark all as failed
                error(
                    "Batch write failed, marking all as failed",
                    {
                        "batch_index": batch_idx + 1,
                        "count": len(successful_emails),
                        "error": str(err),
                    }
                )
                
                for task, _ in successful_emails:
                    all_failed.append(
                        FailedGeneration(
                            user_id=task.user_id,
                            user_email=task.user_email,
                            scenario=task.scenario,
                            error_message=f"Batch write failed: {str(err)}",
                        )
                    )
        
        # Collect failed generations
        all_failed.extend(failed_generations)
    
    result = BatchGenerationResult(
        successful=all_successful,
        failed=all_failed,
        total_count=len(user_tasks),
        success_count=len(all_successful),
        failure_count=len(all_failed),
    )
    
    info(
        "Parallel email generation completed",
        {
            "total": result.total_count,
            "successful": result.success_count,
            "failed": result.failure_count,
        }
    )
    
    return result

