"""
Notification Orchestrator Business Logic

Core business logic for notification orchestration:
1. Query users from Firestore
2. Decide who needs notifications based on various scenarios
3. Create messages and email operations

All functions are pure and take db client as parameter for testability.

USAGE:
1. Scheduled function (runs every 2 hours) - processes all eligible users
2. HTTP endpoint (triggered from web form) - sends immediate first email to new EMAIL_ONLY_USER
   Both reuse the same orchestration logic.

NOTIFICATION ORCHESTRATION FLOW:

All messages are from AI assistant persona providing personalized career coaching.
See functions/src/constants.ts (CHAT_SYSTEM_PROMPT) for AI behavior details.

STEP 1: CHOOSE CHANNEL

Decision logic:
- PUSH: if notifications_enabled=true AND fcm_token exists AND user was active in app in last 6 days (lastActivityAt)
- EMAIL: if push not available AND email_unsubscribed=false
- NO CHANNEL: if push disabled/inactive AND email_unsubscribed=true → log error to Sentry, skip user

Implementation note: Sync Mailgun unsubscribe list at function start, update Firestore email_unsubscribed flags.

STEP 2: CHOOSE SCENARIO

Each scenario defines content context, channel, and CTA:

A. EMAIL_ONLY_USER
   - Trigger: never logged into app (lastActivityAt is null)
   - Channel: EMAIL
   - Content: career coaching based on onboarding data - show value through actionable advice
   - CTA: "App is more convenient, you can ask questions to your AI, download and try it"
   - Note: First email sent immediately via HTTP endpoint when user submits web form

B. NEW_USER_PUSH
   - Trigger: logged into app within first N days (TBD) + notifications_enabled=true
   - Channel: PUSH
   - Content: early career coaching guidance, help establish good habits
   - CTA: none (user is already engaged)

C. NEW_USER_EMAIL
   - Trigger: logged into app within first N days + notifications_enabled=false
   - Channel: EMAIL
   - Content: early career coaching guidance, help establish good habits
   - CTA: "Enable notifications for better experience, promise not to spam"

D. ACTIVE_USER_PUSH
   - Trigger: regular app usage, no unread messages piling up + notifications_enabled=true
   - Channel: PUSH
   - Content: ongoing career coaching - help user grow professionally (leadership, communication skills, career development)
   - CTA: none (user is already engaged)

E. ACTIVE_USER_EMAIL
   - Trigger: regular app usage + notifications_enabled=false
   - Channel: EMAIL
   - Content: ongoing career coaching - help user grow professionally
   - CTA: "Enable notifications for better experience, promise not to spam"

F. INACTIVE_USER
   - Trigger: has unread messages AND lastActivityAt > N days ago
   - Channel: EMAIL (fallback even if notifications_enabled=true, since user is ignoring app)
   - Content: career growth advice + gentle reminder about continuing conversation in app
   - CTA: "You have unread messages in app"

STEP 3: GENERATE CONTENT

- AI generates ONLY: title + body (markdown)
- Code wraps with appropriate CTA/disclaimer based on scenario + channel

STEP 4: SEND

- Push notification via FCM
- Email via Mailgun
- Update notification_state.last_notification_at

TIMING (Progressive Intervals):
- Function runs every 2 hours
- Intervals depend on notification_count:
  * 1st notification: 1 hour after registration
  * 2nd notification: 6 hours after 1st
  * 3rd notification: 24 hours after 2nd
  * 4+ notifications: 48 hours between each
- No timezone logic needed (UTC timestamps)
"""

from datetime import datetime, timezone
from typing import Any

from firebase_admin import firestore  # type: ignore

from data.batch_models import UserChatTask, UserEmailTask
from data.chat_batch_generator import generate_chat_messages_in_parallel # type: ignore
from data.email_batch_generator import generate_emails_in_parallel # type: ignore
from data.email_operations import create_email_for_sending  # type: ignore
from data.notification_content import generate_onboarding_welcome_email  # type: ignore
from data.notification_data import sync_mailgun_unsubscribes
from orchestrators.notification_logic import (
    determine_channel,
    determine_scenario,
    should_send_notification,
)
from utils.logger import error, info, warn


def chunk_list(items: list[Any], chunk_size: int) -> list[list[Any]]:
    """
    Split a list into chunks of specified size.
    
    Args:
        items: List to split
        chunk_size: Size of each chunk
        
    Returns:
        List of chunks
    """
    chunks: list[list[Any]] = []
    for i in range(0, len(items), chunk_size):
        chunks.append(items[i:i + chunk_size])
    return chunks


