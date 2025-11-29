# type: ignore
# pyright: reportGeneralTypeIssues=false
"""
Test script to display user categories for notification system.

This script fetches users needing notifications and displays:
- User ID and email
- User category (EMAIL_ONLY_USER, NEW_USER_PUSH, ACTIVE_USER_EMAIL, etc.)
- Hours since last communication

Requirements:
1. Set GOOGLE_APPLICATION_CREDENTIALS environment variable
2. Install dependencies: pip install -r requirements.txt

Usage:
    export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
    python test_channels_scenarios.py
"""

import logging
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

# Configure logging first
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

# Load environment variables from .env file in boss-app root (2 levels up)
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


def main() -> None:
    """Run test to display user categories for all users."""
    logger.info("=" * 100)
    logger.info("Testing User Categories for Notification System")
    logger.info("=" * 100)
    
    # Check credentials
    if not check_credentials():
        sys.exit(1)
    
    try:
        # Add parent directory to path for imports
        sys.path.insert(0, str(Path(__file__).parent.parent))
        
        # Import functions
        from main import get_firestore_client
        from data.notification_data import get_users_needing_notifications
        from orchestrators.notification_logic import (
            determine_user_category,
        )
        
        # Get Firestore client
        logger.info("Initializing Firestore client...")
        db = get_firestore_client()
        
        # Fetch users needing notifications
        logger.info("Fetching users needing notifications (48+ hours)...")
        users = get_users_needing_notifications(db, hours_threshold=48)
        
        logger.info(f"Found {len(users)} users needing notifications")
        logger.info("")
        
        # Display results in table format
        print("=" * 100)
        print("USER CATEGORIES")
        print("=" * 100)
        print("┌──────────────────────┬────────────────────────────────┬─────────────────────────┬─────────┐")
        print("│ User ID              │ Email                          │ Category                │ Hours   │")
        print("├──────────────────────┼────────────────────────────────┼─────────────────────────┼─────────┤")
        
        # Statistics
        category_stats: dict[str, int] = {}
        
        for user in users:
            # Build user_data dict for notification_logic functions
            user_data = {
                'lastActivityAt': user.last_activity_at,
                'createdAt': user.created_at,
                'notificationPermissionStatus': user.notification_permission_status,
                'fcmToken': user.fcm_token,
                'email_unsubscribed': user.email_unsubscribed,
            }
            
            # Determine user category (combines channel + scenario logic)
            category = determine_user_category(db, user.user_id, user_data)
            
            # Update statistics
            category_stats[category] = category_stats.get(category, 0) + 1
            
            # Display row
            category_display = category
            email_display = user.email[:30] if user.email else ''
            user_id_display = user.user_id[:20]
            
            print(f"│ {user_id_display:<20} │ {email_display:<30} │ {category_display:<23} │ {user.hours_since_last_communication:>7.1f} │")
        
        print("└──────────────────────┴────────────────────────────────┴─────────────────────────┴─────────┘")
        print("")
        
        # Display statistics
        print("=" * 100)
        print("STATISTICS")
        print("=" * 100)
        print(f"Total users: {len(users)}")
        print("")
        print("Categories:")
        for category, count in sorted(category_stats.items()):
            percentage = (count / len(users) * 100) if len(users) > 0 else 0
            print(f"  {category:<25} : {count:>3} users ({percentage:>5.1f}%)")
        print("=" * 100)
        
    except Exception as e:
        logger.error("=" * 110)
        logger.error(f"✗ Test failed with error: {e}")
        logger.error("=" * 110)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()

