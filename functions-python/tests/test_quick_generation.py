# type: ignore
# pyright: reportGeneralTypeIssues=false
"""
Quick test script to verify AI content generation and Langfuse integration.

This is a lightweight version that makes only ONE LLM call for fast testing.
Use this for quick validation of OpenAI API, Langfuse tracking, and basic functionality.

For comprehensive testing, use test_content_generation.py instead.

Usage:
    python tests/test_quick_generation.py [user_id]

If no user_id provided, script will use the first user it finds.
"""

import logging
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

# Load environment variables from .env file
env_path = Path(__file__).parent.parent.parent / '.env'
if env_path.exists():
    load_dotenv(env_path)
    logger.info(f"Loaded environment variables from {env_path}")
else:
    logger.warning(f".env file not found at {env_path}")


def check_credentials() -> bool:
    """Check if required credentials are configured."""
    openai_key = os.getenv("OPENAI_API_KEY")
    langfuse_public = os.getenv("LANGFUSE_PUBLIC_KEY")
    langfuse_secret = os.getenv("LANGFUSE_SECRET_KEY")
    
    if not openai_key:
        logger.error("OPENAI_API_KEY not found in environment")
        return False
    
    logger.info("✓ OpenAI API key found")
    
    if langfuse_public and langfuse_secret:
        logger.info("✓ Langfuse keys found - observability enabled")
    else:
        logger.warning("⚠ Langfuse keys not found - observability disabled")
    
    return True


def main() -> None:
    """Run quick generation test."""
    import firebase_admin
    from firebase_admin import firestore
    from data.notification_content import generate_first_email_notification
    
    logger.info("=" * 100)
    logger.info("  Quick AI Content Generation Test (1 LLM call)")
    logger.info("=" * 100)
    
    # Check credentials
    if not check_credentials():
        logger.error("Missing required credentials. Please check .env file.")
        sys.exit(1)
    
    # Get user_id from command line or find first user
    user_id = sys.argv[1] if len(sys.argv) > 1 else None
    
    # Initialize Firebase
    try:
        if not firebase_admin._apps:
            firebase_admin.initialize_app()
        db = firestore.client()
        logger.info("✓ Firebase initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize Firebase: {e}")
        sys.exit(1)
    
    # Find or validate user
    if not user_id:
        logger.info("No user_id provided, finding first user in database...")
        try:
            users_ref = db.collection('users')
            users = users_ref.limit(1).stream()
            user_doc = next(users, None)
            if not user_doc:
                logger.error("No users found in database")
                sys.exit(1)
            user_id = user_doc.id
            logger.info(f"✓ Using first user found: {user_id}")
        except Exception as e:
            logger.error(f"Failed to query users: {e}")
            sys.exit(1)
    
    # Get user info
    try:
        user_doc = db.collection('users').document(user_id).get()
        if not user_doc.exists:
            logger.error(f"User not found: {user_id}")
            sys.exit(1)
        
        user_data = user_doc.to_dict()
        user_email = user_data.get('email', 'N/A')
        logger.info(f"✓ Testing with user: {user_id} ({user_email})")
    except Exception as e:
        logger.error(f"Failed to get user data: {e}")
        sys.exit(1)
    
    # Generate unique session ID for this test
    import uuid
    session_id = f"quick_test_{user_id}_{uuid.uuid4().hex[:8]}"
    
    # Test: First Email Notification (Welcome Email)
    logger.info("")
    logger.info("=" * 100)
    logger.info("  Generating First Email Notification")
    logger.info("=" * 100)
    
    try:
        content = generate_first_email_notification(
            db=db,
            user_id=user_id,
            session_id=session_id,
        )
        
        logger.info("")
        logger.info("✅ Email notification generated successfully!")
        logger.info("")
        logger.info(f"Title: {content.title}")
        logger.info(f"  Length: {len(content.title)} chars")
        logger.info("")
        logger.info(f"Body preview (first 300 chars):")
        logger.info(f"  {content.body[:300]}...")
        logger.info(f"  Length: {len(content.body)} chars")
        logger.info("")
        
    except Exception as e:
        logger.error(f"❌ Failed to generate email notification: {e}")
        import traceback
        logger.error(traceback.format_exc())
        sys.exit(1)
    
    # Summary
    logger.info("=" * 100)
    logger.info("  Test Complete")
    logger.info("=" * 100)
    logger.info("")
    logger.info(f"User: {user_id} ({user_email})")
    logger.info(f"Session ID: {session_id}")
    logger.info("")
    logger.info("Check Langfuse dashboard for detailed trace:")
    logger.info("  https://us.cloud.langfuse.com")
    logger.info("")


if __name__ == "__main__":
    main()

