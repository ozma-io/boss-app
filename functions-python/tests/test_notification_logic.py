"""
Tests for Notification Logic

SAFE TO RUN - NO REAL NOTIFICATIONS SENT:
These tests only check pure decision logic functions (timing, channel, scenario).
They work with test data (Python dicts) without any Firebase connection.

NO connections to:
- Firebase/Firestore (no real users)
- OpenAI API (no AI generation)
- Mailgun (no emails sent)
- FCM (no push notifications)

Tests timing, channel selection, and scenario detection logic.
These are pure functions so they're easy to test without mocks.

Safe to run anytime during development!
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

from orchestrators.notification_logic import (  # type: ignore
    determine_channel,  # type: ignore
    determine_scenario,  # type: ignore
    is_inactive,  # type: ignore
    is_new_user,  # type: ignore
    should_send_notification,  # type: ignore
    was_active_recently,  # type: ignore
)


def create_mock_db(unread_count: int = 0) -> MagicMock:
    """
    Create a mock Firestore db client for testing.
    
    Args:
        unread_count: Number of unread messages to return (default: 0)
        
    Returns:
        Mock db that returns specified unread count
    """
    mock_db = MagicMock()
    mock_thread_doc = MagicMock()
    mock_thread_doc.exists = True
    mock_thread_doc.to_dict.return_value = {'unreadCount': unread_count}
    
    # Setup chain: db.collection().document().collection().document().get()
    mock_db.collection.return_value.document.return_value.collection.return_value.document.return_value.get.return_value = mock_thread_doc
    
    return mock_db

def test_should_send_notification_first_notification() -> None:
    """Test first notification timing (1 hour after registration)."""
    now = datetime.now(timezone.utc)
    
    # Registered 2 hours ago - should send
    user_2h_ago = {
        'createdAt': (now - timedelta(hours=2)).isoformat(),
        'notification_state': {
            'notification_count': 0,
        }
    }
    assert should_send_notification(user_2h_ago) is True
    
    # Registered 30 minutes ago - too soon
    user_30m_ago = {
        'createdAt': (now - timedelta(minutes=30)).isoformat(),
        'notification_state': {
            'notification_count': 0,
        }
    }
    assert should_send_notification(user_30m_ago) is False


def test_should_send_notification_progressive_intervals():
    """Test progressive intervals (6h, 24h, 48h, 7 days)."""
    now = datetime.now(timezone.utc)
    
    # 2nd notification - needs 6 hours
    user_2nd = {
        'createdAt': (now - timedelta(days=1)).isoformat(),
        'notification_state': {
            'notification_count': 1,
            'last_notification_at': (now - timedelta(hours=7)).isoformat(),
        }
    }
    assert should_send_notification(user_2nd) is True
    
    # 3rd notification - needs 24 hours
    user_3rd = {
        'createdAt': (now - timedelta(days=2)).isoformat(),
        'notification_state': {
            'notification_count': 2,
            'last_notification_at': (now - timedelta(hours=25)).isoformat(),
        }
    }
    assert should_send_notification(user_3rd) is True
    
    # 4th notification - needs 48 hours
    user_4th_too_soon = {
        'createdAt': (now - timedelta(days=10)).isoformat(),
        'notification_state': {
            'notification_count': 3,
            'last_notification_at': (now - timedelta(hours=24)).isoformat(),
        }
    }
    assert should_send_notification(user_4th_too_soon) is False
    
    user_4th_ok = {
        'createdAt': (now - timedelta(days=10)).isoformat(),
        'notification_state': {
            'notification_count': 3,
            'last_notification_at': (now - timedelta(hours=49)).isoformat(),
        }
    }
    assert should_send_notification(user_4th_ok) is True
    
    # 5+ notifications - needs 7 days (168 hours)
    user_5th_too_soon = {
        'createdAt': (now - timedelta(days=30)).isoformat(),
        'notification_state': {
            'notification_count': 8,
            'last_notification_at': (now - timedelta(days=3)).isoformat(),
        }
    }
    assert should_send_notification(user_5th_too_soon) is False
    
    user_5th_ok = {
        'createdAt': (now - timedelta(days=30)).isoformat(),
        'notification_state': {
            'notification_count': 8,
            'last_notification_at': (now - timedelta(days=8)).isoformat(),
        }
    }
    assert should_send_notification(user_5th_ok) is True


def test_was_active_recently():
    """Test recent activity detection."""
    now = datetime.now(timezone.utc)
    
    user_active = {
        'lastActivityAt': (now - timedelta(days=3)).isoformat(),
    }
    assert was_active_recently(user_active, days=6) is True
    assert was_active_recently(user_active, days=2) is False
    
    user_no_activity = {
        'lastActivityAt': None,
    }
    assert was_active_recently(user_no_activity, days=6) is False


def test_is_new_user():
    """Test new user detection."""
    now = datetime.now(timezone.utc)
    
    user_new = {
        'createdAt': (now - timedelta(days=7)).isoformat(),
    }
    assert is_new_user(user_new, days=14) is True
    assert is_new_user(user_new, days=5) is False
    
    user_old = {
        'createdAt': (now - timedelta(days=30)).isoformat(),
    }
    assert is_new_user(user_old, days=14) is False


def test_is_inactive():
    """Test inactive user detection."""
    now = datetime.now(timezone.utc)
    
    user_inactive = {
        'lastActivityAt': (now - timedelta(days=10)).isoformat(),
    }
    assert is_inactive(user_inactive, days=7) is True
    assert is_inactive(user_inactive, days=14) is False
    
    user_never_logged_in = {
        'lastActivityAt': None,
    }
    assert is_inactive(user_never_logged_in, days=7) is False


def test_determine_channel_push():
    """Test PUSH channel selection."""
    now = datetime.now(timezone.utc)
    
    # User with push permission and token - PUSH (regardless of activity/unread)
    user_push_eligible = {
        'notificationPermissionStatus': 'granted',
        'fcmToken': 'valid_token',
        'lastActivityAt': (now - timedelta(days=3)).isoformat(),
    }
    assert determine_channel(user_push_eligible, unread_count=5) == 'PUSH'
    assert determine_channel(user_push_eligible, unread_count=0) == 'PUSH'
    
    # Even inactive users get PUSH if they have permission and token
    user_inactive_with_push = {
        'notificationPermissionStatus': 'granted',
        'fcmToken': 'valid_token',
        'lastActivityAt': (now - timedelta(days=10)).isoformat(),
    }
    assert determine_channel(user_inactive_with_push, unread_count=3) == 'PUSH'


def test_determine_channel_email():
    """Test EMAIL channel selection as fallback."""
    now = datetime.now(timezone.utc)
    
    # No push permission, but not unsubscribed - EMAIL fallback
    user_email_no_push_permission = {
        'notificationPermissionStatus': 'denied',
        'fcmToken': None,
        'lastActivityAt': (now - timedelta(days=3)).isoformat(),
        'email_unsubscribed': False,
    }
    assert determine_channel(user_email_no_push_permission, unread_count=0) == 'EMAIL'
    assert determine_channel(user_email_no_push_permission, unread_count=5) == 'EMAIL'
    
    # Has push permission but no FCM token - EMAIL fallback
    user_email_no_token = {
        'notificationPermissionStatus': 'granted',
        'fcmToken': None,
        'lastActivityAt': (now - timedelta(days=3)).isoformat(),
        'email_unsubscribed': False,
    }
    assert determine_channel(user_email_no_token, unread_count=3) == 'EMAIL'


def test_determine_channel_none():
    """Test no channel available."""
    # No PUSH (denied/no token) and no EMAIL (unsubscribed) - no channel
    user_no_channel = {
        'notificationPermissionStatus': 'denied',
        'fcmToken': None,
        'email_unsubscribed': True,
    }
    assert determine_channel(user_no_channel, unread_count=0) is None
    assert determine_channel(user_no_channel, unread_count=5) is None


def test_determine_scenario_email_only_user():
    """Test EMAIL_ONLY_USER scenario."""
    mock_db = create_mock_db(unread_count=0)
    user_never_logged_in = {
        'lastActivityAt': None,
        'createdAt': '2025-11-20T10:00:00Z',
    }
    # EMAIL_ONLY_USER can work with any channel now
    assert determine_scenario(mock_db, 'test_user_id', user_never_logged_in, 'EMAIL') == 'EMAIL_ONLY_USER'
    assert determine_scenario(mock_db, 'test_user_id', user_never_logged_in, 'PUSH') == 'EMAIL_ONLY_USER'


def test_determine_scenario_new_user():
    """Test NEW_USER scenarios."""
    mock_db = create_mock_db(unread_count=0)
    now = datetime.now(timezone.utc)
    
    user_new = {
        'lastActivityAt': (now - timedelta(days=5)).isoformat(),
        'createdAt': (now - timedelta(days=7)).isoformat(),
    }
    
    assert determine_scenario(mock_db, 'test_user_id', user_new, 'PUSH') == 'NEW_USER_PUSH'
    assert determine_scenario(mock_db, 'test_user_id', user_new, 'EMAIL') == 'NEW_USER_EMAIL'


def test_determine_scenario_active_user():
    """Test ACTIVE_USER scenarios."""
    mock_db = create_mock_db(unread_count=0)
    now = datetime.now(timezone.utc)
    
    user_active = {
        'lastActivityAt': (now - timedelta(days=2)).isoformat(),
        'createdAt': (now - timedelta(days=30)).isoformat(),
    }
    
    assert determine_scenario(mock_db, 'test_user_id', user_active, 'PUSH') == 'ACTIVE_USER_PUSH'
    assert determine_scenario(mock_db, 'test_user_id', user_active, 'EMAIL') == 'ACTIVE_USER_EMAIL'


def test_determine_scenario_inactive_user():
    """Test INACTIVE_USER scenario."""
    now = datetime.now(timezone.utc)
    
    user_inactive = {
        'lastActivityAt': (now - timedelta(days=10)).isoformat(),
        'createdAt': (now - timedelta(days=60)).isoformat(),
    }
    
    # Test with no unread messages - should be ACTIVE_USER_* (not INACTIVE_USER)
    mock_db_no_unread = create_mock_db(unread_count=0)
    assert determine_scenario(mock_db_no_unread, 'test_user_id', user_inactive, 'EMAIL') == 'ACTIVE_USER_EMAIL'
    assert determine_scenario(mock_db_no_unread, 'test_user_id', user_inactive, 'PUSH') == 'ACTIVE_USER_PUSH'
    
    # Test with unread messages - should be INACTIVE_USER (priority scenario)
    # Can work with both PUSH and EMAIL channels now
    mock_db_with_unread = create_mock_db(unread_count=5)
    assert determine_scenario(mock_db_with_unread, 'test_user_id', user_inactive, 'EMAIL') == 'INACTIVE_USER'
    assert determine_scenario(mock_db_with_unread, 'test_user_id', user_inactive, 'PUSH') == 'INACTIVE_USER'


if __name__ == '__main__':
    print("Running notification logic tests...")
    
    # Timing tests
    test_should_send_notification_first_notification()
    print("✓ First notification timing")
    
    test_should_send_notification_progressive_intervals()
    print("✓ Progressive intervals")
    
    # Helper function tests
    test_was_active_recently()
    print("✓ Recent activity detection")
    
    test_is_new_user()
    print("✓ New user detection")
    
    test_is_inactive()
    print("✓ Inactive user detection")
    
    # Channel selection tests
    test_determine_channel_push()
    print("✓ PUSH channel selection")
    
    test_determine_channel_email()
    print("✓ EMAIL channel selection")
    
    test_determine_channel_none()
    print("✓ No channel detection")
    
    # Scenario tests
    test_determine_scenario_email_only_user()
    print("✓ EMAIL_ONLY_USER scenario")
    
    test_determine_scenario_new_user()
    print("✓ NEW_USER scenarios")
    
    test_determine_scenario_active_user()
    print("✓ ACTIVE_USER scenarios")
    
    test_determine_scenario_inactive_user()
    print("✓ INACTIVE_USER scenario (placeholder)")
    
    print("\n✅ All tests passed!")

