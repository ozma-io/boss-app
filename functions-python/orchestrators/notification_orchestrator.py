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
- PUSH: if notifications_enabled=true AND fcm_token exists
- EMAIL: if no PUSH available AND email_unsubscribed=false
- NO CHANNEL: if no channel available → log error to Sentry, skip user

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
   - Trigger: logged into app within first N days (TBD)
   - Channel: PUSH
   - Content: early career coaching guidance, help establish good habits
   - CTA: none (user is already engaged)

C. NEW_USER_EMAIL
   - Trigger: logged into app within first N days
   - Channel: EMAIL
   - Content: early career coaching guidance, help establish good habits
   - CTA: "Enable notifications for better experience, promise not to spam"

D. ACTIVE_USER_PUSH
   - Trigger: regular app usage
   - Channel: PUSH
   - Content: ongoing career coaching - help user grow professionally (leadership, communication skills, career development)
   - CTA: none (user is already engaged)

E. ACTIVE_USER_EMAIL
   - Trigger: regular app usage
   - Channel: EMAIL
   - Content: ongoing career coaching - help user grow professionally
   - CTA: "Enable notifications for better experience, promise not to spam"

F. INACTIVE_USER
   - Trigger: has unread messages AND lastActivityAt > 6 days ago
   - Channel: EMAIL (only available when there are unread messages to follow up on)
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

import uuid
from datetime import datetime, timezone
from typing import Any

import sentry_sdk  # type: ignore

from data.batch_models import UserChatTask, UserEmailTask
from data.chat_batch_generator import generate_chat_messages_in_parallel # type: ignore
from data.email_batch_generator import generate_emails_in_parallel # type: ignore
from data.email_operations import create_email_for_sending  # type: ignore
from data.notification_content import generate_onboarding_welcome_email  # type: ignore
from data.notification_data import sync_mailgun_unsubscribes
from orchestrators.notification_logic import (
    determine_channel,
    determine_scenario,
    get_unread_count,
    should_send_notification,
)
from utils.logger import error, info, warn


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
    start_time = datetime.now(timezone.utc)
    slow_execution_alerted = False
    max_duration_minutes = 20
    
    def check_execution_time(step_name: str) -> None:
        """Check if execution time exceeds threshold and alert to Sentry once."""
        nonlocal slow_execution_alerted
        
        if slow_execution_alerted:
            return
        
        elapsed = datetime.now(timezone.utc) - start_time
        elapsed_minutes = elapsed.total_seconds() / 60
        
        if elapsed_minutes >= max_duration_minutes:
            warn(
                f"Notification orchestration is running slowly (>{max_duration_minutes}min)",
                {
                    "elapsed_minutes": round(elapsed_minutes, 2),
                    "current_step": step_name,
                }
            )
            
            with sentry_sdk.push_scope() as scope:  # type: ignore
                scope.set_extra("elapsed_minutes", round(elapsed_minutes, 2))  # type: ignore
                scope.set_extra("current_step", step_name)  # type: ignore
                scope.set_extra("max_duration_minutes", max_duration_minutes)  # type: ignore
                scope.set_level("warning")  # type: ignore
                sentry_sdk.capture_message(  # type: ignore
                    f"Notification orchestration exceeds {max_duration_minutes} minutes",
                    level="warning"
                )
            
            slow_execution_alerted = True
    
    info("=== Starting Notification Orchestration ===", {})
    
    # === STEP 0: Sync Mailgun unsubscribes ===
    info("STEP 0: Syncing Mailgun unsubscribes", {})
    try:
        unsubscribe_count = sync_mailgun_unsubscribes(db)
        info("Mailgun sync complete", {"unsubscribed_count": unsubscribe_count})
    except Exception as err:
        error("Mailgun sync failed, continuing anyway", {"error": str(err)})
    
    check_execution_time("STEP 0: Mailgun sync")
    
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
    
    check_execution_time("STEP 1: User query")
    
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
        
        # Get unread count for channel determination and scenario selection
        unread_count = get_unread_count(db, user_id)
        
        # Determine notification channel (PUSH or EMAIL)
        # Note: PUSH if user has notification permission and FCM token
        # EMAIL as fallback if PUSH unavailable and user not unsubscribed
        channel = determine_channel(user_data, unread_count)
        if channel is None:
            skipped_no_channel += 1
            continue
        
        # Determine scenario based on user state and channel
        # Note: Scenario selection now focuses on user activity and unread count, not channel constraints
        scenario = determine_scenario(db, user_id, user_data, channel)
        
        # Create appropriate task for batch processing
        if channel == 'EMAIL':
            user_email = user_data.get('email', '').strip()
            if not user_email:
                error("User has EMAIL channel but no valid email address", {
                    "user_id": user_id,
                    "channel": channel,
                })
                skipped_no_channel += 1
                continue
            
            email_tasks.append(UserEmailTask(
                user_id=user_id,
                user_email=user_email,
                scenario=scenario,
            ))
        elif channel == 'PUSH':
            fcm_token = user_data.get('fcmToken', '').strip()
            if not fcm_token:
                error("User has PUSH channel but no valid FCM token", {
                    "user_id": user_id,
                    "channel": channel,
                })
                skipped_no_channel += 1
                continue
            
            push_tasks.append(UserChatTask(
                user_id=user_id,
                fcm_token=fcm_token,
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
    
    check_execution_time("STEP 2: Categorization")
    
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
    
    check_execution_time("STEP 3a: Email generation")
    
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
    
    check_execution_time("STEP 3b: Push generation")
    
    # NOTE: Notification counters are now updated inside batch generators
    # immediately after each chunk write to prevent spam if subsequent operations fail.
    # See _update_notification_counters_for_chunk in email_batch_generator.py and chat_batch_generator.py
    
    # === Final statistics ===
    end_time = datetime.now(timezone.utc)
    total_duration = end_time - start_time
    duration_minutes = total_duration.total_seconds() / 60
    
    stats = {
        "total_users": len(all_users),
        "emails_sent": email_result.success_count if email_result else 0,
        "emails_failed": email_result.failure_count if email_result else 0,
        "pushes_sent": push_result.success_count if push_result else 0,
        "pushes_failed": push_result.failure_count if push_result else 0,
        "skipped_timing": skipped_timing,
        "skipped_no_channel": skipped_no_channel,
        "duration_minutes": round(duration_minutes, 2),
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
        # Use unique session ID (format: onboarding_<user_id>_<uuid>)
        # This ensures proper tracking in Langfuse with unique session per onboarding
        session_id = f"onboarding_{user_id}_{uuid.uuid4().hex[:8]}"
        
        email_content = generate_onboarding_welcome_email(
            db=db,
            user_id=user_id,
            session_id=session_id,
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
        
        # NOTE: We intentionally do NOT update notification_state.notification_count here.
        # This counter is for PROACTIVE communication (AI reaching out to user).
        # Onboarding email is REACTIVE communication - user submitted their email
        # in the web funnel and expects to receive this welcome email.
        # This is not spam risk - it's a direct response to user's action.
        
    except Exception as e:
        error("Failed to send onboarding welcome email", {
            "user_id": user_id,
            "error": str(e),
        })
        raise

