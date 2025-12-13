"""
Cloud Functions Configuration Constants

Timeout values must match the configuration in main.py decorators.
Used for timeout monitoring to avoid duplication.
"""

# Function timeout configurations (in seconds)
# Must match timeout_sec values in main.py decorators
# 
# Cloud Functions 2nd gen timeout limits:
# - HTTP functions: 60 minutes max
# - Scheduled functions (Cloud Scheduler): 30 minutes max (1800s)
# - Event-driven functions (Firestore, Pub/Sub, etc.): 9 minutes max (540s)
FUNCTION_TIMEOUTS = {
    'notificationOrchestrator': 1800,  # 30 minutes (max for scheduled functions, OpenAI timeout is 8.5 minutes per call)
    'onChatMessageCreatedSendWelcomeEmail': 540,  # 9 minutes (max for event-driven functions, OpenAI timeout is 8.5 minutes)
}

__all__ = ['FUNCTION_TIMEOUTS']

