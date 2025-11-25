"""
Notification Data Layer

Pure functions for fetching and processing notification-related data from Firestore.
All functions take db client as first parameter for dependency injection.
"""

from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel
from utils.logger import error, info, warn

# Type definitions
NotificationChannel = Literal['PUSH', 'EMAIL', 'NONE']
NotificationScenario = Literal[
    'EMAIL_ONLY_USER',
    'NEW_USER_PUSH',
    'NEW_USER_EMAIL',
    'ACTIVE_USER_PUSH',
    'ACTIVE_USER_EMAIL',
    'INACTIVE_USER'
]


class UserNotificationData(BaseModel):
    """
    User data needed for notification orchestration.
    
    Note: last_notification_at comes from notification_state which tracks ONLY proactive
    notifications (not reactive chat responses). This count includes both EMAIL and PUSH
    notifications sent by the notification orchestrator.
    """
    user_id: str
    email: str
    fcm_token: str | None
    notification_permission_status: str | None
    email_unsubscribed: bool
    last_notification_at: str | None  # From notification_state.last_notification_at (proactive only)
    last_activity_at: str | None
    created_at: str
    
    # For scenario determination
    unread_count: int
    
    # Calculated fields
    hours_since_last_communication: float  # Time since last PROACTIVE notification


class UserContextData(BaseModel):
    """Complete user context for AI content generation"""
    user_id: str
    user_data: dict[str, Any]
    boss_data: dict[str, Any] | None
    chat_thread_data: dict[str, Any] | None


def calculate_notification_interval(notification_count: int) -> int:
    """
    Calculate notification interval in hours based on notification count.
    
    Progressive engagement strategy:
    - 1st notification: 1 hour after registration
    - 2nd notification: 6 hours after 1st
    - 3rd notification: 24 hours after 2nd
    - 4+ notifications: 48 hours between each
    
    Args:
        notification_count: Number of notifications already sent (0 = never sent)
        
    Returns:
        Hours to wait before next notification
    """
    if notification_count == 0:
        return 1  # First notification after 1 hour
    elif notification_count == 1:
        return 6  # Second notification after 6 hours
    elif notification_count == 2:
        return 24  # Third notification after 24 hours
    else:
        return 48  # All subsequent notifications after 48 hours


def get_users_needing_notifications(db: Any, hours_threshold: int = 48) -> list[UserNotificationData]:
    """
    Fetch all users who need notifications based on progressive interval strategy.
    
    Pure function that takes db client as parameter.
    
    Progressive intervals:
    - 1st notification: 1 hour after registration
    - 2nd notification: 6 hours after 1st
    - 3rd notification: 24 hours after 2nd
    - 4+ notifications: 48 hours between each
    
    Args:
        db: Firestore client instance
        hours_threshold: Unused (kept for backward compatibility, intervals are dynamic now)
        
    Returns:
        List of users needing notifications with all required data
    """
    info("Fetching users needing notifications (progressive intervals)", {})
    
    users_ref = db.collection('users')  # type: ignore
    all_users = users_ref.stream()  # type: ignore
    
    current_time = datetime.now(timezone.utc)
    users_to_notify: list[UserNotificationData] = []
    
    for user_doc in all_users:  # type: ignore
        user_id: str = user_doc.id  # type: ignore
        user_data: dict[str, Any] | None = user_doc.to_dict()  # type: ignore
        
        if user_data is None:
            warn("User has no data, skipping", {"user_id": user_id})
            continue
        
        # Skip if email unsubscribed
        if user_data.get('email_unsubscribed', False):
            continue
        
        # Get notification state
        notification_state = user_data.get('notification_state', {})
        last_notification_at_str = notification_state.get('last_notification_at')
        notification_count = notification_state.get('notification_count', 0)
        
        # Calculate required interval for this user based on their notification count
        required_interval_hours = calculate_notification_interval(notification_count)
        
        # Determine last communication time
        if last_notification_at_str:
            last_communication_time = datetime.fromisoformat(last_notification_at_str.replace('Z', '+00:00'))
        else:
            # If never notified, use createdAt
            created_at_str = user_data.get('createdAt')
            if not created_at_str:
                warn("User has no createdAt, skipping", {"user_id": user_id})
                continue
            last_communication_time = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
        
        hours_since = (current_time - last_communication_time).total_seconds() / 3600
        
        # Skip if not enough time passed for this user's interval
        if hours_since < required_interval_hours:
            continue
        
        # Get unread count from chat thread
        unread_count = 0
        try:
            thread_ref = (
                db.collection('users')  # type: ignore
                .document(user_id)  # type: ignore
                .collection('chatThreads')  # type: ignore
                .document('main')  # type: ignore
            )
            thread_doc = thread_ref.get()  # type: ignore
            if thread_doc.exists:  # type: ignore
                thread_data = thread_doc.to_dict()  # type: ignore
                if thread_data:
                    unread_count = thread_data.get('unreadCount', 0)
        except Exception as e:  # type: ignore
            warn("Failed to fetch chat thread", {"user_id": user_id, "error": str(e)})
        
        # Build user notification data
        try:
            user_notification_data = UserNotificationData(
                user_id=user_id,
                email=user_data.get('email', ''),
                fcm_token=user_data.get('fcmToken'),
                notification_permission_status=user_data.get('notificationPermissionStatus'),
                email_unsubscribed=user_data.get('email_unsubscribed', False),
                last_notification_at=last_notification_at_str,
                last_activity_at=user_data.get('lastActivityAt'),
                created_at=user_data.get('createdAt', ''),
                unread_count=unread_count,
                hours_since_last_communication=hours_since
            )
            users_to_notify.append(user_notification_data)
        except Exception as e:  # type: ignore
            error("Failed to create UserNotificationData", {"user_id": user_id, "error": str(e)})
            continue
    
    info("Users needing notifications", {"count": len(users_to_notify)})
    return users_to_notify


