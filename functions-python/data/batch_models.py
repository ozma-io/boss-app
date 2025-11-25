"""
Pydantic Models for Batch Email Generation

Data models for parallel email generation operations.
Used to structure inputs, outputs, and results of batch processing.
"""

from pydantic import BaseModel


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

