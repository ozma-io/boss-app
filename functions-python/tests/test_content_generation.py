"""
Test script to verify AI-powered notification content generation.

This script tests all four content generation functions with a real user from the database:
- First email notification (welcome email)
- Ongoing email notification (follow-up email)
- First push notification (welcome push)
- Ongoing push notification (follow-up push)

Requirements:
1. Set GOOGLE_APPLICATION_CREDENTIALS environment variable
2. Install dependencies: pip install -r requirements.txt
3. Set OPENAI_API_KEY in .env file
4. (Optional) Set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY for observability

Usage:
    export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
    python tests/test_content_generation.py [user_id]

If no user_id provided, script will use the first user it finds.
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


def check_openai_key() -> bool:
    """Check if OpenAI API key is configured."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        logger.error("OPENAI_API_KEY not found in environment")
        logger.error("Please add it to .env file in boss-app root directory")
        return False
    
    logger.info("OpenAI API key found")
    return True


def check_langfuse_keys() -> None:
    """Check if LangFuse keys are configured (optional)."""
    public_key = os.getenv("LANGFUSE_PUBLIC_KEY")
    secret_key = os.getenv("LANGFUSE_SECRET_KEY")
    
    if public_key and secret_key:
        logger.info("LangFuse keys found - observability enabled")
    else:
        logger.warning("LangFuse keys not found - observability disabled (optional)")


def truncate_text(text: str, max_length: int) -> str:
    """Truncate text with ellipsis if longer than max_length."""
    if len(text) <= max_length:
        return text
    return text[:max_length - 3] + "..."


def print_section_header(title: str) -> None:
    """Print a formatted section header."""
    print("\n" + "=" * 100)
    print(f"  {title}")
    print("=" * 100)


def print_field(label: str, value: str, truncate_at: int | None = None) -> None:
    """Print a labeled field with optional truncation."""
    if truncate_at:
        value = truncate_text(value, truncate_at)
    print(f"\n{label}:")
    print(f"  {value}")


def main() -> None:
    """Run test to verify content generation for a user."""
    print("\n" + "=" * 100)
    print("  Testing AI-Powered Notification Content Generation")
    print("=" * 100)
    
    # Check credentials
    if not check_credentials():
        sys.exit(1)
    
    # Check OpenAI API key (required)
    if not check_openai_key():
        sys.exit(1)
    
    # Check LangFuse keys (optional)
    check_langfuse_keys()
    
    # Import Firebase after checking credentials
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
        
        # Initialize Firebase (if not already initialized)
        if not firebase_admin._apps:
            firebase_admin.initialize_app()
        
        db = firestore.client()
        logger.info("Firebase initialized successfully")
    except Exception as error:
        logger.error(f"Failed to initialize Firebase: {error}")
        sys.exit(1)
    
    # Get user_id from command line or find first user
    user_id = None
    if len(sys.argv) > 1:
        user_id = sys.argv[1]
        logger.info(f"Using user_id from command line: {user_id}")
    else:
        logger.info("No user_id provided, finding first user in database...")
        try:
            users = db.collection("users").limit(1).get()
            if not users:
                logger.error("No users found in database")
                sys.exit(1)
            user_id = users[0].id
            logger.info(f"Using first user found: {user_id}")
        except Exception as error:
            logger.error(f"Failed to fetch user: {error}")
            sys.exit(1)
    
    # Verify user exists
    try:
        user_doc = db.collection("users").document(user_id).get()
        if not user_doc.exists:
            logger.error(f"User {user_id} not found in database")
            sys.exit(1)
        
        user_data = user_doc.to_dict()
        user_email = user_data.get("email", "Unknown") if user_data else "Unknown"
        logger.info(f"Testing with user: {user_id} ({user_email})")
    except Exception as error:
        logger.error(f"Failed to fetch user: {error}")
        sys.exit(1)
    
    # Import content generation functions
    try:
        from data.notification_content import (
            generate_first_email_notification,
            generate_first_push_notification,
            generate_ongoing_email_notification,
            generate_ongoing_push_notification,
        )
    except Exception as error:
        logger.error(f"Failed to import content generation functions: {error}")
        sys.exit(1)
    
    # Test session ID for tracking
    test_session_id = f"test_session_{user_id}"
    
    # ========================================================================
    # Test 1: First Email Notification
    # ========================================================================
    print_section_header("Test 1: First Email Notification (Welcome Email)")
    
    try:
        content = generate_first_email_notification(db, user_id, test_session_id)
        
        print_field("Reasoning (first 200 chars)", content.reasoning, 200)
        print_field("Title", content.title)
        print_field("Body (first 500 chars)", content.body, 500)
        
        print(f"\n✅ First email notification generated successfully")
        print(f"   Title length: {len(content.title)} chars")
        print(f"   Body length: {len(content.body)} chars")
        
    except Exception as error:
        print(f"\n❌ First email notification failed: {error}")
        logger.error(f"First email generation failed: {error}")
    
    # ========================================================================
    # Test 2: Ongoing Email Notification
    # ========================================================================
    print_section_header("Test 2: Ongoing Email Notification (Follow-up Email)")
    
    try:
        content = generate_ongoing_email_notification(
            db, user_id, "weekly_checkin", test_session_id
        )
        
        print_field("Reasoning (first 200 chars)", content.reasoning, 200)
        print_field("Title", content.title)
        print_field("Body (first 500 chars)", content.body, 500)
        
        print(f"\n✅ Ongoing email notification generated successfully")
        print(f"   Title length: {len(content.title)} chars")
        print(f"   Body length: {len(content.body)} chars")
        
    except Exception as error:
        print(f"\n❌ Ongoing email notification failed: {error}")
        logger.error(f"Ongoing email generation failed: {error}")
    
    # ========================================================================
    # Test 3: First Push Notification
    # ========================================================================
    print_section_header("Test 3: First Push Notification (Welcome Push)")
    
    try:
        content = generate_first_push_notification(db, user_id, test_session_id)
        
        print_field("Reasoning (first 200 chars)", content.reasoning, 200)
        print_field("Message", content.message)
        
        print(f"\n✅ First push notification generated successfully")
        print(f"   Message length: {len(content.message)} chars")
        
    except Exception as error:
        print(f"\n❌ First push notification failed: {error}")
        logger.error(f"First push generation failed: {error}")
    
    # ========================================================================
    # Test 4: Ongoing Push Notification
    # ========================================================================
    print_section_header("Test 4: Ongoing Push Notification (Follow-up Push)")
    
    try:
        content = generate_ongoing_push_notification(
            db, user_id, "daily_checkin", test_session_id
        )
        
        print_field("Reasoning (first 200 chars)", content.reasoning, 200)
        print_field("Message", content.message)
        
        print(f"\n✅ Ongoing push notification generated successfully")
        print(f"   Message length: {len(content.message)} chars")
        
    except Exception as error:
        print(f"\n❌ Ongoing push notification failed: {error}")
        logger.error(f"Ongoing push generation failed: {error}")
    
    # ========================================================================
    # Summary
    # ========================================================================
    print_section_header("Test Complete")
    print(f"\nAll content generation functions tested for user: {user_id}")
    print(f"User email: {user_email}")
    print(f"\nIf LangFuse keys are configured, check the dashboard for detailed traces:")
    print(f"  Session ID: {test_session_id}")
    print()


if __name__ == "__main__":
    main()

