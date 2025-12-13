"""
Timeout Monitor for Cloud Functions

Starts a background timer that warns in Sentry before function times out.
Helps debug timeout issues by capturing state before function is killed.
"""

import threading
import time
from typing import Any

import sentry_sdk  # type: ignore
from utils.logger import info


def create_timeout_monitor(timeout_seconds: int) -> Any:
    """
    Create timeout monitor that warns before function times out.
    
    Starts a background timer that automatically sends warning to Sentry
    10 seconds before the function timeout. This works even if code is stuck
    in external SDK calls (like OpenAI API).
    
    Args:
        timeout_seconds: Total timeout configured for the function
        
    Returns:
        Monitor object with cancel() method to stop timer on success
        
    Example:
        monitor = create_timeout_monitor(2400)
        try:
            result = generate_emails_in_parallel(...)
            monitor.cancel()  # Success - stop the warning timer
        except Exception:
            # Timer will fire if we're still running after 2390 seconds
            raise
    """
    warning_threshold = timeout_seconds - 10  # Warn 10 seconds before timeout
    start_time = time.time()
    last_checkpoint = "Function started"
    cancelled = False
    timer_obj = None
    
    def _send_warning() -> None:
        """Background timer callback that fires before timeout"""
        if cancelled:
            return
        
        elapsed = time.time() - start_time
        remaining = timeout_seconds - elapsed
        
        info(
            "Cloud Function approaching timeout - about to be killed",
            {
                "elapsed_seconds": round(elapsed, 1),
                "timeout_seconds": timeout_seconds,
                "remaining_seconds": round(remaining, 1),
                "last_checkpoint": last_checkpoint,
                "message": "Function will be killed in ~10 seconds. Check if OpenAI or other external API is hanging.",
            }
        )
        
        # Send to Sentry with error level (critical issue)
        with sentry_sdk.push_scope() as scope:  # type: ignore
            scope.set_extra("elapsed_seconds", round(elapsed, 1))  # type: ignore
            scope.set_extra("timeout_seconds", timeout_seconds)  # type: ignore
            scope.set_extra("remaining_seconds", round(remaining, 1))  # type: ignore
            scope.set_extra("last_checkpoint", last_checkpoint)  # type: ignore
            scope.set_level("error")  # type: ignore
            sentry_sdk.capture_message(  # type: ignore
                "Cloud Function approaching timeout - about to be killed",
                level="error"
            )
    
    # Start background timer
    timer_obj = threading.Timer(warning_threshold, _send_warning)
    timer_obj.daemon = True
    timer_obj.start()
    
    class TimeoutMonitor:
        def cancel(self) -> None:
            """Stop the timeout warning timer (call on success)"""
            nonlocal cancelled
            cancelled = True
            if timer_obj:
                timer_obj.cancel()
        
        def check(self, operation_name: str) -> None:
            """
            Update checkpoint name (for debugging) and optionally warn if already late.
            
            This is optional - the background timer will fire automatically.
            But calling check() helps identify which operation caused the delay.
            """
            nonlocal last_checkpoint
            last_checkpoint = operation_name
            
            # Optional: also check synchronously at checkpoints for early warning
            elapsed = time.time() - start_time
            if elapsed >= warning_threshold:
                remaining = timeout_seconds - elapsed
                
                info(
                    f"Function checkpoint after timeout threshold: {operation_name}",
                    {
                        "elapsed_seconds": round(elapsed, 1),
                        "timeout_seconds": timeout_seconds,
                        "remaining_seconds": round(remaining, 1),
                        "operation_name": operation_name,
                    }
                )
                
                with sentry_sdk.push_scope() as scope:  # type: ignore
                    scope.set_extra("elapsed_seconds", round(elapsed, 1))  # type: ignore
                    scope.set_extra("timeout_seconds", timeout_seconds)  # type: ignore
                    scope.set_extra("remaining_seconds", round(remaining, 1))  # type: ignore
                    scope.set_extra("operation_name", operation_name)  # type: ignore
                    scope.set_level("warning")  # type: ignore
                    sentry_sdk.capture_message(  # type: ignore
                        f"Function checkpoint after timeout threshold: {operation_name}",
                        level="warning"
                    )
    
    return TimeoutMonitor()

