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
    """User data needed for notification orchestration"""
    user_id: str
    email: str
    fcm_token: str | None
    notification_permission_status: str | None
    email_unsubscribed: bool
    last_notification_at: str | None
    last_activity_at: str | None
    created_at: str
    
    # For scenario determination
    unread_count: int
    
    # Calculated fields
    hours_since_last_communication: float


class UserContextData(BaseModel):
    """Complete user context for AI content generation"""
    user_id: str
    user_data: dict[str, Any]
    boss_data: dict[str, Any] | None
    chat_thread_data: dict[str, Any] | None


def get_users_needing_notifications(db: Any, hours_threshold: int = 48) -> list[UserNotificationData]:
    """
    Fetch all users who need notifications (48+ hours since last communication).
    
    Pure function that takes db client as parameter.
    
    Args:
        db: Firestore client instance
        hours_threshold: Minimum hours since last communication (default 48)
        
    Returns:
        List of users needing notifications with all required data
    """
    info("Fetching users needing notifications", {"hours_threshold": hours_threshold})
    
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
        
        # Get last communication time
        notification_state = user_data.get('notification_state', {})
        last_notification_at_str = notification_state.get('last_notification_at')
        
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
        
        # Skip if not enough time passed
        if hours_since < hours_threshold:
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


def sync_mailgun_unsubscribes(db: Any, mailgun_client: Any) -> int:
    """
    Sync unsubscribe list from Mailgun and update Firestore.
    
    STUB: Mailgun integration to be implemented later.
    
    Args:
        db: Firestore client instance
        mailgun_client: Mailgun API client
        
    Returns:
        Number of users updated
    """
    info("Syncing Mailgun unsubscribes (STUB)", {})
    
    # TODO: Implement Mailgun API integration
    # 1. Fetch unsubscribe list from Mailgun
    # 2. For each unsubscribed email, find user and set email_unsubscribed=true
    # 3. Return count of updated users
    
    return 0

