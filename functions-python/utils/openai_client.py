"""
OpenAI Client with LangFuse Integration and Retry Logic

Provides structured output from OpenAI with automatic observability via LangFuse.
Includes retry logic for parsing errors and Sentry integration for failures.

Uses modern Langfuse @observe decorator for proper trace management with
user_id and session_id tracking as first-class trace attributes.
"""

import base64
import os
import time
from typing import Any, Type, TypeVar

import sentry_sdk  # type: ignore
from openai import APIError, APIConnectionError, APITimeoutError, RateLimitError, OpenAI  # type: ignore
from pydantic import BaseModel

from langfuse import Langfuse, observe, get_client  # type: ignore

from .logger import error, info, warn

T = TypeVar('T', bound=BaseModel)

# Default model for content generation
DEFAULT_MODEL = "gpt-5"

# Initialize Langfuse global client at module import time
# This ensures @observe decorator has access to properly configured client
def _initialize_langfuse() -> None:
    """
    Initialize Langfuse global client with environment credentials.
    
    Called once at module import to ensure @observe decorator has access
    to properly configured client before any functions are called.
    """
    # Strip Langfuse keys if present (common issue with Firebase secrets containing newlines)
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
        
        # Set host (US region)
        os.environ.setdefault("LANGFUSE_HOST", "https://us.cloud.langfuse.com")
        
        # Configure OpenTelemetry OTLP exporter for Langfuse
        # This enables full observability with traces sent to Langfuse via OTLP protocol
        langfuse_auth = base64.b64encode(
            f"{cleaned_public}:{cleaned_secret}".encode()
        ).decode()
        
        os.environ["OTEL_EXPORTER_OTLP_ENDPOINT"] = "https://us.cloud.langfuse.com/api/public/otel"
        os.environ["OTEL_EXPORTER_OTLP_HEADERS"] = f"Authorization=Basic {langfuse_auth}"
        
        # Set generous timeouts for OTLP exporter (30 seconds instead of default 5)
        # This prevents ReadTimeoutError when sending large traces or on slow networks
        os.environ["OTEL_EXPORTER_OTLP_TIMEOUT"] = "30000"  # milliseconds
        
        # Log key status
        if public_had_whitespace or secret_had_whitespace:
            warn("Langfuse keys contained whitespace characters (stripped)", {
                "public_had_whitespace": public_had_whitespace,
                "secret_had_whitespace": secret_had_whitespace,
            })
        
        # Initialize Langfuse global client with explicit credentials
        # This client will be used by @observe decorator and get_client()
        try:
            _ = Langfuse(
                public_key=cleaned_public,
                secret_key=cleaned_secret,
                host="https://us.cloud.langfuse.com",
                debug=False,
                # Increase timeouts for better reliability in serverless environments
                flush_at=15,  # Number of events before auto-flush (default: 15)
                flush_interval=5.0,  # Seconds between auto-flushes (default: 0.5)
                timeout=30,  # HTTP timeout in seconds (default: 20)
            )
            info("Langfuse global client initialized at module import", {
                "host": "https://us.cloud.langfuse.com",
                "public_key_prefix": cleaned_public[:7] if len(cleaned_public) > 7 else "invalid",
                "flush_at": 100,
                "flush_interval": 5.0,
                "timeout": 30,
            })
        except Exception as langfuse_init_error:
            error("Failed to initialize Langfuse client at module import", {
                "error": str(langfuse_init_error),
                "error_type": type(langfuse_init_error).__name__,
            })
    else:
        warn("Langfuse keys not found at module import - observability disabled", {
            "has_public_key": bool(langfuse_public_key),
            "has_secret_key": bool(langfuse_secret_key),
        })

# Initialize Langfuse immediately at module import
_initialize_langfuse()


