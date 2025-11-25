"""
Notification Decision Logic

Pure functions for determining notification timing, channel selection, and scenario detection.
All functions are stateless and testable - they take user data dict and return decisions.

Used by notification orchestrator to decide who gets what type of notification.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Literal

import sentry_sdk  # type: ignore

from utils.logger import error, warn

# Type aliases for clarity
NotificationChannel = Literal['PUSH', 'EMAIL'] | None
NotificationScenario = Literal[
    'EMAIL_ONLY_USER',
    'NEW_USER_PUSH', 
    'NEW_USER_EMAIL',
    'ACTIVE_USER_PUSH',
    'ACTIVE_USER_EMAIL',
    'INACTIVE_USER'
]


def should_send_notification(user_data: dict[str, Any]) -> bool:
    """
    Check if enough time has passed to send next notification.
    
    Implements progressive interval logic from orchestrator docstring:
    - 1st notification: 1 hour after registration
    - 2nd notification: 6 hours after 1st
    - 3rd notification: 24 hours after 2nd
    - 4+ notifications: 48 hours between each
    
    Args:
        user_data: User document data from Firestore
        
    Returns:
        True if notification should be sent, False otherwise
    """
    now = datetime.now(timezone.utc)
    
    # Get notification state
    notification_state = user_data.get('notification_state', {})
    notification_count = notification_state.get('notification_count', 0)
    last_notification_at = notification_state.get('last_notification_at')
    
    # First notification - check time since registration
    if notification_count == 0:
        created_at_str = user_data.get('createdAt')
        if not created_at_str:
            warn("User has no createdAt, skipping", {"user_id": user_data.get('id')})
            return False
        
        created_at = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
        time_since_registration = now - created_at
        
        # First notification: 1 hour after registration
        return time_since_registration >= timedelta(hours=1)
    
    # Subsequent notifications - check time since last notification
    if not last_notification_at:
        # Has notification_count but no timestamp - data inconsistency
        warn("User has notification_count but no last_notification_at", {
            "notification_count": notification_count
        })
        return False
    
    last_sent = datetime.fromisoformat(last_notification_at.replace('Z', '+00:00'))
    time_since_last = now - last_sent
    
    # Progressive intervals
    if notification_count == 1:
        required_interval = timedelta(hours=6)
    elif notification_count == 2:
        required_interval = timedelta(hours=24)
    else:
        required_interval = timedelta(hours=48)
    
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


def get_unread_count(user_data: dict[str, Any]) -> int:
    """
    Get total unread message count from user's chat threads.
    
    Note: In current implementation, this would require a subcollection query.
    For MVP, we can return 0 and implement later when needed for INACTIVE_USER scenario.
    
    Args:
        user_data: User document data
        
    Returns:
        Number of unread messages (0 for now)
    """
    # TODO: Implement when INACTIVE_USER scenario needs it
    # Would need to query chatThreads subcollection and sum unreadCount
    return 0


def determine_channel(user_data: dict[str, Any]) -> NotificationChannel:
    """
    Determine which channel to use for notification (PUSH or EMAIL).
    
    Decision logic from orchestrator docstring STEP 1:
    - PUSH: if notifications_enabled=true AND fcm_token exists AND user was active in last 6 days
    - EMAIL: if push not available AND email_unsubscribed=false
    - None: if push disabled/inactive AND email_unsubscribed=true (log to Sentry)
    
    Args:
        user_data: User document data from Firestore
        
    Returns:
        'PUSH', 'EMAIL', or None if no channel available
    """
    # Check PUSH eligibility
    has_notifications = user_data.get('notificationPermissionStatus') == 'granted'
    has_fcm_token = bool(user_data.get('fcmToken'))
    is_active = was_active_recently(user_data, days=6)
    
    if has_notifications and has_fcm_token and is_active:
        return 'PUSH'
    
    # Check EMAIL eligibility
    is_unsubscribed = user_data.get('email_unsubscribed', False)
    
    if not is_unsubscribed:
        return 'EMAIL'
    
    # No channel available - log to Sentry
    user_email = user_data.get('email', 'unknown')
    error(
        "No notification channel available for user",
        {
            "email": user_email,
            "has_notifications": has_notifications,
            "has_fcm_token": has_fcm_token,
            "is_active": is_active,
            "is_unsubscribed": is_unsubscribed,
        }
    )
    
    # Capture in Sentry
    with sentry_sdk.push_scope() as scope:  # type: ignore
        scope.set_extra("email", user_email)  # type: ignore
        scope.set_extra("has_notifications", has_notifications)  # type: ignore
        scope.set_extra("has_fcm_token", has_fcm_token)  # type: ignore
        scope.set_extra("is_active", is_active)  # type: ignore
        scope.set_extra("is_unsubscribed", is_unsubscribed)  # type: ignore
        sentry_sdk.capture_message(  # type: ignore
            "User has no available notification channel",
            level="warning"
        )
    
    return None


def determine_scenario(
    user_data: dict[str, Any],
    channel: NotificationChannel
) -> NotificationScenario:
    """
    Determine which notification scenario applies to this user.
    
    Implements logic from orchestrator docstring STEP 2 for scenarios A-F:
    
    A. EMAIL_ONLY_USER - never logged into app (lastActivityAt is null) + EMAIL channel
    B. NEW_USER_PUSH - logged into app within first N days + PUSH channel
    C. NEW_USER_EMAIL - logged into app within first N days + EMAIL channel
    D. ACTIVE_USER_PUSH - regular app usage + PUSH channel
    E. ACTIVE_USER_EMAIL - regular app usage + EMAIL channel
    F. INACTIVE_USER - has unread messages AND lastActivityAt > N days ago (always EMAIL)
    
    Args:
        user_data: User document data from Firestore
        channel: Selected notification channel ('PUSH' or 'EMAIL')
        
    Returns:
        Notification scenario identifier
    """
    if channel is None:
        raise ValueError("Cannot determine scenario without channel")
    
    last_activity = user_data.get('lastActivityAt')
    unread_count = get_unread_count(user_data)
    
    # A. EMAIL_ONLY_USER - never logged into app
    if not last_activity and channel == 'EMAIL':
        return 'EMAIL_ONLY_USER'
    
    # F. INACTIVE_USER - priority check (overrides other scenarios)
    # Has unread messages AND inactive for more than 7 days
    # NOTE: Always use EMAIL for inactive users (per docstring)
    if unread_count > 0 and is_inactive(user_data, days=7):
        return 'INACTIVE_USER'
    
    # B. NEW_USER_PUSH - logged in recently + new user
    if is_new_user(user_data, days=14) and channel == 'PUSH':
        return 'NEW_USER_PUSH'
    
    # C. NEW_USER_EMAIL - logged in recently + new user + email channel
    if is_new_user(user_data, days=14) and channel == 'EMAIL':
        return 'NEW_USER_EMAIL'
    
    # D. ACTIVE_USER_PUSH - regular usage + push channel
    if channel == 'PUSH':
        return 'ACTIVE_USER_PUSH'
    
    # E. ACTIVE_USER_EMAIL - regular usage + email channel
    return 'ACTIVE_USER_EMAIL'

