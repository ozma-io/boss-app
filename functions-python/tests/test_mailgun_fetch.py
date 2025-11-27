# type: ignore
# pyright: reportGeneralTypeIssues=false
"""
Test script to verify Mailgun API integration.

This script tests the fetch_mailgun_unsubscribes() function which is safe to run
in production as it only reads data from Mailgun API without modifying anything.

The test will:
1. Load Mailgun API key from environment
2. Call Mailgun Suppressions API to fetch unsubscribed emails
3. Display the results without modifying any data

Requirements:
1. Set MAILGUN_API_KEY environment variable (in .env file)
2. Install dependencies: pip install -r requirements.txt

Usage:
    python tests/test_mailgun_fetch.py
"""

import logging
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


def test_mailgun_fetch() -> None:
    """
    Test fetching unsubscribes from Mailgun API.
    
    This is safe to run in production as it only reads data.
    """
    import os
    from data.notification_data import fetch_mailgun_unsubscribes
    
    logger.info("=" * 80)
    logger.info("MAILGUN FETCH TEST")
    logger.info("=" * 80)
    
    # Get Mailgun API key from environment
    mailgun_api_key = os.environ.get('MAILGUN_API_KEY')
    if not mailgun_api_key:
        logger.error("MAILGUN_API_KEY not found in environment")
        logger.error("Please set MAILGUN_API_KEY in .env file")
        sys.exit(1)
    
    # Mask API key for logging (show only first 10 and last 4 chars)
    masked_key = mailgun_api_key[:10] + "..." + mailgun_api_key[-4:] if len(mailgun_api_key) > 14 else "***"
    logger.info(f"Using Mailgun API key: {masked_key}")
    
    mailgun_domain = 'mailgun.services.ozma.io'
    logger.info(f"Mailgun domain: {mailgun_domain}")
    
    try:
        # Fetch unsubscribes from Mailgun
        logger.info("\nFetching unsubscribes from Mailgun API...")
        unsubscribed_emails = fetch_mailgun_unsubscribes(mailgun_api_key, mailgun_domain)
        
        # Display results
        logger.info("\n" + "=" * 80)
        logger.info("RESULTS")
        logger.info("=" * 80)
        logger.info(f"Total unsubscribed emails found: {len(unsubscribed_emails)}")
        
        if unsubscribed_emails:
            logger.info("\nUnsubscribed emails:")
            for i, email in enumerate(unsubscribed_emails, 1):
                logger.info(f"  {i}. {email}")
        else:
            logger.info("\nNo unsubscribed emails found (good news!)")
        
        logger.info("\n" + "=" * 80)
        logger.info("TEST COMPLETED SUCCESSFULLY")
        logger.info("=" * 80)
        logger.info("\nMailgun API is working correctly!")
        logger.info("This was a read-only operation - no data was modified.")
        
    except ValueError as e:
        logger.error(f"\nMailgun API error: {e}")
        logger.error("\nPossible issues:")
        logger.error("1. Invalid API key")
        logger.error("2. Wrong domain name")
        logger.error("3. API permissions issue")
        sys.exit(1)
        
    except Exception as e:
        logger.error(f"\nUnexpected error: {e}")
        logger.error("\nPlease check:")
        logger.error("1. Internet connection")
        logger.error("2. Mailgun service status")
        logger.error("3. API key permissions")
        sys.exit(1)


if __name__ == "__main__":
    test_mailgun_fetch()


