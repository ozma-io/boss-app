"""
Shared Logger Utility for Cloud Functions

Provides consistent logging across all Cloud Functions with automatic
Sentry integration for errors and warnings.
"""

import logging
from typing import Any

import sentry_sdk  # type: ignore

# Get logger instance
_logger = logging.getLogger(__name__)


def info(message: str, context: dict[str, Any]) -> None:
    """
    Log informational messages.
    Only sends to console, not to Sentry.
    """
    _logger.info(f"{message} | {context}")


def error(message: str, context: dict[str, Any]) -> None:
    """
    Log error messages.
    Sends to both console and Sentry with full context.
    """
    _logger.error(f"{message} | {context}")
    
    # Send to Sentry with context using scope
    with sentry_sdk.push_scope() as scope:  # type: ignore
        for key, value in context.items():
            scope.set_extra(key, value)  # type: ignore
        sentry_sdk.capture_exception(Exception(message))  # type: ignore


def warn(message: str, context: dict[str, Any]) -> None:
    """
    Log warning messages.
    Sends to both console and Sentry with warning level.
    """
    _logger.warning(f"{message} | {context}")
    
    # Send to Sentry as warning using scope
    with sentry_sdk.push_scope() as scope:  # type: ignore
        for key, value in context.items():
            scope.set_extra(key, value)  # type: ignore
        sentry_sdk.capture_message(message, level="warning")  # type: ignore


def debug(message: str, context: dict[str, Any]) -> None:
    """
    Log debug messages.
    Only sends to console, not to Sentry.
    """
    _logger.debug(f"{message} | {context}")

