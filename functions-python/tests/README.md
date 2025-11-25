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

### test_local.py

Tests the complete notification orchestration logic locally without deploying.

**Usage:**
```bash
source .venv/bin/activate
python tests/test_local.py
```

## Authentication

Tests use Google Application Default Credentials. Make sure you've run:
```bash
gcloud auth application-default login
```

Or set `GOOGLE_APPLICATION_CREDENTIALS` environment variable in `.env` file.

