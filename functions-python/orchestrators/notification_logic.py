"""
Notification Decision Logic

Pure functions for determining notification timing, channel selection, and scenario detection.
All functions are stateless and testable - they take user data dict and return decisions.

Used by notification orchestrator to decide who gets what type of notification.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Literal

import sentry_sdk  # type: ignore

from data.firestore_models import ChatThread, NotificationState
from utils.logger import error, warn

# Type aliases for clarity
UserCategory = Literal[
    'EMAIL_ONLY_USER',
    'NEW_USER_PUSH',
    'NEW_USER_EMAIL',
    'ACTIVE_USER_PUSH',
    'ACTIVE_USER_EMAIL',
    'INACTIVE_USER_EMAIL'
]

# Category-specific notification intervals
# Each category has its own progressive interval schedule
# Format: list of timedelta objects representing intervals between notifications
CATEGORY_INTERVALS: dict[UserCategory, list[timedelta]] = {
    'EMAIL_ONLY_USER': [
        timedelta(hours=1),   # 1st notification: 1h after registration
        timedelta(hours=6),   # 2nd: 6h after 1st
        timedelta(hours=24),  # 3rd: 24h after 2nd
        timedelta(hours=48),  # 4th: 48h after 3rd
        timedelta(days=7),    # 5+: weekly
    ],
    'NEW_USER_PUSH': [
        timedelta(hours=1),   # Faster cadence for engaged new users
        timedelta(hours=3),
        timedelta(hours=6),
        timedelta(hours=24),
        timedelta(days=3),
    ],
    'NEW_USER_EMAIL': [
        timedelta(hours=1),
        timedelta(hours=6),
        timedelta(hours=24),
        timedelta(hours=48),
        timedelta(days=7),
    ],
    'ACTIVE_USER_PUSH': [
        timedelta(hours=1),
        timedelta(hours=3),
        timedelta(hours=6),
        timedelta(hours=24),
        timedelta(days=3),
    ],
    'ACTIVE_USER_EMAIL': [
        timedelta(hours=1),
        timedelta(hours=6),
        timedelta(hours=24),
        timedelta(hours=48),
        timedelta(days=7),
    ],
    'INACTIVE_USER_EMAIL': [
        timedelta(hours=1),
        timedelta(hours=24),  # Slower cadence for inactive users
        timedelta(hours=48),
        timedelta(days=7),
        timedelta(days=14),
    ],
}


def should_send_notification(user_data: dict[str, Any], category: UserCategory) -> bool:
    """
    Check if enough time has passed to send next notification.
    
    Uses category-specific progressive interval logic from CATEGORY_INTERVALS.
    Each category has its own schedule optimized for user engagement patterns.
    
    Args:
        user_data: User document data from Firestore
        category: User category (determines interval schedule)
        
    Returns:
        True if notification should be sent, False otherwise
    """
    now = datetime.now(timezone.utc)
    
    # Get notification state with type validation
    notification_state_dict = user_data.get('notification_state', {})
    try:
        notification_state = NotificationState(**notification_state_dict)
    except Exception:
        # Fallback to defaults if data is invalid
        notification_state = NotificationState()
    
    notification_count = notification_state.notification_count
    last_notification_at = notification_state.last_notification_at
    
    # Get category-specific intervals
    intervals = CATEGORY_INTERVALS[category]
    
    # First notification - check time since registration
    if notification_count == 0:
        created_at_str = user_data.get('createdAt')
        if not created_at_str:
            warn("User has no createdAt, skipping", {"user_id": user_data.get('id')})
            return False
        
        created_at = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
        time_since_registration = now - created_at
        
        # Use first interval from category schedule
        return time_since_registration >= intervals[0]
    
    # Subsequent notifications - check time since last notification
    if not last_notification_at:
        # Has notification_count but no timestamp - data inconsistency
        warn("User has notification_count but no last_notification_at", {
            "notification_count": notification_count
        })
        return False
    
    last_sent = datetime.fromisoformat(last_notification_at.replace('Z', '+00:00'))
    time_since_last = now - last_sent
    
    # Get required interval for this notification number
    # Use last interval in schedule for counts beyond schedule length
    interval_index: int = min(notification_count, len(intervals) - 1)
    required_interval: timedelta = intervals[interval_index]
    
    return time_since_last >= required_interval


def was_active_recently(user_data: dict[str, Any], days: int) -> bool:
    """
    Check if user was active in app within last N days.
    
    Args:
        user_data: User document data
        days: Number of days to check
        
    Returns:
        True if user was active within last N days
    """
    last_activity_str = user_data.get('lastActivityAt')
    if not last_activity_str:
        return False
    
    try:
        last_activity = datetime.fromisoformat(last_activity_str.replace('Z', '+00:00'))
        now = datetime.now(timezone.utc)
        return (now - last_activity) <= timedelta(days=days)
    except (ValueError, AttributeError):
        warn("Invalid lastActivityAt format", {"lastActivityAt": last_activity_str})
        return False


def is_new_user(user_data: dict[str, Any], days: int = 14) -> bool:
    """
    Check if user registered within last N days.
    
    Args:
        user_data: User document data
        days: Number of days to consider "new" (default: 14)
        
    Returns:
        True if user registered within last N days
    """
    created_at_str = user_data.get('createdAt')
    if not created_at_str:
        return False
    
    try:
        created_at = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
        now = datetime.now(timezone.utc)
        return (now - created_at) <= timedelta(days=days)
    except (ValueError, AttributeError):
        warn("Invalid createdAt format", {"createdAt": created_at_str})
        return False


def is_inactive(user_data: dict[str, Any], days: int) -> bool:
    """
    Check if user has been inactive for more than N days.
    
    Args:
        user_data: User document data
        days: Number of days to consider "inactive"
        
    Returns:
        True if user hasn't been active for more than N days
    """
    last_activity_str = user_data.get('lastActivityAt')
    if not last_activity_str:
        # No lastActivityAt means never logged in - not "inactive" by this definition
        return False
    
    try:
        last_activity = datetime.fromisoformat(last_activity_str.replace('Z', '+00:00'))
        now = datetime.now(timezone.utc)
        return (now - last_activity) > timedelta(days=days)
    except (ValueError, AttributeError):
        warn("Invalid lastActivityAt format", {"lastActivityAt": last_activity_str})
        return False


def get_unread_count(db: Any, user_id: str) -> int:
    """
    Get total unread message count from user's chat threads.
    
    Queries the main chat thread for unread message count.
    
    TODO: Optimize by storing unreadCount at user document level (denormalize from chatThreads subcollection)
          to avoid N+1 queries when processing all users in notification orchestration.
    TODO: Handle dynamic threadId - currently hardcoded to 'main' but schema allows multiple threads.
    
    Args:
        db: Firestore client instance
        user_id: User document ID
        
    Returns:
        Number of unread messages
    """
    try:
        thread_ref = (
            db.collection('users')  # type: ignore
            .document(user_id)  # type: ignore
            .collection('chatThreads')  # type: ignore
            .document('main')  # type: ignore
        )
        thread_doc = thread_ref.get()  # type: ignore
        
        if not thread_doc.exists:  # type: ignore
            return 0
        
        thread_data_dict = thread_doc.to_dict()  # type: ignore
        if not thread_data_dict:
            return 0
        
        try:
            thread_data = ChatThread(**thread_data_dict)
            return thread_data.unreadCount
        except Exception as validation_err:
            warn("Failed to parse thread data", {
                "user_id": user_id,
                "error": str(validation_err)
            })
            return thread_data_dict.get('unreadCount', 0)
        
    except Exception as err:
        warn("Failed to fetch unread count", {
            "user_id": user_id,
            "error": str(err)
        })
        return 0


def determine_user_category(
    db: Any,
    user_id: str,
    user_data: dict[str, Any]
) -> UserCategory | None:
    """
    Determine user category based on state, activity, and available channels.
    
    Single unified function that replaces the old two-step approach
    (determine_channel + determine_scenario). Each user belongs to exactly
    one category, which determines both the notification channel and content type.
    
    Category priority logic:
    1. Check channel availability (PUSH and/or EMAIL)
    2. Check INACTIVE status (overrides other categories if conditions met)
    3. Check if never logged in
    4. Check if NEW user (< 14 days since registration)
    5. Default to ACTIVE user
    
    Args:
        db: Firestore client instance
        user_id: User document ID
        user_data: User document data from Firestore
        
    Returns:
        UserCategory or None if no channel available
        
    Examples:
        >>> # User with push enabled, new account
        >>> determine_user_category(db, 'user1', {'notificationPermissionStatus': 'granted', 'fcmToken': 'abc', 'createdAt': '2024-11-28T...'})
        'NEW_USER_PUSH'
        
        >>> # User with email only, inactive with unread messages
        >>> determine_user_category(db, 'user2', {'email_unsubscribed': False, 'lastActivityAt': '2024-11-01T...'})
        'INACTIVE_USER_EMAIL'  # if has unread messages
    """
    # Priority 1: Check channel availability
    has_push = (
        user_data.get('notificationPermissionStatus') == 'granted'
        and bool(user_data.get('fcmToken'))
    )
    has_email = not user_data.get('email_unsubscribed', False)
    
    # No channels available
    if not has_push and not has_email:
        user_email = user_data.get('email', 'unknown')
        error(
            "No notification channel available for user",
            {
                "email": user_email,
                "has_push": has_push,
                "has_email": has_email,
            }
        )
        
        with sentry_sdk.push_scope() as scope:  # type: ignore
            scope.set_extra("email", user_email)  # type: ignore
            scope.set_extra("has_push", has_push)  # type: ignore
            scope.set_extra("has_email", has_email)  # type: ignore
            sentry_sdk.capture_message(  # type: ignore
                "User has no available notification channel",
                level="warning"
            )
        
        return None
    
    # Priority 2: Check INACTIVE (overrides everything if conditions met)
    # INACTIVE_USER can ONLY be EMAIL per business requirements
    unread_count = get_unread_count(db, user_id)
    if unread_count > 0 and is_inactive(user_data, days=10):
        if has_email:
            return 'INACTIVE_USER_EMAIL'
        else:
            # Has unread messages but no email channel
            # Skip this user (can't send INACTIVE notification via PUSH)
            return None
    
    # Get activity status for remaining categories
    last_activity = user_data.get('lastActivityAt')
    
    # Priority 3: Check if never logged in
    if not last_activity:
        # Never logged in - prefer email, fallback to push
        if has_email:
            return 'EMAIL_ONLY_USER'
        elif has_push:
            # Never logged in but has push setup (rare edge case)
            return 'NEW_USER_PUSH'
    
    # Priority 4: Check if NEW user (< 14 days since registration)
    if is_new_user(user_data, days=14):
        # Prefer push for new users, fallback to email
        if has_push:
            return 'NEW_USER_PUSH'
        elif has_email:
            return 'NEW_USER_EMAIL'
    
    # Priority 5: Default to ACTIVE user
    # Prefer push for active users, fallback to email
    if has_push:
        return 'ACTIVE_USER_PUSH'
    elif has_email:
        return 'ACTIVE_USER_EMAIL'
    
    # This should never be reached given the channel check at the start
    return None

