"""
Sentry Error Monitoring Configuration

Centralized Sentry initialization for Cloud Functions error tracking.
Automatically includes version tracking and environment detection.
"""

import json
import os
from pathlib import Path
from typing import Any

import sentry_sdk  # type: ignore
from sentry_sdk.integrations.logging import LoggingIntegration  # type: ignore

# ============================================================================
# ⚠️ DUPLICATED in ../functions/src/sentry.ts - keep both in sync!
# ============================================================================
# Sentry DSN for boss-app-cloud-functions project
# This is a public key and safe to commit (similar to FACEBOOK_PIXEL_ID)
SENTRY_DSN = "https://c6c5f773287bc359d86a8595b65616d0@o4510351607136256.ingest.us.sentry.io/4510362871726080"
# ============================================================================
# End of duplicated section
# ============================================================================


def get_version() -> str:
    """Get version from package.json"""
    try:
        package_json_path = Path(__file__).parent / "package.json"
        with open(package_json_path, "r", encoding="utf-8") as f:
            package_data = json.load(f)
            return package_data.get("version", "1.0.0")
    except Exception as error:
        print(f"[Sentry] Failed to read version from package.json: {error}")
        return "1.0.0"


def get_environment() -> str:
    """Detect environment based on FUNCTIONS_EMULATOR"""
    emulator_flag = os.getenv("FUNCTIONS_EMULATOR")
    # Strip whitespace for reliable comparison
    emulator_flag = emulator_flag.strip() if emulator_flag else ""
    return "development" if emulator_flag == "true" else "production"


def init_sentry() -> None:
    """
    Initialize Sentry with proper configuration.
    Should be called once at module load time.
    """
    version = get_version()
    environment = get_environment()
    
    # Configure logging integration to capture warnings and errors
    logging_integration = LoggingIntegration(  # type: ignore
        level=None,  # Capture records with level WARNING and above
        event_level=None,  # Don't create events automatically, we'll do it manually
    )
    
    sentry_sdk.init(  # type: ignore
        dsn=SENTRY_DSN,
        environment=environment,
        release=f"boss-app-cloud-functions@{version}",
        # Sample 10% of transactions for performance monitoring
        traces_sample_rate=0.1,
        integrations=[logging_integration],
        # Don't send personal data by default
        before_send=lambda event, hint: _before_send(event, hint),  # type: ignore
    )
    
    print(f"[Sentry] Initialized for environment: {environment}, version: {version}")


def _before_send(event: dict[str, Any], hint: dict[str, Any]) -> dict[str, Any]:
    """Remove personal data before sending to Sentry"""
    # Remove IP address for privacy
    if "user" in event and event["user"]:
        event["user"].pop("ip_address", None)
    return event

