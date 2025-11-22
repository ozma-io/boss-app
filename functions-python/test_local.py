"""
Local testing script for notification orchestrator.

Run this script to test the notification orchestration logic locally
without deploying to Firebase.

Requirements:
1. Set GOOGLE_APPLICATION_CREDENTIALS environment variable
2. Install dependencies: pip install -r requirements.txt

Usage:
    export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
    python test_local.py
"""

import logging
import os
import sys

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


def check_credentials() -> bool:
    """Check if Firebase credentials are configured."""
    creds_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
    
    if not creds_path:
        logger.error("GOOGLE_APPLICATION_CREDENTIALS environment variable not set")
        logger.error("Please set it to the path of your service account key JSON file:")
        logger.error('  export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"')
        return False
    
    if not os.path.exists(creds_path):
        logger.error(f"Credentials file not found: {creds_path}")
        return False
    
    logger.info(f"Using credentials from: {creds_path}")
    return True


def main() -> None:
    """Run local test of notification orchestration."""
    logger.info("=" * 60)
    logger.info("Starting local test of notification orchestrator")
    logger.info("=" * 60)
    
    # Check credentials
    if not check_credentials():
        sys.exit(1)
    
    try:
        # Import business logic functions
        from main import get_firestore_client, process_notification_orchestration
        
        # Get Firestore client
        logger.info("Initializing Firestore client...")
        db = get_firestore_client()
        
        # Run orchestration logic
        logger.info("Running notification orchestration...")
        processed_count = process_notification_orchestration(db)
        
        logger.info("=" * 60)
        logger.info("✓ Test completed successfully!")
        logger.info(f"✓ Processed {processed_count} users")
        logger.info("=" * 60)
        
    except Exception as e:
        logger.error("=" * 60)
        logger.error(f"✗ Test failed with error: {e}")
        logger.error("=" * 60)
        raise


if __name__ == '__main__':
    main()

