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
- PUSH: if notifications_enabled=true AND fcm_token exists AND user was active in app in last 6 days (last_seen_at)
- EMAIL: if push not available AND email_unsubscribed=false
- NO CHANNEL: if push disabled/inactive AND email_unsubscribed=true → log error to Sentry, skip user

Implementation note: Sync Mailgun unsubscribe list at function start, update Firestore email_unsubscribed flags.

STEP 2: CHOOSE SCENARIO

Each scenario defines content context, channel, and CTA:

A. EMAIL_ONLY_USER
   - Trigger: never logged into app (last_login_at is null)
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
   - Trigger: has unread messages AND last_seen_at > N days ago
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

from typing import Any

from utils.logger import info, warn


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
        # TODO: Implement 4-step flow (see docstring):
        # 1. Choose channel (PUSH vs EMAIL)
        # 2. Choose scenario (A/B/C/D/E/F)
        # 3. Generate content (AI)
        # 4. Create Firestore document (triggers handle actual sending)
        # TODO: Add single-user mode for HTTP endpoint (immediate welcome email)
        # TODO: Add logic to sync mailgun unsubscribe list at function start
        
        # EXAMPLE CODE (commented out - will be uncommented when implementing):
        # 
        # from data.notification_content import (
        #     generate_first_email_notification,
        #     generate_ongoing_email_notification,
        #     generate_first_push_notification,
        #     generate_ongoing_push_notification,
        # )
        # from data.chat_operations import add_assistant_message_to_chat
        # from data.email_operations import create_email_for_sending
        # 
        # # Example for EMAIL scenario (e.g., EMAIL_ONLY_USER or NEW_USER_EMAIL):
        # if channel == 'EMAIL':
        #     # Generate email content via AI (returns title and body_markdown)
        #     ai_content = generate_first_email_notification(
        #         db=db,
        #         user_id=user_id,
        #         session_id=None,
        #     )
        #     
        #     # Create email document in Firestore
        #     # TypeScript trigger will convert Markdown to HTML, wrap in template, and send via Mailgun
        #     user_email = user_data.get('email', '')
        #     create_email_for_sending(
        #         db=db,
        #         user_id=user_id,
        #         to_email=user_email,
        #         subject=ai_content.title,
        #         body_markdown=ai_content.body,
        #     )
        #     
        #     # Update notification state
        #     db.collection('users').document(user_id).update({
        #         'notification_state.last_notification_at': firestore.SERVER_TIMESTAMP,
        #         'notification_state.notification_count': firestore.Increment(1),
        #     })
        # 
        # # Example for PUSH scenario (e.g., NEW_USER_PUSH or ACTIVE_USER_PUSH):
        # elif channel == 'PUSH':
        #     # Generate push content via AI
        #     ai_content = generate_first_push_notification(
        #         db=db,
        #         user_id=user_id,
        #         session_id=None,
        #     )
        #     
        #     # Add message to chat (Firestore trigger sends push notification automatically)
        #     add_assistant_message_to_chat(
        #         db=db,
        #         user_id=user_id,
        #         message_text=ai_content.message,
        #         thread_id='default',
        #     )
        #     
        #     # Update notification state
        #     db.collection('users').document(user_id).update({
        #         'notification_state.last_notification_at': firestore.SERVER_TIMESTAMP,
        #         'notification_state.notification_count': firestore.Increment(1),
        #     })
        
        info("Processed user", {"user_id": user_id})
        processed_count += 1
    
    info("Notification orchestration completed", {"processed_count": processed_count})
    return processed_count

