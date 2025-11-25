"""
Test script to display progressive notification intervals for each user.

Shows:
- User ID and email
- Notification count (how many notifications already sent)
- Required interval (hours to wait before next notification)
- Hours since last communication
- Ready to send? (Yes/No)

Requirements:
1. Install dependencies in virtual environment
2. Ensure `.env` file exists in `boss-app/` root with Firebase credentials

Usage:
    source .venv/bin/activate
    python tests/test_intervals.py
"""

import logging
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# Configure logging first
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

# Load environment variables from .env file in parent directory (boss-app root)
env_path = Path(__file__).parent.parent.parent / '.env'
if env_path.exists():
    load_dotenv(env_path)
    logger.info(f"Loaded environment variables from {env_path}")
else:
    logger.warning(f".env file not found at {env_path}")


def check_credentials() -> bool:
    """Check if Firebase credentials are configured."""
    creds_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
    
    if creds_path:
        if not os.path.exists(creds_path):
            logger.error(f"Credentials file not found: {creds_path}")
            return False
        logger.info(f"Using credentials from: {creds_path}")
        return True
    
    # Try application default credentials
    logger.warning("GOOGLE_APPLICATION_CREDENTIALS not set, attempting to use application default credentials")
    logger.info("This will work if you've run 'gcloud auth application-default login'")
    return True


def format_table_row(
    user_id: str,
    email: str,
    notif_count: int,
    required_interval: int,
    hours_since: float,
    ready: bool
) -> str:
    """Format a table row with fixed column widths."""
    # Truncate long values
    user_id_short = user_id[:18] if len(user_id) > 18 else user_id
    email_short = email[:28] if len(email) > 28 else email
    
    ready_str = "✓ Yes" if ready else "No"
    
    return (
        f"│ {user_id_short:<18} │ {email_short:<28} │ "
        f"{notif_count:>5} │ {required_interval:>6}h │ {hours_since:>7.1f}h │ {ready_str:<6} │"
    )


def main() -> None:
    """Run test to display progressive intervals for all users."""
    logger.info("=" * 100)
    logger.info("Testing Progressive Notification Intervals")
    logger.info("=" * 100)
    
    # Check credentials
    if not check_credentials():
        sys.exit(1)
    
    try:
        # Add parent directory to path for imports
        sys.path.insert(0, str(Path(__file__).parent.parent))
        
        # Import functions
        from main import get_firestore_client
        from data.notification_data import calculate_notification_interval
        from datetime import datetime, timezone
        
        # Get Firestore client
        logger.info("Initializing Firestore client...")
        db = get_firestore_client()
        
        # Fetch ALL users (not just those ready for notifications)
        logger.info("Fetching all users...")
        users_ref = db.collection('users')  # type: ignore
        all_users = users_ref.stream()  # type: ignore
        
        current_time = datetime.now(timezone.utc)
        
        users_data = []
        for user_doc in all_users:  # type: ignore
            user_id = user_doc.id  # type: ignore
            user_data = user_doc.to_dict()  # type: ignore
            
            if not user_data:
                continue
            
            # Skip email unsubscribed users
            if user_data.get('email_unsubscribed', False):
                continue
            
            # Get notification state
            notification_state = user_data.get('notification_state', {})
            notification_count = notification_state.get('notification_count', 0)
            last_notification_at_str = notification_state.get('last_notification_at')
            
            # Calculate required interval
            required_interval = calculate_notification_interval(notification_count)
            
            # Calculate hours since last communication
            if last_notification_at_str:
                last_time = datetime.fromisoformat(last_notification_at_str.replace('Z', '+00:00'))
            else:
                created_at_str = user_data.get('createdAt')
                if not created_at_str:
                    continue
                last_time = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
            
            hours_since = (current_time - last_time).total_seconds() / 3600
            ready = hours_since >= required_interval
            
            users_data.append({
                'user_id': user_id,
                'email': user_data.get('email', ''),
                'notification_count': notification_count,
                'required_interval': required_interval,
                'hours_since': hours_since,
                'ready': ready
            })
        
        # Sort by notification_count (ascending) then by hours_since (descending)
        users_data.sort(key=lambda x: (x['notification_count'], -x['hours_since']))
        
        logger.info(f"Found {len(users_data)} users")
        logger.info("")
        
        # Display results in table format
        print("=" * 100)
        print("PROGRESSIVE NOTIFICATION INTERVALS")
        print("=" * 100)
        print("┌────────────────────┬──────────────────────────────┬───────┬────────┬─────────┬────────┐")
        print("│ User ID            │ Email                        │ Count │ Need   │ Since   │ Ready? │")
        print("├────────────────────┼──────────────────────────────┼───────┼────────┼─────────┼────────┤")
        
        # Statistics
        interval_stats: dict[int, int] = {}
        ready_count = 0
        
        for user in users_data:
            interval = user['required_interval']
            interval_stats[interval] = interval_stats.get(interval, 0) + 1
            if user['ready']:
                ready_count += 1
            
            # Display row
            print(format_table_row(
                user['user_id'],
                user['email'],
                user['notification_count'],
                user['required_interval'],
                user['hours_since'],
                user['ready']
            ))
        
        print("└────────────────────┴──────────────────────────────┴───────┴────────┴─────────┴────────┘")
        print("")
        
        # Display statistics
        print("=" * 100)
        print("STATISTICS")
        print("=" * 100)
        print(f"Total users: {len(users_data)}")
        print(f"Ready to send: {ready_count} users ({ready_count / len(users_data) * 100:.1f}%)")
        print("")
        print("Interval Distribution:")
        for interval in sorted(interval_stats.keys()):
            count = interval_stats[interval]
            percentage = (count / len(users_data) * 100) if len(users_data) > 0 else 0
            print(f"  {interval:>2}h interval : {count:>3} users ({percentage:>5.1f}%)")
        print("")
        print("Progressive Intervals Logic:")
        print("  1st notification:  1 hour after registration")
        print("  2nd notification:  6 hours after 1st")
        print("  3rd notification: 24 hours after 2nd")
        print("  4+  notifications: 48 hours between each")
        print("=" * 100)
        
    except Exception as e:
        logger.error("=" * 100)
        logger.error(f"✗ Test failed with error: {e}")
        logger.error("=" * 100)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()

