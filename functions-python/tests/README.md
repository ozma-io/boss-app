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

### test_content_generation.py

Tests AI-powered notification content generation with OpenAI structured output.

**Requirements:**
- OPENAI_API_KEY in `.env` file
- (Optional) LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY for observability

**Usage:**
```bash
source .venv/bin/activate
python tests/test_content_generation.py [user_id]
```

If no user_id provided, uses the first user found in database.

**Output:**
Tests all four content generation functions:
1. First email notification (welcome email) - EmailNotificationContent
2. Ongoing email notification (follow-up email) - EmailNotificationContent
3. First push notification (welcome push) - ChatNotificationContent
4. Ongoing push notification (follow-up push) - ChatNotificationContent

Each test displays:
- Reasoning (AI's chain-of-thought, first 200 chars)
- Generated content (title/body or message)
- Content length statistics
- Success/failure status

If LangFuse keys are configured, traces are available in LangFuse dashboard with session ID: `test_session_{user_id}`

### test_email_sending.py

Sends a test email to the test user (test@ozma.io) by creating an email document in Firestore.

**Requirements:**
- Test user with email test@ozma.io must exist in database

**Usage:**
```bash
source .venv/bin/activate
python tests/test_email_sending.py
```

**What it does:**
1. Finds user with email test@ozma.io in Firestore
2. Creates email document with state PLANNED in users/{userId}/emails collection
3. TypeScript trigger then processes the email (Markdown → HTML → template → Mailgun)

**Output:**
- Email document ID
- User ID and email
- Firestore path to monitor (state changes from PLANNED to SENT or FAILED)

## Authentication

Tests use Google Application Default Credentials. Make sure you've run:
```bash
gcloud auth application-default login
```

Or set `GOOGLE_APPLICATION_CREDENTIALS` environment variable in `.env` file.

