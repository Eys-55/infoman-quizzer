from datetime import date, timedelta

# Default ease factor
DEFAULT_EASE_FACTOR = 2.5
# Minimum ease factor
MIN_EASE_FACTOR = 1.3

def calculate_next_review(current_srs_state: dict, rating: str) -> dict:
    """
    Calculates the next review state for a card based on a simplified SM-2 algorithm.
    
    Args:
        current_srs_state (dict): A dict with 'interval', 'ease_factor', 'status'.
        rating (str): The user's rating ('again', 'good', 'easy').

    Returns:
        dict: A dict with the new 'interval', 'ease_factor', 'status', and 'review_date'.
    """
    
    interval = current_srs_state.get('interval', 0)
    ease_factor = current_srs_state.get('ease_factor', DEFAULT_EASE_FACTOR)
    status = current_srs_state.get('status', 'new')

    new_interval = 0
    new_ease_factor = ease_factor

    if rating == 'again':
        # Card is forgotten, reset interval to 1 day.
        new_interval = 1
        new_status = 'learning'
        # Ease factor is reduced when a card is forgotten.
        new_ease_factor = max(MIN_EASE_FACTOR, ease_factor - 0.2)
    elif rating == 'good':
        if status in ('new', 'learning'):
            # Graduating from new/learning.
            new_interval = 1
        else: # 'review' status
            new_interval = round(interval * ease_factor)
        new_status = 'review'
    elif rating == 'easy':
        if status in ('new', 'learning'):
            # Graduating from new/learning with 'easy'.
            new_interval = 4 # A common starting 'easy' interval
        else: # 'review' status
            new_interval = round(interval * ease_factor * 1.3) # 1.3 is Anki's "easy bonus"
        
        # Increase ease factor for 'easy' ratings.
        new_ease_factor = ease_factor + 0.15
        new_status = 'review'
    else:
        raise ValueError(f"Invalid rating: '{rating}'. Must be 'again', 'good', or 'easy'.")

    # Don't let ease factor go below minimum.
    if new_ease_factor < MIN_EASE_FACTOR:
        new_ease_factor = MIN_EASE_FACTOR

    # Clamp interval to a reasonable max (e.g., 100 years) and a minimum of 1 day.
    if new_interval > 36500:
        new_interval = 36500
    if new_interval < 1:
        new_interval = 1

    next_review_date = date.today() + timedelta(days=new_interval)

    return {
        'interval': new_interval,
        'ease_factor': round(new_ease_factor, 2),
        'status': new_status,
        'review_date': next_review_date.isoformat()
    }