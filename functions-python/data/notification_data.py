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
            break
        
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
    
    # Find and update users in Firestore
    updated_count = 0
    batch = db.batch()
    batch_count = 0
    max_batch_size = 500  # Firestore batch write limit
    
    for email in unsubscribed_emails:
        # Query users by email
        users_ref = db.collection('users')
        query = users_ref.where('email', '==', email).limit(10)
        users = query.stream()
        
        for user_doc in users:
            user_data = user_doc.to_dict()
            
            # Skip if already marked as unsubscribed
            if user_data.get('email_unsubscribed'):
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

