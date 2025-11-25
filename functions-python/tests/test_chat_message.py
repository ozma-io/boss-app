# pyright: reportUnknownVariableType=false, reportUnknownMemberType=false, reportUnknownParameterType=false, reportUnknownArgumentType=false, reportMissingTypeStubs=false, reportMissingImports=false, reportMissingParameterType=false, reportAttributeAccessIssue=false, reportGeneralTypeIssues=false

"""
Test script to create chat message for test user using production LLM functions.

This script:
1. Generates chat message content using generate_first_push_notification() (production function)
2. Adds assistant message to chat thread using add_assistant_message_to_chat()
3. The Firestore trigger detects the new message and sends FCM push notification automatically

This tests the full pipeline including:
- LLM-based content generation (OpenAI structured output)
- Chat message creation
- Firestore trigger (automatically sends push notification)

Requirements:
1. Set GOOGLE_APPLICATION_CREDENTIALS environment variable
2. Set OPENAI_API_KEY environment variable (in .env file)
3. Install dependencies: pip install -r requirements.txt
4. Test user (test@ozma.io) must exist in the database

Usage:
    export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
    python tests/test_chat_message.py [--wait]
    
Options:
    --wait    Wait and verify message was created in chat (max 10 seconds)
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


def check_user_data(db, user_id: str) -> bool:
    """
    Check if user document exists and has basic data.
    
    Args:
        db: Firestore client
        user_id: User document ID
        
    Returns:
        True if user exists, False otherwise
    """
    try:
        user_ref = db.collection("users").document(user_id)
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            logger.error(f"User {user_id} not found")
            return False
        
        user_data = user_doc.to_dict()
        if not user_data:
            logger.error(f"User {user_id} has no data")
            return False
        
        logger.info(f"User {user_id} exists with data")
        return True
        
    except Exception as error:
        logger.error(f"Failed to check user data: {error}")
        raise


def monitor_message_status(db, user_id: str, thread_id: str, message_id: str, max_wait_seconds: int) -> None:
    """
    Monitor chat message document to verify it was created.
    
    Args:
        db: Firestore client
        user_id: User document ID
        thread_id: Thread document ID
        message_id: Message document ID
        max_wait_seconds: Maximum seconds to wait
    """
    print("\n" + "-" * 100)
    print("Verifying message in chat thread...")
    print("-" * 100)
    
    message_ref = db.collection("users").document(user_id).collection("chatThreads").document(thread_id).collection("messages").document(message_id)
    start_time = time.time()
    check_interval = 2
    
    while True:
        elapsed = time.time() - start_time
        
        if elapsed >= max_wait_seconds:
            print(f"\n⏱️  Timeout after {max_wait_seconds} seconds")
            print("   Message should be in chat thread")
            print(f"   Check manually: users/{user_id}/chatThreads/{thread_id}/messages/{message_id}")
            break
        
        try:
            message_doc = message_ref.get()
            if not message_doc.exists:
                print("\n❌ Message document not found!")
                break
            
            message_data = message_doc.to_dict()
            if not message_data:
                print("\n❌ Message document has no data!")
                break
            
            role = message_data.get("role")
            timestamp = message_data.get("timestamp")
            
            print(f"   [{int(elapsed)}s] Message exists in chat (role: {role})", end="\r")
            
            if role == "assistant" and timestamp:
                print("\n\n✅ Message verified in chat thread!")
                print(f"   Time taken: {int(elapsed)} seconds")
                print(f"   Timestamp: {timestamp}")
                print("\n💬 Message is successfully stored in Firestore")
                print("   TypeScript trigger will handle push notification automatically")
                break
            
            time.sleep(check_interval)
            
        except Exception as error:
            print(f"\n❌ Error checking status: {error}")
            break
    
    print()


def main() -> None:
    """Run test to create chat message for test user."""
    # Check for --wait flag
    wait_for_result = "--wait" in sys.argv
    
    print("\n" + "=" * 100)
    print("  Testing Chat Message Creation for test@ozma.io")
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
    
    # Check user data exists
    if not check_user_data(db, user_id):
        logger.error("Cannot proceed without valid user data")
        sys.exit(1)
    
    # Import required functions
    try:
        from data.chat_operations import add_assistant_message_to_chat
        from data.notification_content import generate_first_push_notification
    except Exception as error:
        logger.error(f"Failed to import functions: {error}")
        sys.exit(1)
    
    # Generate chat message content using production LLM function
    print("\n" + "-" * 100)
    print("Generating chat message content using LLM (first push notification prompt)...")
    print("-" * 100)
    
    try:
        push_content = generate_first_push_notification(
            db=db,
            user_id=user_id,
            session_id="test_chat_message_script",
        )
        
        message_text = push_content.message
        
        print("\n✅ Content generated successfully!")
        print(f"   Message: {message_text}")
        print(f"   Reasoning: {push_content.reasoning[:100]}..." if len(push_content.reasoning) > 100 else f"   Reasoning: {push_content.reasoning}")
    except Exception as error:
        print(f"\n❌ Failed to generate content: {error}")
        logger.error(f"Content generation failed: {error}")
        sys.exit(1)
    
    # Create assistant message in chat
    print("\n" + "-" * 100)
    print(f"Creating assistant message in chat for: {user_email}")
    print("-" * 100)
    
    try:
        thread_id = "default"
        message_id = add_assistant_message_to_chat(
            db=db,
            user_id=user_id,
            message_text=message_text,
            thread_id=thread_id,
        )
        
        print("\n✅ Assistant message created successfully!")
        print(f"   User ID: {user_id}")
        print(f"   Thread ID: {thread_id}")
        print(f"   Message ID: {message_id}")
        print(f"   Message: {message_text}")
        print("\n💬 Message is now in chat thread")
        print(f"   Check Firestore: users/{user_id}/chatThreads/{thread_id}/messages/{message_id}")
        print("   TypeScript trigger will automatically send push notification")
        
        # Wait for message to be verified if --wait flag is provided
        if wait_for_result:
            monitor_message_status(db, user_id, thread_id, message_id, max_wait_seconds=10)
        else:
            print("\n💡 Tip: Use --wait flag to verify message creation")
            print()
        
    except Exception as error:
        print(f"\n❌ Failed to add message to chat: {error}")
        logger.error(f"Message creation failed: {error}")
        sys.exit(1)


if __name__ == "__main__":
    main()

