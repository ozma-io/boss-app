"""
Timeout Monitor for Cloud Functions

Sends warning to Sentry when function approaches timeout threshold.
Helps debug timeout issues by identifying which operation caused delay.
"""

import time
from typing import Any

import sentry_sdk  # type: ignore
from utils.logger import warn


def create_timeout_monitor(timeout_seconds: int) -> Any:
    """
    Create timeout monitor that warns before function times out.
    
    Args:
        timeout_seconds: Total timeout configured for the function
        
    Returns:
        Monitor object with check() method to call before expensive operations
        
    Example:
        monitor = create_timeout_monitor(2400)
        monitor.check('Before generating emails')
        result = generate_emails_in_parallel(...)
    """
    warning_threshold = timeout_seconds - 10  # Warn 10 seconds before timeout
    start_time = time.time()
    
    class TimeoutMonitor:
        def check(self, operation_name: str) -> None:
            elapsed = time.time() - start_time
            
            if elapsed >= warning_threshold:
                remaining = timeout_seconds - elapsed
                
                warn(
                    f"Function approaching timeout: {operation_name}",
                    {
                        "elapsed_seconds": round(elapsed, 1),
                        "timeout_seconds": timeout_seconds,
                        "remaining_seconds": round(remaining, 1),
                        "operation_name": operation_name,
                    }
                )
                
                # Also send to Sentry
                with sentry_sdk.push_scope() as scope:  # type: ignore
                    scope.set_extra("elapsed_seconds", round(elapsed, 1))  # type: ignore
                    scope.set_extra("timeout_seconds", timeout_seconds)  # type: ignore
                    scope.set_extra("remaining_seconds", round(remaining, 1))  # type: ignore
                    scope.set_extra("operation_name", operation_name)  # type: ignore
                    scope.set_level("warning")  # type: ignore
                    sentry_sdk.capture_message(  # type: ignore
                        f"Function approaching timeout: {operation_name}",
                        level="warning"
                    )
    
    return TimeoutMonitor()