def determine_channel(user_data: UserNotificationData) -> NotificationChannel:
    """
    Determine notification channel for a user.
    
    Pure function based on user state.
    
    Decision logic (from orchestrator STEP 1):
    - PUSH: if notifications_enabled=true AND fcm_token exists AND user was active in last 6 days
    - EMAIL: if push not available AND email_unsubscribed=false
    - NONE: if push disabled/inactive AND email_unsubscribed=true (log error to Sentry)
    
    Args:
        user_data: User notification data
        
    Returns:
        Channel: 'PUSH', 'EMAIL', or 'NONE'
    """
    # Check if PUSH is available
    has_fcm_token = user_data.fcm_token is not None and user_data.fcm_token != ''
    notifications_enabled = user_data.notification_permission_status == 'granted'
    
    # Check if user was active in last 6 days
    user_active_recently = False
    if user_data.last_activity_at:
        try:
            last_activity = datetime.fromisoformat(user_data.last_activity_at.replace('Z', '+00:00'))
            current_time = datetime.now(timezone.utc)
            days_since_activity = (current_time - last_activity).total_seconds() / 86400
            user_active_recently = days_since_activity <= 6
        except Exception as e:  # type: ignore
            warn("Failed to parse last_activity_at", {
                "user_id": user_data.user_id,
                "last_activity_at": user_data.last_activity_at,
                "error": str(e)
            })
    
    # Determine channel
    if has_fcm_token and notifications_enabled and user_active_recently:
        return 'PUSH'
    
    if not user_data.email_unsubscribed:
        return 'EMAIL'
    
    # No available channel
    error("No available notification channel for user", {
        "user_id": user_data.user_id,
        "has_fcm_token": has_fcm_token,
        "notifications_enabled": notifications_enabled,
        "user_active_recently": user_active_recently,
        "email_unsubscribed": user_data.email_unsubscribed
    })
    return 'NONE'


