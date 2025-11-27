"""
User Context Fetching and Formatting

Fetches comprehensive user data (profile, bosses, timeline entries) from Firestore
and formats it into a readable text representation for AI context.

Ported from TypeScript: functions/src/chat.ts (fetchUserContext)
"""

from typing import Any

from firebase_admin import firestore  # type: ignore
from google.api_core.retry import Retry  # type: ignore
from google.api_core.exceptions import DeadlineExceeded, RetryError  # type: ignore

from utils.logger import error, info, warn


def fetch_user_context(db: Any, user_id: str) -> dict[str, Any]:
    """
    Fetch all user context data from Firestore.
    
    Retrieves:
    - User profile document
    - All bosses (ordered by createdAt)
    - Last 50 timeline entries (ordered by timestamp desc)
    - Last 15 sent emails (ordered by sentAt desc)
    
    Args:
        db: Firestore client instance
        user_id: User document ID
        
    Returns:
        Dictionary containing:
            - user: User document data (dict or None)
            - bosses: List of boss documents with IDs
            - entries: List of timeline entry documents with IDs
            - emails: List of sent email documents with IDs
    """
    # Configure retry policy for Firestore operations
    # Retry up to 3 times with exponential backoff to handle transient failures
    retry_policy = Retry(
        initial=1.0,  # Initial delay of 1 second
        maximum=10.0,  # Maximum delay of 10 seconds
        multiplier=2.0,  # Double the delay each time
        timeout=60.0,  # Total timeout of 60 seconds
        predicate=lambda exc: isinstance(exc, (DeadlineExceeded, RetryError))
    )
    
    try:
        # Fetch user profile
        user_ref = db.collection("users").document(user_id)
        try:
            user_doc = user_ref.get(retry=retry_policy)
            user_data = user_doc.to_dict() if user_doc.exists else None
        except (DeadlineExceeded, RetryError) as err:
            warn(
                "Failed to fetch user profile, continuing with empty data",
                {"user_id": user_id, "error": str(err)}
            )
            user_data = None
        
        # Fetch all bosses
        bosses_data: list[dict[str, Any]] = []
        try:
            bosses_ref = user_ref.collection("bosses").order_by("createdAt", direction=firestore.Query.ASCENDING)  # type: ignore
            bosses_snapshot = bosses_ref.get(retry=retry_policy)
            
            for boss_doc in bosses_snapshot:
                boss_dict = boss_doc.to_dict()
                if boss_dict:
                    boss_dict["id"] = boss_doc.id
                    bosses_data.append(boss_dict)
        except (DeadlineExceeded, RetryError) as err:
            warn(
                "Failed to fetch bosses, continuing with empty data",
                {"user_id": user_id, "error": str(err)}
            )
        
        # Fetch last 50 timeline entries
        entries_data: list[dict[str, Any]] = []
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
                    entries_data.append(entry_dict)
        except (DeadlineExceeded, RetryError) as err:
            warn(
                "Failed to fetch entries, continuing with empty data",
                {"user_id": user_id, "error": str(err)}
            )
        
        # Fetch last 15 sent emails
        emails_data: list[dict[str, Any]] = []
        try:
            emails_ref = (
                user_ref.collection("emails")
                .where("state", "==", "SENT")  # type: ignore
                .order_by("sentAt", direction=firestore.Query.DESCENDING)  # type: ignore
                .limit(15)
            )
            emails_snapshot = emails_ref.get(retry=retry_policy)
        except (DeadlineExceeded, RetryError) as err:
            warn(
                "Failed to fetch emails, continuing with empty data",
                {"user_id": user_id, "error": str(err)}
            )
            emails_snapshot = []
            
            for email_doc in emails_snapshot:  # type: ignore
                email_dict = email_doc.to_dict()  # type: ignore
                if email_dict:
                    email_dict["id"] = email_doc.id  # type: ignore
                    emails_data.append(email_dict)  # type: ignore
        
        info(
            "User context fetched successfully",
            {
                "user_id": user_id,
                "bosses_count": len(bosses_data),
                "entries_count": len(entries_data),
                "emails_count": len(emails_data),
            }
        )
        
        return {
            "user": user_data,
            "bosses": bosses_data,
            "entries": entries_data,
            "emails": emails_data,
        }
        
    except Exception as err:
        error(
            "Failed to fetch user context",
            {
                "user_id": user_id,
                "error": str(err),
            }
        )
        raise


