"""
User Distribution Analysis Test

Analyzes how users are distributed across:
1. Proactive notification counts
2. Assistant messages in chat 
3. Emails received from system

Displays results sorted from most popular quantity to least popular.
"""


import os
from collections import Counter, defaultdict
from typing import Any, Dict, List, Tuple

import pytest
from google.cloud import firestore  # type: ignore


def get_firestore_client() -> Any:
    """Get Firestore client for testing."""
    try:
        return firestore.Client()  # type: ignore
    except Exception as e:
        pytest.skip(f"Firestore not available: {e}")


def analyze_notification_counts(users: List[Tuple[str, Dict[str, Any]]]) -> Dict[int, int]:
    """
    Analyze distribution of proactive notification counts.
    
    Returns:
        Dictionary mapping notification_count -> number_of_users
    """
    counts = Counter()
    
    for user_id, user_data in users:
        notification_state = user_data.get('notification_state', {})
        notification_count = notification_state.get('notification_count', 0)
        counts[notification_count] += 1
    
    return dict(counts)


def analyze_assistant_messages(db: Any, users: List[Tuple[str, Dict[str, Any]]]) -> Dict[int, int]:
    """
    Analyze distribution of assistant messages in main chat thread.
    
    Returns:
        Dictionary mapping message_count -> number_of_users
    """
    counts = Counter()
    
    for user_id, user_data in users:
        try:
            # Query main chat thread messages from assistant
            messages_ref = (
                db.collection('users')
                .document(user_id)
                .collection('chatThreads')
                .document('main')
                .collection('messages')
            )
            
            # Filter for assistant messages only
            assistant_messages = messages_ref.where('role', '==', 'assistant').stream()
            message_count = sum(1 for _ in assistant_messages)
            counts[message_count] += 1
            
        except Exception:
            # If thread doesn't exist or error occurs, count as 0
            counts[0] += 1
    
    return dict(counts)


def analyze_email_counts(db: Any, users: List[Tuple[str, Dict[str, Any]]]) -> Dict[int, int]:
    """
    Analyze distribution of emails sent to users.
    
    Returns:
        Dictionary mapping email_count -> number_of_users
    """
    counts = Counter()
    
    for user_id, user_data in users:
        try:
            # Query emails collection for this user
            emails_ref = (
                db.collection('users')
                .document(user_id)
                .collection('emails')
            )
            
            emails = emails_ref.stream()
            email_count = sum(1 for _ in emails)
            counts[email_count] += 1
            
        except Exception:
            # If collection doesn't exist or error occurs, count as 0
            counts[0] += 1
    
    return dict(counts)


def format_distribution(title: str, distribution: Dict[int, int]) -> str:
    """
    Format distribution data for nice display.
    
    Args:
        title: Title for the distribution
        distribution: Dictionary mapping count -> number_of_users
        
    Returns:
        Formatted string for display
    """
    if not distribution:
        return f"\n{title}\nNo data available\n"
    
    # Sort by number of users (descending), then by count (ascending)
    sorted_items = sorted(distribution.items(), key=lambda x: (-x[1], x[0]))
    
    result = [f"\n{title}"]
    result.append("=" * len(title))
    
    total_users = sum(distribution.values())
    
    for count, num_users in sorted_items:
        percentage = (num_users / total_users) * 100
        result.append(f"{count:3d} items: {num_users:4d} users ({percentage:5.1f}%)")
    
    result.append(f"\nTotal users: {total_users}")
    result.append("")
    
    return "\n".join(result)


@pytest.mark.skipif(
    os.getenv("SKIP_FIRESTORE_TESTS") == "1",
    reason="Firestore tests skipped"
)
def test_user_distribution_analysis():
    """
    Main test function that performs complete user distribution analysis.
    
    Analyzes all users in the system and shows distribution across:
    - Proactive notifications sent
    - Assistant messages in chat
    - Emails received
    """
    print("\n" + "=" * 60)
    print("USER DISTRIBUTION ANALYSIS")
    print("=" * 60)
    
    db = get_firestore_client()
    
    # Step 1: Load all users
    print("Loading all users from Firestore...")
    users_ref = db.collection('users')
    users_snapshot = users_ref.stream()
    
    all_users: List[Tuple[str, Dict[str, Any]]] = []
    
    for user_doc in users_snapshot:
        user_id: str = user_doc.id
        user_data = user_doc.to_dict()
        
        if user_data is None:
            continue
        
        all_users.append((user_id, user_data))
    
    print(f"Loaded {len(all_users)} users")
    
    if not all_users:
        print("No users found in database!")
        return
    
    # Step 2: Analyze notification counts
    print("Analyzing proactive notification distribution...")
    notification_dist = analyze_notification_counts(all_users)
    
    # Step 3: Analyze assistant messages
    print("Analyzing assistant messages distribution...")
    messages_dist = analyze_assistant_messages(db, all_users)
    
    # Step 4: Analyze email counts  
    print("Analyzing email distribution...")
    email_dist = analyze_email_counts(db, all_users)
    
    # Step 5: Display results
    print("\n" + "=" * 60)
    print("ANALYSIS RESULTS")
    print("=" * 60)
    
    print(format_distribution(
        "PROACTIVE NOTIFICATIONS SENT (notification_count)", 
        notification_dist
    ))
    
    print(format_distribution(
        "ASSISTANT MESSAGES IN CHAT", 
        messages_dist
    ))
    
    print(format_distribution(
        "EMAILS RECEIVED FROM SYSTEM", 
        email_dist
    ))
    
    # Summary insights
    print("KEY INSIGHTS")
    print("=" * 12)
    
    # Most common notification count
    most_common_notif = max(notification_dist.items(), key=lambda x: x[1])
    print(f"• Most users ({most_common_notif[1]}) have {most_common_notif[0]} proactive notifications")
    
    # Most common message count
    most_common_msg = max(messages_dist.items(), key=lambda x: x[1])
    print(f"• Most users ({most_common_msg[1]}) have {most_common_msg[0]} assistant messages")
    
    # Most common email count
    most_common_email = max(email_dist.items(), key=lambda x: x[1])
    print(f"• Most users ({most_common_email[1]}) have {most_common_email[0]} emails")
    
    # Users with no engagement
    no_notif = notification_dist.get(0, 0)
    no_msg = messages_dist.get(0, 0) 
    no_email = email_dist.get(0, 0)
    
    print(f"\nENGAGEMENT GAPS:")
    print(f"• {no_notif} users have never received proactive notifications")
    print(f"• {no_msg} users have no assistant messages")  
    print(f"• {no_email} users have no emails")
    
    print("\n" + "=" * 60)


if __name__ == '__main__':
    test_user_distribution_analysis()