def update_notification_states_batch(
    db: Any,
    user_ids: list[str]
) -> None:
    """
    Update notification_state for all successfully sent notifications.
    
    Updates:
    - notification_state.last_notification_at to current timestamp
    - notification_state.notification_count incremented by 1
    
    Uses Firestore batch API for efficiency (up to 500 updates per batch).
    
    Args:
        db: Firestore client instance
        user_ids: List of user IDs to update
    """
    if not user_ids:
        return
    
    now = datetime.now(timezone.utc).isoformat()
    chunks = chunk_list(user_ids, 500)  # Firestore batch limit
    
    info("Updating notification states in batches", {
        "total_users": len(user_ids),
        "num_batches": len(chunks),
    })
    
    for batch_idx, chunk in enumerate(chunks):
        batch = db.batch()  # type: ignore
        
        for user_id in chunk:
            user_ref = db.collection('users').document(user_id)  # type: ignore
            batch.update(user_ref, {  # type: ignore
                'notification_state.last_notification_at': now,
                'notification_state.notification_count': firestore.Increment(1),  # type: ignore
            })
        
        try:
            batch.commit()  # type: ignore
            info("Notification states batch committed", {
                "batch_index": batch_idx + 1,
                "batch_size": len(chunk),
            })
        except Exception as err:
            error("Failed to commit notification states batch", {
                "batch_index": batch_idx + 1,
                "error": str(err),
            })
            raise


def process_notification_orchestration(db: Any) -> dict[str, Any]:
    """
    Core business logic for notification orchestration.
    
    Runs every 2 hours. Implements 4-step notification flow:
    1. Query all users
    2. Filter + categorize (timing, channel, scenario)
    3. Batch generate notifications (parallel)
    4. Update notification states
    
    Pure function that takes db client and processes notifications.
    Can be tested independently without Cloud Function decorators.
    
    Args:
        db: Firestore client instance
        
    Returns:
        Statistics dict with counts of sent/failed notifications
    """
    info("=== Starting Notification Orchestration ===", {})
    
    # === STEP 0: Sync Mailgun unsubscribes ===
    info("STEP 0: Syncing Mailgun unsubscribes", {})
    try:
        unsubscribe_count = sync_mailgun_unsubscribes(db)
        info("Mailgun sync complete", {"unsubscribed_count": unsubscribe_count})
    except Exception as err:
        error("Mailgun sync failed, continuing anyway", {"error": str(err)})
    
    # === STEP 1: Query all users ===
    info("STEP 1: Querying users from Firestore", {})
    try:
        users_ref = db.collection('users')  # type: ignore
        users_snapshot = users_ref.stream()  # type: ignore
        all_users: list[tuple[str, dict[str, Any]]] = []
        
        for user_doc in users_snapshot:  # type: ignore
            user_id: str = user_doc.id  # type: ignore
            user_data = user_doc.to_dict()  # type: ignore
            
            if user_data is None:
                warn("User has no data, skipping", {"user_id": user_id})
                continue
            
            # Add user_id to data for convenience in logic functions
            user_data['id'] = user_id
            all_users.append((user_id, user_data))
        
        info("User query complete", {"total_users": len(all_users)})
    except Exception as err:
        error("Failed to query users", {"error": str(err)})
        raise
    
    # === STEP 2: Filter and categorize users ===
    info("STEP 2: Filtering and categorizing users", {})
    
    email_tasks: list[UserEmailTask] = []
    push_tasks: list[UserChatTask] = []
    skipped_timing = 0
    skipped_no_channel = 0
    
    for user_id, user_data in all_users:
        # Check if enough time has passed for next notification
        if not should_send_notification(user_data):
            skipped_timing += 1
            continue
        
        # Determine notification channel (PUSH or EMAIL)
        channel = determine_channel(user_data)
        if channel is None:
            skipped_no_channel += 1
            continue
        
        # Determine scenario based on user state and channel
        scenario = determine_scenario(db, user_id, user_data, channel)
        
        # Create appropriate task for batch processing
        if channel == 'EMAIL':
            email_tasks.append(UserEmailTask(
                user_id=user_id,
                user_email=user_data.get('email', ''),
                scenario=scenario,
            ))
        elif channel == 'PUSH':
            push_tasks.append(UserChatTask(
                user_id=user_id,
                fcm_token=user_data.get('fcmToken', ''),
                scenario=scenario,
                thread_id=None,  # Auto-detect thread
            ))
    
    info("Categorization complete", {
        "total_users": len(all_users),
        "eligible_emails": len(email_tasks),
        "eligible_pushes": len(push_tasks),
        "skipped_timing": skipped_timing,
        "skipped_no_channel": skipped_no_channel,
    })
    
    # === STEP 3a: Batch generate emails ===
    email_result = None
    if email_tasks:
        info("STEP 3a: Generating emails in parallel", {"count": len(email_tasks)})
        try:
            email_result = generate_emails_in_parallel(
                db=db,  # type: ignore
                user_tasks=email_tasks,
                batch_size=20,
                max_workers=20,
            )
            info("Email generation complete", {
                "successful": email_result.success_count,
                "failed": email_result.failure_count,
            })
        except Exception as err:
            error("Email generation failed", {"error": str(err)})
            # Continue with push notifications even if emails failed
    else:
        info("STEP 3a: No emails to generate", {})
    
    # === STEP 3b: Batch generate push notifications ===
    push_result = None
    if push_tasks:
        info("STEP 3b: Generating push messages in parallel", {"count": len(push_tasks)})
        try:
            push_result = generate_chat_messages_in_parallel(
                db=db,  # type: ignore
                user_tasks=push_tasks,
                batch_size=10,
                max_workers=10,
            )
            info("Push generation complete", {
                "successful": push_result.success_count,
                "failed": push_result.failure_count,
            })
        except Exception as err:
            error("Push generation failed", {"error": str(err)})
    else:
        info("STEP 3b: No push messages to generate", {})
    
    # === STEP 4: Update notification states ===
    info("STEP 4: Updating notification states", {})
    
    # Collect all successfully sent notifications
    successful_user_ids: list[str] = []
    if email_result:
        successful_user_ids.extend([e.user_id for e in email_result.successful])
    if push_result:
        successful_user_ids.extend([p.user_id for p in push_result.successful])
    
    if successful_user_ids:
        try:
            update_notification_states_batch(db, successful_user_ids)
            info("Notification states updated", {"count": len(successful_user_ids)})
        except Exception as err:
            error("Failed to update notification states", {"error": str(err)})
            # Don't raise - notifications were sent successfully
    else:
        info("No notification states to update", {})
    
    # === Final statistics ===
    stats = {
        "total_users": len(all_users),
        "emails_sent": email_result.success_count if email_result else 0,
        "emails_failed": email_result.failure_count if email_result else 0,
        "pushes_sent": push_result.success_count if push_result else 0,
        "pushes_failed": push_result.failure_count if push_result else 0,
        "skipped_timing": skipped_timing,
        "skipped_no_channel": skipped_no_channel,
    }
    
    info("=== Notification Orchestration Complete ===", stats)
    return stats


