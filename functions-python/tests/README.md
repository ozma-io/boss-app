# Tests for Notification Orchestrator

This directory contains test scripts for notification orchestration logic.

## Setup

1. Install dependencies in virtual environment:
```bash
cd functions-python
source .venv/bin/activate
pip install -r requirements.txt
```

2. Ensure `.env` file exists in `boss-app/` root with Firebase credentials

## Available Tests

### test_channels_scenarios.py

Displays notification channels and scenarios for all users who need notifications.

**Usage:**
```bash
source .venv/bin/activate
python tests/test_channels_scenarios.py
```

**Output:**
- Table showing User ID, Email, Channel (PUSH/EMAIL/NONE), Scenario, and Hours since last communication
- Statistics: channel distribution and scenario distribution

### test_intervals.py

Displays progressive notification intervals for all users.

**Usage:**
```bash
source .venv/bin/activate
python tests/test_intervals.py
```

**Output:**
- Table showing User ID, Email, Notification Count, Required Interval, Hours Since Last, Ready status
- Statistics: interval distribution and ready count
- Shows which users will receive notifications based on progressive interval logic

## Authentication

Tests use Google Application Default Credentials. Make sure you've run:
```bash
gcloud auth application-default login
```

Or set `GOOGLE_APPLICATION_CREDENTIALS` environment variable in `.env` file.

