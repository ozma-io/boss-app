"""
Notification Data Layer

Mailgun integration for syncing unsubscribe list with Firestore.
All functions take db client as first parameter for dependency injection.
"""

from typing import Any

from utils.logger import error, info


def fetch_mailgun_unsubscribes(mailgun_api_key: str, mailgun_domain: str) -> list[str]:
    """
    Fetch list of unsubscribed emails from Mailgun Suppressions API.
    
    This function is safe to test in production - it only reads data, doesn't modify anything.
    Handles pagination to fetch all unsubscribed emails, not just the first page.
    
    Args:
        mailgun_api_key: Mailgun API key for authentication
        mailgun_domain: Mailgun domain (e.g., 'mailgun.services.ozma.io')
        
    Returns:
        List of email addresses that have unsubscribed
        
    Raises:
        ValueError: If API returns non-200 status
        requests.RequestException: If network request fails
    """
    import requests
    
    info("Fetching Mailgun unsubscribes (with pagination)", {"domain": mailgun_domain})
    
    all_unsubscribed_emails: list[str] = []
    url = f'https://api.mailgun.net/v3/{mailgun_domain}/unsubscribes'
    params = {'limit': 1000}  # Max results per request
    page_count = 0
    previous_url = None
    
    while url:
        page_count += 1
        
        # Safety check: prevent infinite loops
        if page_count > 100:
            error("Too many pages fetched, stopping", {"page_count": page_count})
            raise ValueError(f"Mailgun pagination limit exceeded: {page_count} pages. Cannot safely sync unsubscribes.")
        
        # Check if we're repeating the same URL (infinite loop protection)
        if previous_url == url:
            info("Same URL as previous page, stopping pagination", {"url": url})
            break
        
        previous_url = url
        
        # Fetch current page
        response = requests.get(
            url,
            auth=('api', mailgun_api_key),
            params=params if page_count == 1 else None  # Only use params on first request
        )
        
        if response.status_code != 200:
            error("Failed to fetch Mailgun unsubscribes", {
                "status_code": response.status_code,
                "response": response.text,
                "page": page_count
            })
            raise ValueError(f"Mailgun API returned status {response.status_code}")
        
        data = response.json()
        unsubscribes = data.get('items', [])
        
        # If no items on this page, we've reached the end
        if not unsubscribes:
            info("No items on page, stopping pagination", {"page": page_count})
            break
        
        # Extract emails from current page
        page_emails = [item['address'] for item in unsubscribes if 'address' in item]
        all_unsubscribed_emails.extend(page_emails)
        
        info("Fetched Mailgun unsubscribes page", {
            "page": page_count,
            "items_on_page": len(unsubscribes),
            "emails_on_page": len(page_emails),
            "total_so_far": len(all_unsubscribed_emails)
        })
        
        # Check if there's a next page
        paging = data.get('paging', {})
        next_url = paging.get('next')
        
        # Stop if no next URL or if it's empty
        if not next_url:
            info("No next page URL, pagination complete", {"page": page_count})
            break
        
        url = next_url
        params = None  # Next URL already contains all params
    
    info("Fetched all Mailgun unsubscribes", {
        "total_pages": page_count,
        "total_emails": len(all_unsubscribed_emails)
    })
    
    return all_unsubscribed_emails


def sync_mailgun_unsubscribes(db: Any) -> int:
    """
    Sync unsubscribe list from Mailgun and update Firestore.
    
    Implementation:
    1. Fetch suppressions list from Mailgun API
    2. For each unsubscribed email, find user in Firestore
    3. Batch update email_unsubscribed=true for all matching users
    4. Return count of updated users
    
    Args:
        db: Firestore client instance
        
    Returns:
        Number of users updated
    """
    import os
    
    info("Syncing Mailgun unsubscribes", {})
    
    # Get Mailgun API credentials from environment
    mailgun_api_key = os.environ.get('MAILGUN_API_KEY')
    if not mailgun_api_key:
        error("MAILGUN_API_KEY not found in environment", {})
        raise ValueError("MAILGUN_API_KEY not configured")
    
    mailgun_domain = 'mailgun.services.ozma.io'
    
    # Fetch unsubscribed emails from Mailgun
    try:
        unsubscribed_emails = fetch_mailgun_unsubscribes(mailgun_api_key, mailgun_domain)
    except Exception as e:
        error("Failed to fetch Mailgun unsubscribes", {"error": str(e)})
        raise
    
    if not unsubscribed_emails:
        info("No unsubscribes found in Mailgun", {})
        return 0
    
    # Find and update users in Firestore using batched WHERE IN queries
    # Firestore supports up to 30 values in WHERE IN clause, so we chunk emails
    updated_count = 0
    chunk_size = 30  # Firestore WHERE IN limit
    email_chunks = [unsubscribed_emails[i:i + chunk_size] for i in range(0, len(unsubscribed_emails), chunk_size)]
    
    info("Querying users by email in chunks", {
        "total_emails": len(unsubscribed_emails),
        "total_chunks": len(email_chunks),
        "chunk_size": chunk_size,
    })
    
    # Fetch all matching users using chunked WHERE IN queries
    all_user_docs: list[Any] = []
    users_ref = db.collection('users')
    
    for chunk_idx, email_chunk in enumerate(email_chunks):
        query = users_ref.where('email', 'in', email_chunk)
        chunk_users = list(query.stream())
        all_user_docs.extend(chunk_users)
        
        info("Fetched users chunk", {
            "chunk_index": chunk_idx + 1,
            "total_chunks": len(email_chunks),
            "users_found": len(chunk_users),
        })
    
    info("All users fetched", {"total_users": len(all_user_docs)})
    
    # Check for duplicate emails (data integrity)
    email_to_users: dict[str, list[Any]] = {}
    for user_doc in all_user_docs:
        user_data = user_doc.to_dict()
        if not user_data:
            continue
        user_email = user_data.get('email')
        if not user_email:
            continue
        if user_email not in email_to_users:
            email_to_users[user_email] = []
        email_to_users[user_email].append(user_doc)
    
    for email, user_docs_list in email_to_users.items():
        if len(user_docs_list) > 1:
            error("Multiple users with same email found", {
                "email": email,
                "count": len(user_docs_list),
                "user_ids": [doc.id for doc in user_docs_list],
            })
    
    # Update users in batches (Firestore batch write limit: 500)
    batch = db.batch()
    batch_count = 0
    max_batch_size = 500
    
    for user_doc in all_user_docs:
        user_data = user_doc.to_dict()
        
        # Skip if already marked as unsubscribed
        if user_data and user_data.get('email_unsubscribed'):
            continue
        
        # Add update to batch
        user_ref = users_ref.document(user_doc.id)
        batch.update(user_ref, {'email_unsubscribed': True})
        batch_count += 1
        updated_count += 1
        
        # Commit batch if reaching limit
        if batch_count >= max_batch_size:
            batch.commit()
            info("Committed batch update", {"count": batch_count})
            batch = db.batch()
            batch_count = 0
    
    # Commit remaining updates
    if batch_count > 0:
        batch.commit()
        info("Committed final batch update", {"count": batch_count})
    
    info("Mailgun unsubscribes sync complete", {
        "total_unsubscribed_emails": len(unsubscribed_emails),
        "users_updated": updated_count
    })
    
    return updated_count

