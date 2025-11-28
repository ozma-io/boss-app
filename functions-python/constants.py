"""
Cloud Functions Configuration Constants

Timeout values must match the configuration in main.py decorators.
Used for timeout monitoring to avoid duplication.
"""

# Function timeout configurations (in seconds)
FUNCTION_TIMEOUTS = {
    'notificationOrchestrator': 2400,  # 40 minutes
    'onChatMessageCreatedSendWelcomeEmail': 300,  # 5 minutes
}

__all__ = ['FUNCTION_TIMEOUTS']

