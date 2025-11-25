"""
Test script to display channel and scenario for each user.

This script fetches users needing notifications and displays:
- User ID and email
- Notification channel (PUSH/EMAIL/NONE)
- Notification scenario (EMAIL_ONLY_USER, NEW_USER_PUSH, etc.)
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


def format_table_row(user_id: str, email: str, channel: str, scenario: str, hours: float) -> str:
    """Format a table row with fixed column widths."""
    # Truncate long values
    user_id_short = user_id[:20] if len(user_id) > 20 else user_id
    email_short = email[:30] if len(email) > 30 else email
    
    return f"│ {user_id_short:<20} │ {email_short:<30} │ {channel:<8} │ {scenario:<20} │ {hours:>6.1f}h │"


def main() -> None:
    """Run test to display channels and scenarios for all users."""
    logger.info("=" * 110)
    logger.info("Testing Notification Channels and Scenarios")
    logger.info("=" * 110)
    
    # Check credentials
    if not check_credentials():
        sys.exit(1)
    
    try:
        # Add parent directory to path for imports
        sys.path.insert(0, str(Path(__file__).parent.parent))
        
        # Import functions
        from main import get_firestore_client
        from data.notification_data import (
            get_users_needing_notifications,
            determine_channel,
            determine_scenario
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
        print("=" * 110)
        print("NOTIFICATION CHANNELS AND SCENARIOS")
        print("=" * 110)
        print("┌──────────────────────┬────────────────────────────────┬──────────┬──────────────────────┬─────────┐")
        print("│ User ID              │ Email                          │ Channel  │ Scenario             │ Hours   │")
        print("├──────────────────────┼────────────────────────────────┼──────────┼──────────────────────┼─────────┤")
        
        # Statistics
        channel_stats: dict[str, int] = {'PUSH': 0, 'EMAIL': 0, 'NONE': 0}
        scenario_stats: dict[str, int] = {}
        
        for user in users:
            # Determine channel and scenario
            channel = determine_channel(user)
            scenario = determine_scenario(user, channel)
            
            # Update statistics
            channel_stats[channel] = channel_stats.get(channel, 0) + 1
            scenario_stats[scenario] = scenario_stats.get(scenario, 0) + 1
            
            # Display row
            print(format_table_row(
                user.user_id,
                user.email,
                channel,
                scenario,
                user.hours_since_last_communication
            ))
        
        print("└──────────────────────┴────────────────────────────────┴──────────┴──────────────────────┴─────────┘")
        print("")
        
        # Display statistics
        print("=" * 110)
        print("STATISTICS")
        print("=" * 110)
        print(f"Total users: {len(users)}")
        print("")
        print("Channels:")
        for channel, count in sorted(channel_stats.items()):
            percentage = (count / len(users) * 100) if len(users) > 0 else 0
            print(f"  {channel:<8} : {count:>3} users ({percentage:>5.1f}%)")
        print("")
        print("Scenarios:")
        for scenario, count in sorted(scenario_stats.items()):
            percentage = (count / len(users) * 100) if len(users) > 0 else 0
            print(f"  {scenario:<20} : {count:>3} users ({percentage:>5.1f}%)")
        print("=" * 110)
        
    except Exception as e:
        logger.error("=" * 110)
        logger.error(f"✗ Test failed with error: {e}")
        logger.error("=" * 110)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()

