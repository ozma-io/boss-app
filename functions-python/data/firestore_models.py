"""
Pydantic Models for Firestore Documents

These models mirror TypeScript schemas from firestore/schemas/*.schema.ts
to provide strict typing for Firestore operations in Python.

Source of truth: firestore/schemas/
- chat.schema.ts -> ChatMessage, ChatThread, ContentItem
- user.schema.ts -> User (basic fields only, not full schema)
- boss.schema.ts -> Boss (basic fields only)
- entry.schema.ts -> Entry (basic fields only)

These models are intentionally minimal - only fields that we actually use
in Python functions. Full schemas are in TypeScript.
"""

from typing import Literal

from pydantic import BaseModel, Field


# ============================================================================
# Chat Models (from chat.schema.ts)
# ============================================================================

MessageRole = Literal['user', 'assistant', 'system']
ContentType = Literal['text', 'image_url']


class ImageUrl(BaseModel):
    """Image URL with optional detail level for OpenAI API."""
    url: str
    detail: Literal['auto', 'low', 'high'] | None = None


class ContentItem(BaseModel):
    """
    Content item in chat message (OpenAI-compatible format).
    
    Can be either text or image:
    - Text: { type: 'text', text: 'message content' }
    - Image: { type: 'image_url', image_url: { url: '...', detail: '...' } }
    """
    type: ContentType
    text: str | None = None
    image_url: ImageUrl | None = None


class ChatMessage(BaseModel):
    """
    Chat message document from Firestore.
    
    Path: /users/{userId}/chatThreads/{threadId}/messages/{messageId}
    Source: firestore/schemas/chat.schema.ts (ChatMessageSchema)
    """
    role: MessageRole
    content: list[ContentItem]
    timestamp: str  # ISO 8601 timestamp
    
    # Added by fetch operations (not in Firestore)
    id: str | None = None
    thread_id: str | None = None


class ChatThread(BaseModel):
    """
    Chat thread document from Firestore.
    
    Path: /users/{userId}/chatThreads/{threadId}
    Source: firestore/schemas/chat.schema.ts (ChatThreadSchema)
    """
    createdAt: str
    updatedAt: str
    messageCount: int
    assistantIsTyping: bool
    currentGenerationId: str | None = None
    unreadCount: int
    lastReadAt: str | None
    lastMessageAt: str | None
    lastMessageRole: MessageRole | None


# ============================================================================
# Notification State Models
# ============================================================================

class NotificationState(BaseModel):
    """
    Notification state tracking for a user.
    
    Stored in user document under notification_state field.
    Tracks notification history and timing.
    """
    notification_count: int = 0
    last_notification_at: str | None = None


# ============================================================================
# User Context Models (minimal fields for AI context)
# ============================================================================

class UserBasic(BaseModel):
    """
    Minimal User document fields used for AI context.
    
    Full schema: firestore/schemas/user.schema.ts
    Only includes fields we actually use in notification generation.
    """
    model_config = {"populate_by_name": True}
    
    name: str
    email: str
    position: str
    goal: str
    createdAt: str
    displayName: str | None = None
    photoURL: str | None = None
    lastActivityAt: str | None = None
    fcmToken: str | None = None
    
    # Custom fields metadata (aliased to avoid protected member issues)
    fields_meta: dict[str, dict[str, str]] | None = Field(default=None, alias="_fieldsMeta")


class BossBasic(BaseModel):
    """
    Minimal Boss document fields used for AI context.
    
    Full schema: firestore/schemas/boss.schema.ts
    Only includes fields we actually use in notification generation.
    """
    model_config = {"populate_by_name": True}
    
    name: str
    position: str
    department: str | None = None
    managementStyle: str
    workingHours: str | None = None
    startedAt: str
    createdAt: str
    updatedAt: str
    
    # Custom fields metadata (aliased to avoid protected member issues)
    fields_meta: dict[str, dict[str, str]] | None = Field(default=None, alias="_fieldsMeta")
    
    # Added by fetch operations (not in Firestore)
    id: str | None = None


class EntryBasic(BaseModel):
    """
    Minimal Entry document fields used for AI context.
    
    Full schema: firestore/schemas/entry.schema.ts
    Only includes fields we actually use in notification generation.
    """
    type: str  # note, survey, interaction, fact
    subtype: str | None = None
    title: str
    content: str | None = None
    timestamp: str
    
    # Added by fetch operations (not in Firestore)
    id: str | None = None


class EmailBasic(BaseModel):
    """
    Minimal Email document fields used for AI context.
    
    Full schema: firestore/schemas/email.schema.ts
    Only includes fields we actually use in notification generation.
    """
    subject: str
    body_markdown: str
    state: str  # PENDING, SENDING, SENT, FAILED
    sentAt: str | None = None
    
    # Added by fetch operations (not in Firestore)
    id: str | None = None


# ============================================================================
# User Context Container
# ============================================================================

class UserContext(BaseModel):
    """
    Complete user context for AI generation.
    
    Returned by fetch_user_context() function.
    Contains all data needed to generate personalized notifications.
    """
    user: UserBasic | None
    bosses: list[BossBasic]
    entries: list[EntryBasic]
    emails: list[EmailBasic]
    chat_messages: list[ChatMessage]


# ============================================================================
# Helper Functions
# ============================================================================

def extract_text_from_content(content: list[ContentItem]) -> str:
    """
    Extract text from content array (mirroring TypeScript helper).
    
    Filters text items and joins them with spaces.
    """
    return " ".join(
        item.text
        for item in content
        if item.type == "text" and item.text
    )

