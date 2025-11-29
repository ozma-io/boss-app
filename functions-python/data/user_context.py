"""
User Context Fetching and Formatting

Fetches comprehensive user data (profile, bosses, timeline entries) from Firestore
and formats it into a readable text representation for AI context.

Ported from TypeScript: functions/src/chat.ts (fetchUserContext)
"""

from typing import Any

from firebase_admin import firestore  # type: ignore
from google.api_core.retry import Retry  # type: ignore
from google.api_core.exceptions import DeadlineExceeded, RetryError, ServerError  # type: ignore

from data.firestore_models import (
    BossBasic,
    ChatMessage,
    EmailBasic,
    EntryBasic,
    UserBasic,
    UserContext,
    extract_text_from_content,
)
from utils.logger import error, info, warn


def fetch_user_context(db: Any, user_id: str) -> UserContext:
    """
    Fetch all user context data from Firestore.
    
    Retrieves:
    - User profile document
    - All bosses (ordered by createdAt)
    - Last 50 timeline entries (ordered by timestamp desc)
    - Last 15 sent emails (ordered by sentAt desc)
    - Last 30 chat messages from all threads (ordered by timestamp desc)
    
    Args:
        db: Firestore client instance
        user_id: User document ID
        
    Returns:
        UserContext object containing:
            - user: UserBasic document or None
            - bosses: List of BossBasic documents
            - entries: List of EntryBasic documents
            - emails: List of EmailBasic documents
            - chat_messages: List of ChatMessage documents
    """
    # Configure retry policy for Firestore operations
    # Retry up to 3 times with exponential backoff to handle transient failures
    retry_policy = Retry(
        initial=1.0,  # Initial delay of 1 second
        maximum=10.0,  # Maximum delay of 10 seconds
        multiplier=2.0,  # Double the delay each time
        timeout=30.0,  # Reduced timeout to 30 seconds
        predicate=lambda exc: isinstance(exc, (DeadlineExceeded, RetryError, ServerError))
    )
    
    try:
        # Fetch user profile
        user_ref = db.collection("users").document(user_id)
        user_data: UserBasic | None = None
        try:
            user_doc = user_ref.get(retry=retry_policy)
            if user_doc.exists:
                user_dict = user_doc.to_dict()
                if user_dict:
                    user_data = UserBasic(**user_dict)
        except (DeadlineExceeded, RetryError) as err:
            warn(
                "Failed to fetch user profile, continuing with empty data",
                {"user_id": user_id, "error": str(err)}
            )
        except Exception as validation_err:
            warn(
                "Failed to parse user data, continuing with None",
                {"user_id": user_id, "error": str(validation_err)}
            )
        
        # Fetch all bosses
        bosses_data: list[BossBasic] = []
        try:
            bosses_ref = user_ref.collection("bosses").order_by("createdAt", direction=firestore.Query.ASCENDING)  # type: ignore
            bosses_snapshot = bosses_ref.get(retry=retry_policy)
            
            for boss_doc in bosses_snapshot:
                boss_dict = boss_doc.to_dict()
                if boss_dict:
                    boss_dict["id"] = boss_doc.id
                    try:
                        bosses_data.append(BossBasic(**boss_dict))
                    except Exception as validation_err:
                        warn(
                            "Failed to parse boss data, skipping",
                            {"boss_id": boss_doc.id, "error": str(validation_err)}
                        )
        except (DeadlineExceeded, RetryError) as err:
            warn(
                "Failed to fetch bosses, continuing with empty data",
                {"user_id": user_id, "error": str(err)}
            )
        
        # Fetch last 50 timeline entries
        entries_data: list[EntryBasic] = []
        try:
            entries_ref = (
                user_ref.collection("entries")
                .order_by("timestamp", direction=firestore.Query.DESCENDING)  # type: ignore
                .limit(50)
            )
            entries_snapshot = entries_ref.get(retry=retry_policy)
            
            for entry_doc in entries_snapshot:
                entry_dict = entry_doc.to_dict()
                if entry_dict:
                    entry_dict["id"] = entry_doc.id
                    try:
                        entries_data.append(EntryBasic(**entry_dict))
                    except Exception as validation_err:
                        warn(
                            "Failed to parse entry data, skipping",
                            {"entry_id": entry_doc.id, "error": str(validation_err)}
                        )
        except (DeadlineExceeded, RetryError) as err:
            warn(
                "Failed to fetch entries, continuing with empty data",
                {"user_id": user_id, "error": str(err)}
            )
        
        # Fetch last 15 sent emails
        emails_data: list[EmailBasic] = []
        try:
            emails_ref = (
                user_ref.collection("emails")
                .where("state", "==", "SENT")  # type: ignore
                .order_by("sentAt", direction=firestore.Query.DESCENDING)  # type: ignore
                .limit(15)
            )
            emails_snapshot = emails_ref.get(retry=retry_policy)
            
            for email_doc in emails_snapshot:  # type: ignore
                email_dict = email_doc.to_dict()  # type: ignore
                if email_dict:
                    email_dict["id"] = email_doc.id  # type: ignore
                    try:
                        emails_data.append(EmailBasic(**email_dict))
                    except Exception as validation_err:
                        warn(
                            "Failed to parse email data, skipping",
                            {"email_id": email_doc.id, "error": str(validation_err)}
                        )
        except (DeadlineExceeded, RetryError) as err:
            warn(
                "Failed to fetch emails, continuing with empty data",
                {"user_id": user_id, "error": str(err)}
            )
        
        # Fetch last 30 chat messages from all threads
        chat_messages_data: list[ChatMessage] = []
        try:
            # Get all chat threads
            threads_ref = user_ref.collection("chatThreads")
            threads_snapshot = threads_ref.get(retry=retry_policy)
            
            # Collect messages from all threads
            all_messages: list[tuple[ChatMessage, str]] = []  # (ChatMessage, timestamp)
            
            for thread_doc in threads_snapshot:
                thread_id = thread_doc.id
                messages_ref = (
                    threads_ref.document(thread_id)
                    .collection("messages")
                    .order_by("timestamp", direction=firestore.Query.DESCENDING)  # type: ignore
                    .limit(30)  # Fetch up to 30 from each thread
                )
                messages_snapshot = messages_ref.get(retry=retry_policy)
                
                for msg_doc in messages_snapshot:
                    msg_dict = msg_doc.to_dict()
                    if msg_dict:
                        msg_dict["id"] = msg_doc.id
                        msg_dict["thread_id"] = thread_id
                        try:
                            chat_msg = ChatMessage(**msg_dict)
                            all_messages.append((chat_msg, chat_msg.timestamp))
                        except Exception as validation_err:
                            warn(
                                "Failed to parse chat message, skipping",
                                {"message_id": msg_doc.id, "error": str(validation_err)}
                            )
            
            # Sort all messages by timestamp (newest first) and take last 30
            all_messages.sort(key=lambda x: x[1], reverse=True)
            chat_messages_data = [msg for msg, _ in all_messages[:30]]
            
        except (DeadlineExceeded, RetryError) as err:
            warn(
                "Failed to fetch chat messages, continuing with empty data",
                {"user_id": user_id, "error": str(err)}
            )
        
        info(
            "User context fetched successfully",
            {
                "user_id": user_id,
                "bosses_count": len(bosses_data),
                "entries_count": len(entries_data),
                "emails_count": len(emails_data),
                "chat_messages_count": len(chat_messages_data),
            }
        )
        
        return UserContext(
            user=user_data,
            bosses=bosses_data,
            entries=entries_data,
            emails=emails_data,
            chat_messages=chat_messages_data,
        )
        
    except Exception as err:
        error(
            "Failed to fetch user context",
            {
                "user_id": user_id,
                "error": str(err),
            }
        )
        raise


