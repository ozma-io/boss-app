# type: ignore
# pyright: reportGeneralTypeIssues=false
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
    determine_user_category,  # type: ignore
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
    assert should_send_notification(user_2h_ago, 'EMAIL_ONLY_USER') is True
    
    # Registered 30 minutes ago - too soon
    user_30m_ago = {
        'createdAt': (now - timedelta(minutes=30)).isoformat(),
        'notification_state': {
            'notification_count': 0,
        }
    }
    assert should_send_notification(user_30m_ago, 'EMAIL_ONLY_USER') is False


def test_should_send_notification_progressive_intervals():
    """Test progressive intervals with category-specific schedules."""
    now = datetime.now(timezone.utc)
    
    # Test EMAIL_ONLY_USER category (standard intervals: 1h, 6h, 24h, 48h, 7d)
    # 2nd notification - needs 6 hours
    user_2nd = {
        'createdAt': (now - timedelta(days=1)).isoformat(),
        'notification_state': {
            'notification_count': 1,
            'last_notification_at': (now - timedelta(hours=7)).isoformat(),
        }
    }
    assert should_send_notification(user_2nd, 'EMAIL_ONLY_USER') is True
    
    # 3rd notification - needs 24 hours
    user_3rd = {
        'createdAt': (now - timedelta(days=2)).isoformat(),
        'notification_state': {
            'notification_count': 2,
            'last_notification_at': (now - timedelta(hours=25)).isoformat(),
        }
    }
    assert should_send_notification(user_3rd, 'EMAIL_ONLY_USER') is True
    
    # 4th notification - needs 48 hours
    user_4th_too_soon = {
        'createdAt': (now - timedelta(days=10)).isoformat(),
        'notification_state': {
            'notification_count': 3,
            'last_notification_at': (now - timedelta(hours=24)).isoformat(),
        }
    }
    assert should_send_notification(user_4th_too_soon, 'EMAIL_ONLY_USER') is False
    
    user_4th_ok = {
        'createdAt': (now - timedelta(days=10)).isoformat(),
        'notification_state': {
            'notification_count': 3,
            'last_notification_at': (now - timedelta(hours=49)).isoformat(),
        }
    }
    assert should_send_notification(user_4th_ok, 'EMAIL_ONLY_USER') is True
    
    # 5+ notifications - needs 7 days (168 hours)
    user_5th_too_soon = {
        'createdAt': (now - timedelta(days=30)).isoformat(),
        'notification_state': {
            'notification_count': 8,
            'last_notification_at': (now - timedelta(days=3)).isoformat(),
        }
    }
    assert should_send_notification(user_5th_too_soon, 'EMAIL_ONLY_USER') is False
    
    user_5th_ok = {
        'createdAt': (now - timedelta(days=30)).isoformat(),
        'notification_state': {
            'notification_count': 8,
            'last_notification_at': (now - timedelta(days=8)).isoformat(),
        }
    }
    assert should_send_notification(user_5th_ok, 'EMAIL_ONLY_USER') is True
    
    # Test NEW_USER_PUSH category (faster intervals: 1h, 3h, 12h, 24h, 3d)
    # 2nd notification - needs 3 hours (not 6)
    user_2nd_push = {
        'createdAt': (now - timedelta(days=1)).isoformat(),
        'notification_state': {
            'notification_count': 1,
            'last_notification_at': (now - timedelta(hours=4)).isoformat(),
        }
    }
    assert should_send_notification(user_2nd_push, 'NEW_USER_PUSH') is True
    
    # Test INACTIVE_USER_EMAIL category (slower intervals: 1h, 12h, 48h, 7d, 14d)
    # 2nd notification - needs 12 hours (not 6)
    user_2nd_inactive = {
        'createdAt': (now - timedelta(days=1)).isoformat(),
        'notification_state': {
            'notification_count': 1,
            'last_notification_at': (now - timedelta(hours=13)).isoformat(),
        }
    }
    assert should_send_notification(user_2nd_inactive, 'INACTIVE_USER_EMAIL') is True


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


def test_determine_user_category_email_only():
    """Test EMAIL_ONLY_USER category."""
    mock_db = create_mock_db(unread_count=0)
    
    # Never logged in with email available
    user_never_logged_in = {
        'lastActivityAt': None,
        'createdAt': '2025-11-20T10:00:00Z',
        'email_unsubscribed': False,
    }
    assert determine_user_category(mock_db, 'test_user_id', user_never_logged_in) == 'EMAIL_ONLY_USER'


def test_determine_user_category_new_user_push():
    """Test NEW_USER_PUSH category."""
    mock_db = create_mock_db(unread_count=0)
    now = datetime.now(timezone.utc)
    
    # New user with push enabled
    user_new_push = {
        'lastActivityAt': (now - timedelta(days=5)).isoformat(),
        'createdAt': (now - timedelta(days=7)).isoformat(),
        'notificationPermissionStatus': 'granted',
        'fcmToken': 'valid_token',
    }
    assert determine_user_category(mock_db, 'test_user_id', user_new_push) == 'NEW_USER_PUSH'
    
    # Never logged in but has push setup (edge case)
    user_never_logged_push = {
        'lastActivityAt': None,
        'createdAt': (now - timedelta(days=2)).isoformat(),
        'notificationPermissionStatus': 'granted',
        'fcmToken': 'valid_token',
        'email_unsubscribed': True,  # No email available
    }
    assert determine_user_category(mock_db, 'test_user_id', user_never_logged_push) == 'NEW_USER_PUSH'


