"""
Notification Orchestrator Business Logic

Core business logic for notification orchestration:
1. Query users from Firestore
2. Decide who needs notifications based on various scenarios
3. Create messages and email operations

All functions are pure and take db client as parameter for testability.

HIGH-LEVEL SCENARIOS:

Scenario 1: Email-only user (never logged into app)
- Send AI career coaching advice via email based on data they provided during onboarding
- Always include CTA at bottom: app is more convenient, you can ask questions to your AI, download and try it

Scenario 2: Active app user with notifications enabled
- Send AI coaching advice via push notifications
- Frequency: every 2 days (may increase frequency initially)

Scenario 3: App user with notifications disabled
- Send AI coaching advice via email (fallback channel)
- Include reminder at bottom: notifications are disabled, enable them for better experience, promise not to spam

All messages are from AI assistant persona, providing personalized career coaching.
See functions/src/constants.ts (CHAT_SYSTEM_PROMPT) for AI assistant behavior details.

SCENARIOS TAXONOMY (Decision Tree):

1. Email unsubscribed?
   → YES: SKIP (do not send anything)
   → NO: continue to step 2
   
   Implementation: Sync unsubscribe list from Mailgun API at start of each run,
   update Firestore users with email_unsubscribed flag, then use cached flag.
   One API call per function run, not per user.

2. Has user ever logged into app (last_login_at exists)?
   → NO: SCENARIO A (email-only user)
       └─ Channel: EMAIL
       └─ CTA: "Download app to chat with AI"
       └─ Frequency: may be more frequent initially
   
   → YES: continue to step 3

3. FCM token exists + notifications_enabled?
   → YES: continue to step 4
   → NO: SCENARIO B (app user, notifications disabled)
       └─ Channel: EMAIL
       └─ CTA: "Enable notifications for better experience, promise not to spam"

4. Is user ignoring app? (last_seen_at > N days ago AND unread_messages_count > 0)
   → YES: SCENARIO C (inactive app user with unread messages)
       └─ Channel: EMAIL (fallback to re-engage)
       └─ CTA: "You have unread messages in app"
   
   → NO: SCENARIO D (active app user)
       └─ Channel: PUSH
       └─ No special CTA (user is already engaged)

TIMING:
- Function runs every 2 hours
- Send if 48+ hours passed since last_notification_at (no timezone logic needed)
- Some scenarios may have more frequent communication initially

AI RESPONSIBILITY:
- AI generates ONLY content (title + body in markdown)
- Code handles: scenario detection, channel selection, CTA/disclaimer wrapping, timing logic
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
        # TODO: Add scenarios:
        # - Onboarding reminder
        # - Weekly check-in
        # - N-day silence reminder
        # - Check notification_state.last_notification_at
        # TODO: 
        # - Add logic to get and store mailgun unsubscribe list
        
        info("Processed user", {"user_id": user_id})
        processed_count += 1
    
    info("Notification orchestration completed", {"processed_count": processed_count})
    return processed_count