def determine_scenario(
    user_data: UserNotificationData,
    channel: NotificationChannel
) -> NotificationScenario:
    """
    Determine notification scenario for a user.
    
    Pure function based on user state and channel.
    
    Decision logic (from orchestrator STEP 2):
    - EMAIL_ONLY_USER: never logged into app (last_activity_at is None)
    - INACTIVE_USER: has unread messages AND last_activity_at > N days ago
    - NEW_USER_PUSH / NEW_USER_EMAIL: logged in within first 14 days
    - ACTIVE_USER_PUSH / ACTIVE_USER_EMAIL: regular usage
    
    Args:
        user_data: User notification data
        channel: Notification channel (PUSH or EMAIL)
        
    Returns:
        Scenario enum value
    """
    # Check if user ever logged in
    if user_data.last_activity_at is None:
        return 'EMAIL_ONLY_USER'
    
    # Check if user is inactive with unread messages
    try:
        last_activity = datetime.fromisoformat(user_data.last_activity_at.replace('Z', '+00:00'))
        current_time = datetime.now(timezone.utc)
        days_since_activity = (current_time - last_activity).total_seconds() / 86400
        
        # INACTIVE_USER: > 7 days inactive AND has unread messages
        if days_since_activity > 7 and user_data.unread_count > 0:
            return 'INACTIVE_USER'
    except Exception as e:  # type: ignore
        warn("Failed to parse last_activity_at for scenario", {
            "user_id": user_data.user_id,
            "error": str(e)
        })
    
    # Determine if NEW_USER or ACTIVE_USER based on account age
    try:
        created_at = datetime.fromisoformat(user_data.created_at.replace('Z', '+00:00'))
        current_time = datetime.now(timezone.utc)
        days_since_creation = (current_time - created_at).total_seconds() / 86400
        
        is_new_user = days_since_creation <= 14
        
        if is_new_user:
            return 'NEW_USER_PUSH' if channel == 'PUSH' else 'NEW_USER_EMAIL'
        else:
            return 'ACTIVE_USER_PUSH' if channel == 'PUSH' else 'ACTIVE_USER_EMAIL'
    except Exception as e:  # type: ignore
        error("Failed to determine user age for scenario", {
            "user_id": user_data.user_id,
            "error": str(e)
        })
        # Default to ACTIVE_USER
        return 'ACTIVE_USER_PUSH' if channel == 'PUSH' else 'ACTIVE_USER_EMAIL'


def get_user_context_data(db: Any, user_id: str) -> UserContextData:
    """
    Fetch complete user context for AI content generation.
    
    Pure function that takes db client as parameter.
    
    Args:
        db: Firestore client instance
        user_id: User ID
        
    Returns:
        Complete user context including user profile, boss data, and chat thread
    """
    info("Fetching user context data", {"user_id": user_id})
    
    # Fetch user document
    user_ref = db.collection('users').document(user_id)  # type: ignore
    user_doc = user_ref.get()  # type: ignore
    
    if not user_doc.exists:  # type: ignore
        raise ValueError(f"User not found: {user_id}")
    
    user_data: dict[str, Any] = user_doc.to_dict() or {}  # type: ignore
    
    # Fetch first boss (or None if no bosses)
    boss_data: dict[str, Any] | None = None
    try:
        bosses_ref = user_ref.collection('bosses')  # type: ignore
        boss_docs = bosses_ref.limit(1).stream()  # type: ignore
        for boss_doc in boss_docs:  # type: ignore
            boss_data = boss_doc.to_dict()  # type: ignore
            break
    except Exception as e:  # type: ignore
        warn("Failed to fetch boss data", {"user_id": user_id, "error": str(e)})
    
    # Fetch chat thread
    chat_thread_data: dict[str, Any] | None = None
    try:
        thread_ref = user_ref.collection('chatThreads').document('main')  # type: ignore
        thread_doc = thread_ref.get()  # type: ignore
        if thread_doc.exists:  # type: ignore
            chat_thread_data = thread_doc.to_dict()  # type: ignore
    except Exception as e:  # type: ignore
        warn("Failed to fetch chat thread", {"user_id": user_id, "error": str(e)})
    
    return UserContextData(
        user_id=user_id,
        user_data=user_data,
        boss_data=boss_data,
        chat_thread_data=chat_thread_data
    )


def update_notification_state_after_send(db: Any, user_id: str) -> None:
    """
    Update notification state after successfully sending a PROACTIVE notification.
    
    This function should ONLY be called after proactive notifications (email or push).
    Do NOT call this for reactive chat responses from the assistant.
    
    Updates:
    - notification_state.last_notification_at (server timestamp)
    - notification_state.notification_count (atomic increment)
    
    Args:
        db: Firestore client instance
        user_id: User ID
    """
    from firebase_admin import firestore  # type: ignore
    
    user_ref = db.collection('users').document(user_id)  # type: ignore
    
    # Atomic update with FieldValue.increment()
    user_ref.update({  # type: ignore
        'notification_state.last_notification_at': firestore.SERVER_TIMESTAMP,  # type: ignore
        'notification_state.notification_count': firestore.Increment(1)  # type: ignore
    })
    
    info("Updated notification state after proactive notification", {
        "user_id": user_id,
        "type": "proactive_notification"
    })