def test_determine_user_category_new_user_email():
    """Test NEW_USER_EMAIL category."""
    mock_db = create_mock_db(unread_count=0)
    now = datetime.now(timezone.utc)
    
    # New user without push, with email
    user_new_email = {
        'lastActivityAt': (now - timedelta(days=5)).isoformat(),
        'createdAt': (now - timedelta(days=7)).isoformat(),
        'notificationPermissionStatus': 'denied',
        'email_unsubscribed': False,
    }
    assert determine_user_category(mock_db, 'test_user_id', user_new_email) == 'NEW_USER_EMAIL'


def test_determine_user_category_active_push():
    """Test ACTIVE_USER_PUSH category."""
    mock_db = create_mock_db(unread_count=0)
    now = datetime.now(timezone.utc)
    
    # Active user with push enabled
    user_active_push = {
        'lastActivityAt': (now - timedelta(days=2)).isoformat(),
        'createdAt': (now - timedelta(days=30)).isoformat(),
        'notificationPermissionStatus': 'granted',
        'fcmToken': 'valid_token',
    }
    assert determine_user_category(mock_db, 'test_user_id', user_active_push) == 'ACTIVE_USER_PUSH'


def test_determine_user_category_active_email():
    """Test ACTIVE_USER_EMAIL category."""
    mock_db = create_mock_db(unread_count=0)
    now = datetime.now(timezone.utc)
    
    # Active user without push, with email
    user_active_email = {
        'lastActivityAt': (now - timedelta(days=2)).isoformat(),
        'createdAt': (now - timedelta(days=30)).isoformat(),
        'notificationPermissionStatus': 'denied',
        'email_unsubscribed': False,
    }
    assert determine_user_category(mock_db, 'test_user_id', user_active_email) == 'ACTIVE_USER_EMAIL'


def test_determine_user_category_inactive_email():
    """Test INACTIVE_USER_EMAIL category."""
    now = datetime.now(timezone.utc)
    
    # Inactive user with unread messages and email available
    user_inactive_email = {
        'lastActivityAt': (now - timedelta(days=10)).isoformat(),
        'createdAt': (now - timedelta(days=60)).isoformat(),
        'email_unsubscribed': False,
    }
    
    # With unread messages - should be INACTIVE_USER_EMAIL
    mock_db_with_unread = create_mock_db(unread_count=5)
    assert determine_user_category(mock_db_with_unread, 'test_user_id', user_inactive_email) == 'INACTIVE_USER_EMAIL'
    
    # Without unread messages - should be ACTIVE_USER_EMAIL (not inactive)
    mock_db_no_unread = create_mock_db(unread_count=0)
    assert determine_user_category(mock_db_no_unread, 'test_user_id', user_inactive_email) == 'ACTIVE_USER_EMAIL'
    
    # Inactive with unread but has push - should still be INACTIVE_USER_EMAIL (EMAIL only per business rules)
    user_inactive_push = {
        'lastActivityAt': (now - timedelta(days=10)).isoformat(),
        'createdAt': (now - timedelta(days=60)).isoformat(),
        'notificationPermissionStatus': 'granted',
        'fcmToken': 'valid_token',
        'email_unsubscribed': False,
    }
    assert determine_user_category(mock_db_with_unread, 'test_user_id', user_inactive_push) == 'INACTIVE_USER_EMAIL'
    
    # Inactive with unread but no email channel - should return None
    user_inactive_no_email = {
        'lastActivityAt': (now - timedelta(days=10)).isoformat(),
        'createdAt': (now - timedelta(days=60)).isoformat(),
        'notificationPermissionStatus': 'granted',
        'fcmToken': 'valid_token',
        'email_unsubscribed': True,
    }
    assert determine_user_category(mock_db_with_unread, 'test_user_id', user_inactive_no_email) is None


def test_determine_user_category_no_channel():
    """Test no channel available returns None."""
    mock_db = create_mock_db(unread_count=0)
    
    # No push and email unsubscribed
    user_no_channel = {
        'lastActivityAt': None,
        'createdAt': '2025-11-20T10:00:00Z',
        'notificationPermissionStatus': 'denied',
        'email_unsubscribed': True,
    }
    assert determine_user_category(mock_db, 'test_user_id', user_no_channel) is None


if __name__ == '__main__':
    print("Running notification logic tests...")
    
    # Timing tests
    test_should_send_notification_first_notification()
    print("✓ First notification timing (category-specific)")
    
    test_should_send_notification_progressive_intervals()
    print("✓ Progressive intervals (category-specific)")
    
    # Helper function tests
    test_was_active_recently()
    print("✓ Recent activity detection")
    
    test_is_new_user()
    print("✓ New user detection")
    
    test_is_inactive()
    print("✓ Inactive user detection")
    
    # Category determination tests
    test_determine_user_category_email_only()
    print("✓ EMAIL_ONLY_USER category")
    
    test_determine_user_category_new_user_push()
    print("✓ NEW_USER_PUSH category")
    
    test_determine_user_category_new_user_email()
    print("✓ NEW_USER_EMAIL category")
    
    test_determine_user_category_active_push()
    print("✓ ACTIVE_USER_PUSH category")
    
    test_determine_user_category_active_email()
    print("✓ ACTIVE_USER_EMAIL category")
    
    test_determine_user_category_inactive_email()
    print("✓ INACTIVE_USER_EMAIL category")
    
    test_determine_user_category_no_channel()
    print("✓ No channel detection")
    
    print("\n✅ All tests passed!")

