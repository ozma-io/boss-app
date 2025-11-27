# type: ignore
# pyright: reportGeneralTypeIssues=false
"""
Test script to send email to test user using production LLM functions.

This script:
1. Generates email content using generate_first_email_notification() (production function)
2. Creates an email document in Firestore with the generated content
3. The TypeScript trigger processes it (convert Markdown to HTML, wrap in template, send via Mailgun)

This tests the full pipeline including:
- LLM-based content generation (OpenAI structured output)
- Email document creation
- TypeScript email processing trigger
- Mailgun delivery

Requirements:
1. Set GOOGLE_APPLICATION_CREDENTIALS environment variable
2. Set OPENAI_API_KEY environment variable (in .env file)
3. Install dependencies: pip install -r requirements.txt
4. Test user (test@ozma.io) must exist in the database

Usage:
    export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
    python tests/test_email_sending.py [--wait] [--onboarding]
    
Options:
    --wait        Wait and monitor email status until sent or failed (max 60 seconds)
    --onboarding  Test onboarding welcome email instead of first notification email
"""

import logging
import sys
import time
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

# Hardcoded test user email
TEST_USER_EMAIL = "test@ozma.io"


def check_credentials() -> bool:
    """Check if Firebase credentials are configured."""
    import os
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


def find_test_user(db) -> tuple[str, str] | None:
    """
    Find test user by email.
    
    Returns:
        Tuple of (user_id, email) or None if not found
    """
    try:
        users = db.collection("users").where("email", "==", TEST_USER_EMAIL).limit(1).get()
        
        if not users:
            logger.error(f"Test user not found with email: {TEST_USER_EMAIL}")
            return None
        
        user_doc = users[0]
        user_id = user_doc.id
        user_data = user_doc.to_dict()
        email = user_data.get("email") if user_data else None
        
        if not email:
            logger.error(f"User {user_id} has no email field")
            return None
        
        logger.info(f"Found test user: {user_id} ({email})")
        return (user_id, email)
        
    except Exception as error:
        logger.error(f"Failed to find test user: {error}")
        raise


def monitor_email_status(db, user_id: str, email_id: str, max_wait_seconds: int) -> None:
    """
    Monitor email document status until it changes from PLANNED or timeout.
    
    Args:
        db: Firestore client
        user_id: User document ID
        email_id: Email document ID
        max_wait_seconds: Maximum seconds to wait
    """
    print("\n" + "-" * 100)
    print("Monitoring email status...")
    print("-" * 100)
    
    email_ref = db.collection("users").document(user_id).collection("emails").document(email_id)
    start_time = time.time()
    check_interval = 2
    
    while True:
        elapsed = time.time() - start_time
        
        if elapsed >= max_wait_seconds:
            print(f"\n⏱️  Timeout after {max_wait_seconds} seconds")
            print("   Email is still being processed")
            print(f"   Check manually: users/{user_id}/emails/{email_id}")
            break
        
        try:
            email_doc = email_ref.get()
            if not email_doc.exists:
                print("\n❌ Email document not found!")
                break
            
            email_data = email_doc.to_dict()
            state = email_data.get("state") if email_data else None
            
            print(f"   [{int(elapsed)}s] State: {state}", end="\r")
            
            if state == "SENT":
                print("\n\n✅ Email sent successfully!")
                print(f"   Time taken: {int(elapsed)} seconds")
                if email_data:
                    sent_at = email_data.get("sentAt")
                    if sent_at:
                        print(f"   Sent at: {sent_at}")
                break
            
            if state == "FAILED":
                print("\n\n❌ Email sending failed!")
                if email_data:
                    error = email_data.get("error")
                    if error:
                        print(f"   Error: {error}")
                break
            
            time.sleep(check_interval)
            
        except Exception as error:
            print(f"\n❌ Error checking status: {error}")
            break
    
    print()


def main() -> None:
    """Run test to send email to test user."""
    # Check for flags
    wait_for_result = "--wait" in sys.argv
    test_onboarding = "--onboarding" in sys.argv
    
    email_type = "Onboarding Welcome" if test_onboarding else "First Notification"
    print("\n" + "=" * 100)
    print(f"  Testing Email Sending to test@ozma.io ({email_type})")
    print("=" * 100)
    
    # Check credentials
    if not check_credentials():
        sys.exit(1)
    
    # Import Firebase after checking credentials
    try:
        import firebase_admin
        from firebase_admin import firestore
        
        # Initialize Firebase (if not already initialized)
        if not firebase_admin._apps:
            firebase_admin.initialize_app()
        
        db = firestore.client()
        logger.info("Firebase initialized successfully")
    except Exception as error:
        logger.error(f"Failed to initialize Firebase: {error}")
        sys.exit(1)
    
    # Find test user
    user_info = find_test_user(db)
    if not user_info:
        logger.error("Cannot proceed without test user")
        sys.exit(1)
    
    user_id, user_email = user_info
    
    # Import required functions
    try:
        from data.email_operations import create_email_for_sending
        from data.notification_content import (
            generate_first_email_notification,
            generate_onboarding_welcome_email,
        )
    except Exception as error:
        logger.error(f"Failed to import functions: {error}")
        sys.exit(1)
    
    # Generate email content using production LLM function
    print("\n" + "-" * 100)
    print(f"Generating email content using LLM ({email_type.lower()})...")
    print("-" * 100)
    
    try:
        if test_onboarding:
            email_content = generate_onboarding_welcome_email(
                db=db,
                user_id=user_id,
                session_id="test_onboarding_email_script",
            )
        else:
            email_content = generate_first_email_notification(
                db=db,
                user_id=user_id,
                session_id="test_email_sending_script",
            )
        
        subject = email_content.title
        body_markdown = email_content.body
        
        print("\n✅ Content generated successfully!")
        print(f"   Subject: {subject}")
        print(f"   Body length: {len(body_markdown)} characters")
        print(f"   Reasoning: {email_content.reasoning[:100]}..." if len(email_content.reasoning) > 100 else f"   Reasoning: {email_content.reasoning}")
    except Exception as error:
        print(f"\n❌ Failed to generate content: {error}")
        logger.error(f"Content generation failed: {error}")
        sys.exit(1)
    
    # Send email
    print("\n" + "-" * 100)
    print(f"Creating email document for: {user_email}")
    print("-" * 100)
    
    try:
        email_id = create_email_for_sending(
            db=db,
            user_id=user_id,
            to_email=user_email,
            subject=subject,
            body_markdown=body_markdown,
        )
        
        print("\n✅ Email document created successfully!")
        print(f"   User ID: {user_id}")
        print(f"   Email ID: {email_id}")
        print(f"   To: {user_email}")
        print(f"   Subject: {subject}")
        print("\n📧 Email is now queued for processing by TypeScript trigger")
        print(f"   Check Firestore: users/{user_id}/emails/{email_id}")
        print("   Monitor the 'state' field: PLANNED → SENT or FAILED")
        
        # Wait for email to be sent if --wait flag is provided
        if wait_for_result:
            monitor_email_status(db, user_id, email_id, max_wait_seconds=60)
        else:
            print("\n💡 Tip: Use --wait flag to monitor email status automatically")
            print()
        
    except Exception as error:
        print(f"\n❌ Failed to create email: {error}")
        logger.error(f"Email creation failed: {error}")
        sys.exit(1)


if __name__ == "__main__":
    main()