def send_onboarding_welcome_email(db: Any, user_id: str) -> None:
    """
    Send onboarding welcome email immediately after web funnel completion.
    
    Pure function that generates AI email content and creates Firestore email document.
    Called by Firestore trigger when chat welcome message is created (last step in funnel).
    
    IMPORTANT: This function assumes all Firebase records are already created:
    - User document (with email, name, goal, custom fields)
    - Boss document (with boss details, custom fields)
    - Timeline entries (with onboarding assessments)
    - Chat thread with welcome message
    
    The web funnel creates these in order, with chat being last, so by the time
    this trigger fires, all data is guaranteed to exist for AI context generation.
    
    Args:
        db: Firestore client instance
        user_id: User document ID
        
    Raises:
        Exception: If email generation or sending fails
    """
    info("Starting onboarding welcome email", {"user_id": user_id})
    
    try:
        # Get user document to retrieve email
        user_ref = db.collection('users').document(user_id)  # type: ignore
        user_doc = user_ref.get()  # type: ignore
        
        if not user_doc.exists:  # type: ignore
            error("User not found for onboarding email", {"user_id": user_id})
            raise ValueError(f"User not found: {user_id}")
        
        user_data = user_doc.to_dict()  # type: ignore
        if not user_data:
            error("User has no data for onboarding email", {"user_id": user_id})
            raise ValueError(f"User has no data: {user_id}")
        
        user_email = user_data.get('email')
        if not user_email:
            error("User has no email for onboarding email", {"user_id": user_id})
            raise ValueError(f"User has no email: {user_id}")
        
        # Generate email content using AI
        email_content = generate_onboarding_welcome_email(
            db=db,
            user_id=user_id,
            session_id="onboarding_funnel",
        )
        
        # Create email document in Firestore
        # TypeScript trigger will convert Markdown to HTML and send via Mailgun
        email_id = create_email_for_sending(
            db=db,
            user_id=user_id,
            to_email=user_email,
            subject=email_content.title,
            body_markdown=email_content.body,
        )
        
        info("Onboarding welcome email created successfully", {
            "user_id": user_id,
            "email_id": email_id,
        })
        
    except Exception as e:
        error("Failed to send onboarding welcome email", {
            "user_id": user_id,
            "error": str(e),
        })
        raise

