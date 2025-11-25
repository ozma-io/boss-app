"""
Pydantic Models for OpenAI Structured Output

These models define the response format for AI-generated notification content.
The reasoning field enables chain-of-thought processing for improved quality.
"""

from pydantic import BaseModel, Field


class EmailNotificationContent(BaseModel):
    """
    Structured output for email notifications.
    
    Attributes:
        reasoning: Chain-of-thought explanation (internal use only, not sent to user)
        title: Plain text email subject line
        body: Markdown-formatted email body
    """
    reasoning: str = Field(
        description="Chain-of-thought reasoning explaining your approach to this notification"
    )
    title: str = Field(
        description="Plain text email subject line (no markup)"
    )
    body: str = Field(
        description="Email body in Markdown format with proper formatting for readability"
    )


class ChatNotificationContent(BaseModel):
    """
    Structured output for chat/push notifications.
    
    Attributes:
        reasoning: Chain-of-thought explanation (internal use only, not sent to user)
        message: Plain text notification message
    """
    reasoning: str = Field(
        description="Chain-of-thought reasoning explaining your approach to this notification"
    )
    message: str = Field(
        description="Plain text notification message (no markup, keep it concise for push/chat)"
    )

