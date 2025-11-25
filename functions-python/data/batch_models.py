"""
Pydantic Models for Batch Generation

Data models for parallel generation operations (emails and chat messages).
Used to structure inputs, outputs, and results of batch processing.
"""

from pydantic import BaseModel


# ============================================================================
# Email Generation Models
# ============================================================================

class UserEmailTask(BaseModel):
    """
    Input model for a single user email generation task.
    
    Represents one user who needs an email generated.
    Used as input to batch generation functions.
    """
    user_id: str
    user_email: str
    scenario: str  # e.g., "EMAIL_ONLY_USER", "NEW_USER_EMAIL", "ACTIVE_USER_EMAIL"


class GeneratedEmail(BaseModel):
    """
    Success result model for a generated email.
    
    Contains information about a successfully generated and queued email.
    """
    user_id: str
    email_id: str
    user_email: str
    subject: str


class FailedGeneration(BaseModel):
    """
    Failure result model for a failed email generation.
    
    Contains information about a user whose email generation failed.
    """
    user_id: str
    user_email: str
    scenario: str
    error_message: str


class BatchGenerationResult(BaseModel):
    """
    Overall result model for batch email generation.
    
    Aggregates successful and failed generations with summary statistics.
    """
    successful: list[GeneratedEmail]
    failed: list[FailedGeneration]
    total_count: int
    success_count: int
    failure_count: int


# ============================================================================
# Chat Message Generation Models
# ============================================================================

class UserChatTask(BaseModel):
    """
    Input model for a single user chat message generation task.
    
    Represents one user who needs a chat message (push notification) generated.
    Used as input to batch generation functions.
    """
    user_id: str
    fcm_token: str  # Required for validation, though not used directly
    scenario: str  # e.g., "NEW_USER_PUSH", "ACTIVE_USER_PUSH"
    thread_id: str | None = None  # Optional: if None, will auto-detect


class GeneratedChatMessage(BaseModel):
    """
    Success result model for a generated chat message.
    
    Contains information about a successfully generated and created message.
    Push notification is sent automatically by Firestore trigger.
    """
    user_id: str
    message_id: str
    thread_id: str
    message_preview: str  # First 50 chars of message for logging


class FailedChatGeneration(BaseModel):
    """
    Failure result model for a failed chat message generation.
    
    Contains information about a user whose chat message generation failed.
    """
    user_id: str
    fcm_token: str
    scenario: str
    error_message: str


class ChatBatchGenerationResult(BaseModel):
    """
    Overall result model for batch chat message generation.
    
    Aggregates successful and failed generations with summary statistics.
    """
    successful: list[GeneratedChatMessage]
    failed: list[FailedChatGeneration]
    total_count: int
    success_count: int
    failure_count: int

