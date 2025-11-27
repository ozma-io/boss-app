"""
Amplitude Analytics Integration for Python Cloud Functions

Utility for sending events to Amplitude HTTP API v2 from server-side code.
Used to track notification delivery (emails and push notifications) for analytics.

Key Features:
- Pure function interface for easy testing
- Built-in retry logic (3 attempts)
- Non-blocking: errors logged but never raised
- Uses existing logger and requests library
"""

import os
import time
from typing import Any

import requests

from utils.logger import error, info


def track_amplitude_event(
    user_id: str,
    event_type: str,
    event_properties: dict[str, Any] | None = None,
) -> bool:
    """
    Send event to Amplitude HTTP API v2.
    
    Pure function that sends analytics events to Amplitude. Errors are logged
    but never raised - analytics failures should not break core functionality.
    
    Args:
        user_id: Firebase user ID
        event_type: Event name in snake_case (e.g., "notification_sent")
        event_properties: Optional event properties dictionary
        
    Returns:
        True if event sent successfully, False if failed
        
    Example:
        >>> track_amplitude_event(
        ...     user_id="user123",
        ...     event_type="notification_sent",
        ...     event_properties={
        ...         "channel": "email",
        ...         "scenario": "EMAIL_ONLY_USER",
        ...     }
        ... )
        True
    """
    # Get API key from environment
    api_key = os.getenv('AMPLITUDE_API_KEY')
    
    if not api_key:
        error("Amplitude API key not configured - skipping event tracking", {
            "event_type": event_type,
            "user_id": user_id,
        })
        return False
    
    # Prepare event payload
    event_data = {
        'user_id': user_id,
        'event_type': event_type,
        'event_properties': event_properties or {},
        'time': int(time.time() * 1000),  # milliseconds since epoch
    }
    
    payload = {
        'api_key': api_key,
        'events': [event_data],
    }
    
    api_url = 'https://api2.amplitude.com/2/httpapi'
    
    # Retry logic: 3 attempts with exponential backoff
    max_retries = 3
    retry_delay = 0.5  # seconds
    
    for attempt in range(1, max_retries + 1):
        try:
            response = requests.post(
                api_url,
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=10,
            )
            
            # Check response status
            if response.ok:
                info("Amplitude event sent successfully", {
                    "event_type": event_type,
                    "user_id": user_id,
                    "properties": event_properties,
                })
                return True
            
            # Handle API errors
            try:
                response_data = response.json()
            except Exception:
                response_data = {"raw_response": response.text}
            
            error_msg = f"Amplitude API error (status {response.status_code})"
            error(error_msg, {
                "event_type": event_type,
                "user_id": user_id,
                "attempt": attempt,
                "status_code": response.status_code,
                "response": response_data,
            })
            
            # Don't retry on 4xx errors (client errors - won't succeed on retry)
            if 400 <= response.status_code < 500:
                return False
            
            # Retry on 5xx errors (server errors - might succeed on retry)
            if attempt < max_retries:
                time.sleep(retry_delay * attempt)  # exponential backoff
                continue
            
            return False
            
        except requests.exceptions.Timeout:
            error("Amplitude API timeout", {
                "event_type": event_type,
                "user_id": user_id,
                "attempt": attempt,
            })
            
            if attempt < max_retries:
                time.sleep(retry_delay * attempt)
                continue
            
            return False
            
        except Exception as err:
            error("Failed to send Amplitude event", {
                "event_type": event_type,
                "user_id": user_id,
                "attempt": attempt,
                "error": str(err),
            })
            
            if attempt < max_retries:
                time.sleep(retry_delay * attempt)
                continue
            
            return False
    
    # Should never reach here, but return False just in case
    return False

