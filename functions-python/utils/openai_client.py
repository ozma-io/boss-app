"""
OpenAI Client with LangFuse Integration and Retry Logic

Provides structured output from OpenAI with automatic observability via LangFuse.
Includes retry logic for parsing errors and Sentry integration for failures.
"""

import os
from typing import Any, Type, TypeVar

import sentry_sdk  # type: ignore
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
        model: OpenAI model to use (default: gpt-4o-2024-08-06)
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
            
            # Extract parsed response (already validated Pydantic model)
            parsed_response: T | None = completion.choices[0].message.parsed  # type: ignore
            
            if parsed_response is None:
                raise ValueError("OpenAI returned null parsed response")
            
            info(
                "OpenAI API call successful",
                {
                    "attempt": attempt + 1,
                    "model": model,
                    "response_model": response_model.__name__,
                }
            )
            
            # Type assertion: parsed_response is guaranteed to be T at this point
            return parsed_response  # type: ignore
            
        except Exception as err:
            last_error = err
            error_message = str(err)
            
            warn(
                f"OpenAI API call failed on attempt {attempt + 1}/{max_retries}",
                {
                    "error": error_message,
                    "model": model,
                    "response_model": response_model.__name__,
                }
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
    }
    
    error(
        f"OpenAI API call failed after {max_retries} attempts",
        error_context
    )
    
    # Capture in Sentry with full context
    with sentry_sdk.push_scope() as scope:  # type: ignore
        for key, value in error_context.items():
            scope.set_extra(key, value)  # type: ignore
        sentry_sdk.capture_exception(last_error)  # type: ignore
    
    raise Exception(
        f"Failed to get structured output from OpenAI after {max_retries} attempts: {last_error}"
    )

