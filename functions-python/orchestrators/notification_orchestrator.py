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

Scenarios determine content context and CTA:

A. EMAIL_ONLY_USER
   - Never logged into app (last_login_at is null)
   - Content context: career coaching based on onboarding data - show value through actionable advice
   - CTA: "App is more convenient, you can ask questions to your AI, download and try it"
   - Note: First email sent immediately via HTTP endpoint when user submits web form

B. NEW_USER
   - Logged into app within first N days (TBD threshold)
   - Content context: early career coaching guidance, help establish good habits
   - CTA: depends on channel (see CTA logic below)

C. ACTIVE_USER
   - Regular app usage, no unread messages piling up
   - Content context: ongoing career coaching - help user grow professionally (leadership, communication skills, career development)
   - CTA: depends on channel (see CTA logic below)

D. INACTIVE_USER
   - Has unread messages AND last_seen_at > N days ago
   - Content context: career growth advice + gentle reminder about continuing conversation in app
   - CTA: "You have unread messages in app" (regardless of channel)

CTA Logic (for scenarios B, C):
- If channel=EMAIL + notifications_enabled=false: "Enable notifications for better experience, promise not to spam"
- If channel=EMAIL + notifications_enabled=true: "Open app to continue conversation"
- If channel=PUSH: no CTA - focus purely on career growth advice (user is already engaged in app)

STEP 3: GENERATE CONTENT

- AI generates ONLY: title + body (markdown)
- Code wraps with appropriate CTA/disclaimer based on scenario + channel

STEP 4: SEND

- Push notification via FCM
- Email via Mailgun
- Update notification_state.last_notification_at

TIMING:
- Function runs every 2 hours
- Send if 48+ hours passed since last_notification_at (no timezone logic needed)
- Some scenarios may have more frequent communication initially (TBD)
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
        # 2. Choose scenario (A/B/C/D)
        # 3. Generate content (AI)
        # 4. Send notification
        # TODO: Add single-user mode for HTTP endpoint (immediate welcome email)
        # TODO: Add logic to sync mailgun unsubscribe list at function start
        
        info("Processed user", {"user_id": user_id})
        processed_count += 1
    
    info("Notification orchestration completed", {"processed_count": processed_count})
    return processed_count

