"""
OpenAI Client with LangFuse Integration and Retry Logic

Provides structured output from OpenAI with automatic observability via LangFuse.
Includes retry logic for parsing errors and Sentry integration for failures.
"""

import os
import time
from typing import Any, Type, TypeVar

import sentry_sdk  # type: ignore
from openai import APIError, APIConnectionError, APITimeoutError, RateLimitError  # type: ignore
from pydantic import BaseModel

from langfuse.openai import OpenAI  # type: ignore

from .logger import error, info, warn

T = TypeVar('T', bound=BaseModel)

# Default model for content generation
DEFAULT_MODEL = "gpt-5"


def call_openai_with_structured_output(
    prompt: str,
    response_model: Type[T],
    model: str = DEFAULT_MODEL,
    user_id: str | None = None,
    session_id: str | None = None,
    generation_name: str | None = None,
    metadata: dict[str, Any] | None = None,
    max_retries: int = 3,
) -> T:
    """
    Call OpenAI API with structured output and retry logic.
    
    Uses LangFuse for automatic observability when available.
    Retries up to max_retries times on parsing failures.
    
    Args:
        prompt: User prompt to send to OpenAI
        response_model: Pydantic model defining expected response structure
        model: OpenAI model to use
        user_id: User ID for LangFuse tracking
        session_id: Session ID for LangFuse tracking
        generation_name: Name for this generation in LangFuse
        metadata: Additional metadata for LangFuse
        max_retries: Maximum number of retry attempts
        
    Returns:
        Validated Pydantic model instance
        
    Raises:
        Exception: After max_retries failed attempts (also sent to Sentry)
    """
    # Load API keys from environment
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        error_msg = "OPENAI_API_KEY not found in environment"
        error(error_msg, {})
        raise ValueError(error_msg)
    
    # Strip whitespace and newlines from API key (common issue with secrets management)
    api_key = api_key.strip()
    
    # Strip Langfuse keys if present (common issue with Firebase secrets containing newlines)
    # Langfuse SDK fails silently with invalid keys (becomes no-op), so we need explicit handling
    langfuse_public_key = os.getenv("LANGFUSE_PUBLIC_KEY")
    langfuse_secret_key = os.getenv("LANGFUSE_SECRET_KEY")
    
    if langfuse_public_key and langfuse_secret_key:
        # Strip and validate keys
        cleaned_public = langfuse_public_key.strip()
        cleaned_secret = langfuse_secret_key.strip()
        
        # Detect whitespace in original keys
        public_had_whitespace = langfuse_public_key != cleaned_public
        secret_had_whitespace = langfuse_secret_key != cleaned_secret
        
        # Update environment with cleaned keys
        os.environ["LANGFUSE_PUBLIC_KEY"] = cleaned_public
        os.environ["LANGFUSE_SECRET_KEY"] = cleaned_secret
        
        # Prepare log context
        log_context: dict[str, Any] = {
            "public_key_prefix": cleaned_public[:7] if len(cleaned_public) > 7 else "invalid",
            "public_key_suffix": cleaned_public[-4:] if len(cleaned_public) > 4 else "invalid",
            "secret_key_prefix": cleaned_secret[:7] if len(cleaned_secret) > 7 else "invalid",
            "public_key_length": len(cleaned_public),
            "secret_key_length": len(cleaned_secret),
        }
        
        # Log details about whitespace if found (security: only show repr of first/last chars)
        if public_had_whitespace or secret_had_whitespace:
            warn("Langfuse keys contained whitespace characters (stripped)", {
                **log_context,
                "public_had_whitespace": public_had_whitespace,
                "secret_had_whitespace": secret_had_whitespace,
                # Show repr of first/last 3 chars to reveal hidden characters like \n
                "public_key_first_chars": repr(langfuse_public_key[:3]) if public_had_whitespace else None,
                "public_key_last_chars": repr(langfuse_public_key[-3:]) if public_had_whitespace else None,
                "secret_key_first_chars": repr(langfuse_secret_key[:3]) if secret_had_whitespace else None,
                "secret_key_last_chars": repr(langfuse_secret_key[-3:]) if secret_had_whitespace else None,
            })
        else:
            info("Langfuse keys configured successfully", log_context)
    else:
        error("Langfuse keys not found - observability will be disabled", {
            "has_public_key": bool(langfuse_public_key),
            "has_secret_key": bool(langfuse_secret_key),
        })
    
    # Set LangFuse host (US region, matches TypeScript config)
    # LangFuse OpenAI wrapper reads this from environment
    os.environ.setdefault("LANGFUSE_HOST", "https://us.cloud.langfuse.com")
    
    # Initialize OpenAI client (with LangFuse wrapper)
    # LangFuse automatically uses env vars: LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_HOST
    # If keys not set, LangFuse observability is disabled (client works as standard OpenAI)
    client = OpenAI(api_key=api_key)
    
    # Build messages array
    messages = [
        {"role": "system", "content": prompt}
    ]
    
    # Merge user_id and session_id into metadata for LangFuse tracking
    merged_metadata = metadata.copy() if metadata else {}
    if user_id:
        merged_metadata["user_id"] = user_id
    if session_id:
        merged_metadata["session_id"] = session_id
    
    last_error = None
    last_error_details = {}
    
    for attempt in range(max_retries):
        try:
            info(
                f"OpenAI API call attempt {attempt + 1}/{max_retries}",
                {
                    "model": model,
                    "response_model": response_model.__name__,
                    "user_id": user_id,
                    "session_id": session_id,
                    "generation_name": generation_name,
                }
            )
            
            # Track request start time for latency measurement
            request_start_time = time.time()
            
            # Call OpenAI with structured output
            # The response_format parameter forces OpenAI to return valid JSON
            # matching the Pydantic model schema
            # LangFuse wrapper adds tracking parameters (name, metadata)
            completion = client.beta.chat.completions.parse(  # type: ignore
                model=model,
                messages=messages,  # type: ignore
                response_format=response_model,
                name=generation_name,  # type: ignore
                metadata=merged_metadata if merged_metadata else None,  # type: ignore
            )
            
            # Calculate request duration
            request_duration_ms = int((time.time() - request_start_time) * 1000)
            
            # Extract parsed response (already validated Pydantic model)
            parsed_response: T | None = completion.choices[0].message.parsed  # type: ignore
            
            if parsed_response is None:
                raise ValueError("OpenAI returned null parsed response")
            
            # Extract token usage for monitoring
            usage = getattr(completion, 'usage', None)  # type: ignore
            usage_info = {}
            if usage:
                usage_info = {
                    "prompt_tokens": getattr(usage, 'prompt_tokens', None),  # type: ignore
                    "completion_tokens": getattr(usage, 'completion_tokens', None),  # type: ignore
                    "total_tokens": getattr(usage, 'total_tokens', None),  # type: ignore
                }
            
            info(
                "OpenAI API call successful",
                {
                    "attempt": attempt + 1,
                    "model": model,
                    "response_model": response_model.__name__,
                    "duration_ms": request_duration_ms,
                    **usage_info,
                }
            )
            
            # Flush Langfuse events immediately after successful generation
            # Critical for serverless environments where background tasks are terminated
            try:
                from langfuse import get_client
                langfuse_client = get_client()
                langfuse_client.flush()
                info("Langfuse events flushed successfully", {
                    "user_id": user_id,
                    "session_id": session_id,
                    "generation_name": generation_name,
                })
            except Exception as flush_error:
                # Don't fail the function if flush fails, just log it
                error("Failed to flush Langfuse events", {
                    "flush_error": str(flush_error),
                    "flush_error_type": type(flush_error).__name__,
                    "user_id": user_id,
                    "session_id": session_id,
                })
            
            # Type assertion: parsed_response is guaranteed to be T at this point
            return parsed_response  # type: ignore
            
        except Exception as err:
            last_error = err
            error_message = str(err)
            
            # Collect detailed error information for Sentry
            error_details = {
                "error_type": type(err).__name__,
                "error_message": error_message,
                "model": model,
                "response_model": response_model.__name__,
                "attempt": attempt + 1,
            }
            
            # Extract OpenAI-specific error details
            if isinstance(err, APIConnectionError):
                error_details["error_category"] = "connection_error"
                error_details["is_retryable"] = True
            elif isinstance(err, APITimeoutError):
                error_details["error_category"] = "timeout_error"
                error_details["is_retryable"] = True
            elif isinstance(err, RateLimitError):
                error_details["error_category"] = "rate_limit_error"
                error_details["is_retryable"] = True
            elif isinstance(err, APIError):
                error_details["error_category"] = "api_error"
                # Extract HTTP status code and headers if available
                if hasattr(err, 'status_code'):  # type: ignore
                    error_details["http_status_code"] = err.status_code  # type: ignore
                if hasattr(err, 'response'):  # type: ignore
                    response = err.response  # type: ignore
                    if hasattr(response, 'headers'):  # type: ignore
                        # Extract useful headers for debugging
                        headers = response.headers  # type: ignore
                        useful_headers_list: list[str] = []
                        for header_name in ['retry-after', 'x-ratelimit-remaining', 'x-ratelimit-reset', 'x-request-id']:
                            if header_name in headers:
                                useful_headers_list.append(f"{header_name}: {headers[header_name]}")  # type: ignore
                        if useful_headers_list:
                            error_details["response_headers"] = "; ".join(useful_headers_list)  # type: ignore
                    if hasattr(response, 'text'):  # type: ignore
                        # Truncate response body to avoid huge logs
                        response_text = response.text[:500]  # type: ignore
                        if response_text:
                            error_details["response_body"] = response_text
            else:
                error_details["error_category"] = "unknown_error"
            
            # Store for final Sentry report
            last_error_details = error_details
            
            warn(
                f"OpenAI API call failed on attempt {attempt + 1}/{max_retries}",
                error_details
            )
            
            # On retry, append error feedback to messages to help model fix the issue
            if attempt < max_retries - 1:
                messages.append({
                    "role": "assistant",
                    "content": "I encountered an error. Let me try again with a corrected response."
                })
                messages.append({
                    "role": "user",
                    "content": f"Previous attempt failed with error: {error_message}. Please provide a valid response matching the required schema."
                })
    
    # All retries exhausted - log to Sentry and raise
    error_context = {
        "model": model,
        "response_model": response_model.__name__,
        "user_id": user_id,
        "session_id": session_id,
        "generation_name": generation_name,
        "max_retries": max_retries,
        "last_error": str(last_error),
        "last_error_type": type(last_error).__name__,
    }
    
    # Merge detailed error information
    if last_error_details:
        error_context.update(last_error_details)
    
    error(
        f"OpenAI API call failed after {max_retries} attempts",
        error_context
    )
    
    # Capture in Sentry with full context and proper tags
    with sentry_sdk.push_scope() as scope:  # type: ignore
        # Set tags for better filtering in Sentry
        scope.set_tag("openai_error_type", error_context.get("error_type", "unknown"))  # type: ignore
        scope.set_tag("openai_error_category", error_context.get("error_category", "unknown"))  # type: ignore
        scope.set_tag("openai_model", model)  # type: ignore
        
        # Set all context as extra data
        for key, value in error_context.items():
            scope.set_extra(key, value)  # type: ignore
        
        # Capture the original exception (preserves stack trace)
        sentry_sdk.capture_exception(last_error)  # type: ignore
    
    raise Exception(
        f"Failed to get structured output from OpenAI after {max_retries} attempts: {last_error}"
    )