def format_user_context_as_text(context: dict[str, Any]) -> str:
    """
    Format user context dictionary as readable text.
    
    Creates a structured text representation with sections for:
    - User Profile (including custom fields)
    - Bosses (including custom fields for each)
    - Timeline Entries (recent activity)
    - Previous Email Notifications (sent to user)
    
    Args:
        context: Dictionary from fetch_user_context containing user, bosses, entries, emails
        
    Returns:
        Formatted text string ready for AI consumption
    """
    context_parts: list[str] = []
    
    user_data = context.get("user")
    bosses_data = context.get("bosses", [])
    entries_data = context.get("entries", [])
    emails_data = context.get("emails", [])
    
    # User profile section
    if user_data:
        context_parts.append("## User Profile")
        context_parts.append(f"Name: {user_data.get('name', 'Not set')}")
        context_parts.append(f"Position: {user_data.get('position', 'Not set')}")
        context_parts.append(f"Goal: {user_data.get('goal', 'Not set')}")
        
        # Add custom fields if they exist
        fields_meta = user_data.get("_fieldsMeta")
        if fields_meta:
            context_parts.append("\n### Custom Profile Fields")
            for field_key, field_meta in fields_meta.items():
                field_value = user_data.get(field_key)
                if field_value is not None:
                    label = field_meta.get("label", field_key)
                    context_parts.append(f"{label}: {field_value}")
    
    # Bosses section
    if bosses_data:
        context_parts.append("\n## Bosses")
        
        for boss in bosses_data:
            boss_name = boss.get("name", "Unnamed")
            context_parts.append(f"\n### Boss: {boss_name}")
            context_parts.append(f"Position: {boss.get('position', 'Not set')}")
            context_parts.append(f"Department: {boss.get('department', 'Not set')}")
            context_parts.append(f"Management Style: {boss.get('managementStyle', 'Not set')}")
            context_parts.append(f"Working Hours: {boss.get('workingHours', 'Not set')}")
            context_parts.append(f"Started At: {boss.get('startedAt', 'Not set')}")
            
            # Add custom fields if they exist
            boss_fields_meta = boss.get("_fieldsMeta")
            if boss_fields_meta:
                context_parts.append("\n#### Custom Boss Fields")
                for field_key, field_meta in boss_fields_meta.items():
                    field_value = boss.get(field_key)
                    if field_value is not None:
                        label = field_meta.get("label", field_key)
                        context_parts.append(f"{label}: {field_value}")
    
    # Timeline entries section
    if entries_data:
        context_parts.append("\n## Timeline Entries (Recent)")
        for entry in entries_data:
            entry_type = entry.get("type", "Entry")
            if entry_type == "note":
                subtype = entry.get("subtype", "")
                entry_type = f"Note ({subtype})" if subtype else "Note"
            
            timestamp = entry.get("timestamp", "Unknown time")
            title = entry.get("title", "No title")
            context_parts.append(f"- [{timestamp}] {entry_type}: {title}")
            
            content = entry.get("content")
            if content:
                context_parts.append(f"  Content: {content}")
    
    # Previous email notifications section
    if emails_data:
        context_parts.append("\n## Previous Email Notifications Sent to User")
        for email in emails_data:
            sent_at = email.get("sentAt", "Unknown time")
            subject = email.get("subject", "No subject")
            body = email.get("body_markdown", "")
            
            context_parts.append(f"\n### Email sent at {sent_at}")
            context_parts.append(f"Subject: {subject}")
            context_parts.append(f"Body:\n{body}")
    
    return "\n".join(context_parts)