def format_user_context_as_text(context: UserContext) -> str:
    """
    Format user context as readable text.
    
    Creates a structured text representation with sections for:
    - User Profile (including custom fields)
    - Bosses (including custom fields for each)
    - Timeline Entries (recent activity)
    - Chat Message History (conversation context) - CRITICAL for continuity
    - Previous Email Notifications (sent to user)
    
    Args:
        context: UserContext object from fetch_user_context containing user, bosses, entries, emails, chat_messages
        
    Returns:
        Formatted text string ready for AI consumption
    """
    context_parts: list[str] = []
    
    user_data = context.user
    bosses_data = context.bosses
    entries_data = context.entries
    emails_data = context.emails
    chat_messages_data = context.chat_messages
    
    # User profile section
    if user_data:
        context_parts.append("## User Profile")
        context_parts.append(f"Name: {user_data.name}")
        context_parts.append(f"Position: {user_data.position}")
        context_parts.append(f"Goal: {user_data.goal}")
        
        # Add custom fields if they exist
        if user_data.fields_meta:
            context_parts.append("\n### Custom Profile Fields")
            user_dict = user_data.model_dump(by_alias=True)
            for field_key, field_meta in user_data.fields_meta.items():
                field_value = user_dict.get(field_key)
                if field_value is not None:
                    label = field_meta.get("label", field_key)
                    context_parts.append(f"{label}: {field_value}")
    
    # Bosses section
    if bosses_data:
        context_parts.append("\n## Bosses")
        
        for boss in bosses_data:
            context_parts.append(f"\n### Boss: {boss.name}")
            context_parts.append(f"Position: {boss.position}")
            context_parts.append(f"Department: {boss.department or 'Not set'}")
            context_parts.append(f"Management Style: {boss.managementStyle}")
            context_parts.append(f"Working Hours: {boss.workingHours or 'Not set'}")
            context_parts.append(f"Started At: {boss.startedAt}")
            
            # Add custom fields if they exist
            if boss.fields_meta:
                context_parts.append("\n#### Custom Boss Fields")
                boss_dict = boss.model_dump(by_alias=True)
                for field_key, field_meta in boss.fields_meta.items():
                    field_value = boss_dict.get(field_key)
                    if field_value is not None:
                        label = field_meta.get("label", field_key)
                        context_parts.append(f"{label}: {field_value}")
    
    # Timeline entries section
    if entries_data:
        context_parts.append("\n## Timeline Entries (Recent)")
        for entry in entries_data:
            entry_type = entry.type
            if entry_type == "note" and entry.subtype:
                entry_type = f"Note ({entry.subtype})"
            
            context_parts.append(f"- [{entry.timestamp}] {entry_type}: {entry.title}")
            
            if entry.content:
                context_parts.append(f"  Content: {entry.content}")
    
    # Chat message history section - CRITICAL for context continuity
    if chat_messages_data:
        context_parts.append("\n## Chat Message History (IMPORTANT - Review Before Generating)")
        context_parts.append("This is your conversation history with the user. All these messages are visible on screen.")
        context_parts.append("IMPORTANT: Do NOT repeat yourself. Consider what you've already discussed.")
        context_parts.append("")
        
        for msg in reversed(chat_messages_data):  # Show oldest first (chronological order)
            # Extract text from content using helper function
            full_text = extract_text_from_content(msg.content)
            
            # Format role for display
            role_display = msg.role.upper() if msg.role == "user" else "YOU (Assistant)"
            
            context_parts.append(f"[{msg.timestamp}] {role_display}: {full_text}")
    
    # Previous email notifications section
    if emails_data:
        context_parts.append("\n## Previous Email Notifications Sent to User")
        for email in emails_data:
            context_parts.append(f"\n### Email sent at {email.sentAt or 'Unknown time'}")
            context_parts.append(f"Subject: {email.subject}")
            context_parts.append(f"Body:\n{email.body_markdown}")
    
    return "\n".join(context_parts)

