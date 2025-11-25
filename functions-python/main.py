"""
Cloud Functions Entry Points

Infrastructure layer that defines Cloud Function decorators and entry points.
All business logic is delegated to separate modules for testability.
"""

from typing import Any

import firebase_admin  # type: ignore
from firebase_admin import firestore  # type: ignore
from firebase_functions import scheduler_fn
from logger import error
from notification_orchestrator import process_notification_orchestration
from sentry import init_sentry

# Initialize Sentry for error monitoring
init_sentry()


def get_firestore_client() -> Any:
    """
    Get Firestore client instance, initializing Firebase Admin if needed.
    
    Lazy initialization to avoid credential issues during module import.
    """
    if not firebase_admin._apps:  # type: ignore
        firebase_admin.initialize_app()  # type: ignore
    return firestore.client()  # type: ignore


@scheduler_fn.on_schedule(schedule="every 2 hours", region="us-central1")
def notificationOrchestrator(event: scheduler_fn.ScheduledEvent) -> None:
    """
    Cloud Function wrapper for notification orchestration.
    
    Thin wrapper that handles Cloud Function lifecycle and calls business logic.
    Triggered automatically every 2 hours by Cloud Scheduler.
    """
    try:
        db = get_firestore_client()
        process_notification_orchestration(db)
        
    except Exception as e:
        error("Error in notification orchestrator", {"error": str(e)})
        raise