@observe(as_type="generation")
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
    
    Uses modern Langfuse @observe decorator for automatic observability.
    Properly sets user_id and session_id as trace-level attributes.
    Retries up to max_retries times on parsing failures.
    
    Args:
        prompt: User prompt to send to OpenAI
        response_model: Pydantic model defining expected response structure
        model: OpenAI model to use
        user_id: User ID for LangFuse tracking (set as trace attribute)
        session_id: Session ID for LangFuse tracking (set as trace attribute)
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
    
    # Get Langfuse client for trace management (from @observe decorator context)
    # Client was initialized at module import time, so @observe has proper access
    langfuse_client = get_client()
    
    # Update trace with user_id, session_id, and generation name
    # This sets them as first-class trace attributes (not just metadata)
    trace_tags = ["notification", "openai", response_model.__name__]
    if metadata:
        # Add scenario or notification_type as tags for better filtering
        if "scenario" in metadata:
            trace_tags.append(f"scenario:{metadata['scenario']}")
        if "notification_type" in metadata:
            trace_tags.append(f"type:{metadata['notification_type']}")
    
    langfuse_client.update_current_trace(
        name=generation_name or f"openai_{response_model.__name__}",
        user_id=user_id,
        session_id=session_id,
        tags=trace_tags,
        metadata=metadata,
    )
    
    # Initialize standard OpenAI client (not wrapped)
    # The @observe decorator handles tracing automatically
    client = OpenAI(api_key=api_key)
    
    # Build messages array
    messages = [
        {"role": "system", "content": prompt}
    ]
    
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
            # Note: We use standard OpenAI client (not Langfuse wrapper)
            # The @observe decorator handles tracing automatically
            #
            # IMPORTANT: Pass user_id as 'user' parameter to OpenAI
            # This helps OpenAI monitor and detect abuse at the end-user level,
            # so if a user violates policies, OpenAI blocks them (not our entire org)
            
            # Build API call parameters
            api_params: dict[str, Any] = {
                "model": model,
                "messages": messages,
                "response_format": response_model,
            }
            
            # Add user identifier if available (for abuse monitoring)
            if user_id:
                api_params["user"] = user_id
            
            completion = client.beta.chat.completions.parse(**api_params)  # type: ignore
            
            # Calculate request duration
            request_duration_ms = int((time.time() - request_start_time) * 1000)
            
            # Extract parsed response (already validated Pydantic model)
            parsed_response: T | None = completion.choices[0].message.parsed  # type: ignore
            
            if parsed_response is None:
                raise ValueError("OpenAI returned null parsed response")
            
            # Extract token usage for monitoring
            usage = getattr(completion, 'usage', None)  # type: ignore
            usage_details = None
            if usage:
                usage_details = {
                    "input": getattr(usage, 'prompt_tokens', 0),  # type: ignore
                    "output": getattr(usage, 'completion_tokens', 0),  # type: ignore
                    "total": getattr(usage, 'total_tokens', 0),  # type: ignore
                }
            
            # Update current generation with model details and usage
            # This enriches the Langfuse trace with generation-specific metadata
            try:
                model_params: dict[str, Any] = {
                    "temperature": "1.0",  # OpenAI default for structured output (as string for Langfuse)
                    "response_format": response_model.__name__,
                }
                langfuse_client.update_current_generation(
                    model=model,
                    model_parameters=model_params,
                    usage_details=usage_details,
                    output=parsed_response.model_dump() if hasattr(parsed_response, 'model_dump') else None,
                )
            except Exception as update_error:
                # Don't fail if Langfuse update fails
                warn("Failed to update Langfuse generation metadata", {
                    "error": str(update_error),
                    "error_type": type(update_error).__name__,
                })
            
            info(
                "OpenAI API call successful",
                {
                    "attempt": attempt + 1,
                    "model": model,
                    "response_model": response_model.__name__,
                    "duration_ms": request_duration_ms,
                    **(usage_details if usage_details else {}),
                }
            )
            
            # Flush Langfuse events immediately after successful generation
            # Critical for serverless environments where background tasks are terminated
            try:
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