def fetch_mailgun_unsubscribes(mailgun_api_key: str, mailgun_domain: str) -> list[str]:
    """
    Fetch list of unsubscribed emails from Mailgun Suppressions API.
    
    This function is safe to test in production - it only reads data, doesn't modify anything.
    
    Args:
        mailgun_api_key: Mailgun API key for authentication
        mailgun_domain: Mailgun domain (e.g., 'mailgun.services.ozma.io')
        
    Returns:
        List of email addresses that have unsubscribed
        
    Raises:
        ValueError: If API returns non-200 status
        requests.RequestException: If network request fails
    """
    import requests
    from typing import Dict, Any as TypeAny
    
    info("Fetching Mailgun unsubscribes", {"domain": mailgun_domain})
    
    # Fetch unsubscribes from Mailgun Suppressions API
    url = f'https://api.mailgun.net/v3/{mailgun_domain}/unsubscribes'
    response = requests.get(
        url,
        auth=('api', mailgun_api_key),
        params={'limit': 1000}  # Max results per request
    )
    
    if response.status_code != 200:
        error("Failed to fetch Mailgun unsubscribes", {
            "status_code": response.status_code,
            "response": response.text
        })
        raise ValueError(f"Mailgun API returned status {response.status_code}")
    
    data = response.json()
    unsubscribes: list[Dict[str, TypeAny]] = data.get('items', [])
    
    # Extract emails from unsubscribes
    unsubscribed_emails = [item['address'] for item in unsubscribes if 'address' in item]
    
    info("Fetched Mailgun unsubscribes", {
        "total_items": len(unsubscribes),
        "email_count": len(unsubscribed_emails)
    })
    
    return unsubscribed_emails


def sync_mailgun_unsubscribes(db: Any) -> int:
    """
    Sync unsubscribe list from Mailgun and update Firestore.
    
    Implementation:
    1. Fetch suppressions list from Mailgun API
    2. For each unsubscribed email, find user in Firestore
    3. Batch update email_unsubscribed=true for all matching users
    4. Return count of updated users
    
    Args:
        db: Firestore client instance
        
    Returns:
        Number of users updated
    """
    import os
    
    info("Syncing Mailgun unsubscribes", {})
    
    # Get Mailgun API credentials from environment
    mailgun_api_key = os.environ.get('MAILGUN_API_KEY')
    if not mailgun_api_key:
        error("MAILGUN_API_KEY not found in environment", {})
        raise ValueError("MAILGUN_API_KEY not configured")
    
    mailgun_domain = 'mailgun.services.ozma.io'
    
    # Fetch unsubscribed emails from Mailgun
    try:
        unsubscribed_emails = fetch_mailgun_unsubscribes(mailgun_api_key, mailgun_domain)
    except Exception as e:
        error("Failed to fetch Mailgun unsubscribes", {"error": str(e)})
        raise
    
    if not unsubscribed_emails:
        info("No unsubscribes found in Mailgun", {})
        return 0
    
    # Find and update users in Firestore
    updated_count = 0
    batch = db.batch()
    batch_count = 0
    max_batch_size = 500  # Firestore batch write limit
    
    for email in unsubscribed_emails:
        # Query users by email
        users_ref = db.collection('users')
        query = users_ref.where('email', '==', email).limit(10)
        users = query.stream()
        
        for user_doc in users:
            user_data = user_doc.to_dict()
            
            # Skip if already marked as unsubscribed
            if user_data.get('email_unsubscribed'):
                continue
            
            # Add update to batch
            user_ref = users_ref.document(user_doc.id)
            batch.update(user_ref, {'email_unsubscribed': True})
            batch_count += 1
            updated_count += 1
            
            # Commit batch if reaching limit
            if batch_count >= max_batch_size:
                batch.commit()
                info("Committed batch update", {"count": batch_count})
                batch = db.batch()
                batch_count = 0
    
    # Commit remaining updates
    if batch_count > 0:
        batch.commit()
        info("Committed final batch update", {"count": batch_count})
    
    info("Mailgun unsubscribes sync complete", {
        "total_unsubscribed_emails": len(unsubscribed_emails),
        "users_updated": updated_count
    })
    
    return updated_count

