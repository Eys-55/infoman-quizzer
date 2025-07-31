import os
from datetime import date
from typing import Optional

from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def get_db_client() -> Client:
    """Initializes and returns the Supabase client."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        raise ValueError("Supabase URL and Key must be set in .env file.")
    return create_client(url, key)

def get_all_decks() -> list:
    """
    Fetches all decks from the database, ordered by name.
    Also calculates the number of cards due for review in each deck.
    """
    client = get_db_client()
    try:
        decks_response = client.table('decks').select('id, name').order('name').execute()
        if not decks_response.data:
            return []
        decks = decks_response.data

        # Fetch all relevant card data to calculate due counts in Python.
        # This is less efficient than a single complex DB query/function but avoids
        # needing to set up a custom PostgreSQL function (RPC) in Supabase.
        cards_response = client.table('cards').select('deck_id, status, review_date').execute()
        cards = cards_response.data or []

        due_counts = {}  # key: deck_id, value: count
        today_iso = date.today().isoformat()

        for card in cards:
            # A card is due if it's new, or if its review date is today or in the past.
            is_due = (
                card.get('status') == 'new' or
                (card.get('review_date') and card.get('review_date') <= today_iso)
            )
            if is_due:
                deck_id = card['deck_id']
                due_counts[deck_id] = due_counts.get(deck_id, 0) + 1

        # Add the due_card_count to each deck object.
        for deck in decks:
            deck['due_card_count'] = due_counts.get(deck['id'], 0)

        return decks
    except Exception as e:
        # Catching a broad exception to handle potential API errors from Supabase
        print(f"Error fetching decks: {e}")
        return []

def get_cards_for_deck(deck_id: int) -> list:
    """Fetches all cards for a specific deck."""
    client = get_db_client()
    try:
        # Fetch all columns for the cards
        response = client.table('cards').select('*').eq('deck_id', deck_id).execute()
        return response.data
    except Exception as e:
        print(f"Error fetching cards for deck {deck_id}: {e}")
        return []


def get_due_cards_for_deck(deck_id: int) -> list:
    """Fetches cards for a specific deck that are due for review."""
    client = get_db_client()
    try:
        today_iso = date.today().isoformat()
        # Filter for cards that are 'new' OR have a review_date in the past/present.
        # The `or_` filter chains conditions.
        response = client.table('cards').select('*') \
            .eq('deck_id', deck_id) \
            .or_(f'status.eq.new,review_date.lte.{today_iso}') \
            .execute()
        return response.data
    except Exception as e:
        print(f"Error fetching due cards for deck {deck_id}: {e}")
        return []

def get_card(card_id: int) -> Optional[dict]:
    """Fetches a single card by its ID."""
    client = get_db_client()
    try:
        response = client.table('cards').select('*').eq('id', card_id).single().execute()
        return response.data
    except Exception as e:
        print(f"Error fetching card {card_id}: {e}")
        return None

def import_deck(parsed_deck: dict):
    """
    Imports a new deck and its cards into the database.
    This is an 'all or nothing' operation.
    """
    client = get_db_client()
    deck_name = parsed_deck['deck_name']
    cards = parsed_deck['cards']

    # 1. Check if deck already exists to provide a friendly error.
    try:
        # Use count to be more efficient than fetching data.
        existing_deck_response = client.table('decks').select('id', count='exact').eq('name', deck_name).execute()
        if existing_deck_response.count > 0:
            raise ValueError(f"Deck '{deck_name}' already exists in the database.")
    except ValueError as e:
        raise e # Re-raise the specific ValueError for the caller to handle.
    except Exception as e:
        # Catch other potential db errors during the check.
        raise Exception(f"Error checking for existing deck: {e}")

    # 2. Insert the new deck to get an ID.
    new_deck_id = None
    try:
        deck_insert_response = client.table('decks').insert({"name": deck_name}).execute()
        if not deck_insert_response.data:
            raise Exception("Failed to insert deck, no data returned from Supabase.")
        new_deck_id = deck_insert_response.data[0]['id']
    except Exception as e:
        # The DB will likely raise a unique constraint error if it exists,
        # but our check above should catch it first. This is a fallback.
        raise Exception(f"Could not create new deck '{deck_name}': {e}")

    if not new_deck_id:
        raise Exception("Fatal: Failed to get new deck ID after insertion.")

    # 3. If there are no cards, we are done.
    if not cards:
        return new_deck_id

    # 4. Prepare and insert cards in a single batch.
    cards_to_insert = [
        {
            'deck_id': new_deck_id,
            'front_content': card['front_content'],
            'back_content': card['back_content'],
            'tags': card['tags'],
            'status': 'new',
            'interval': 0,
            'ease_factor': 2.5,
        } for card in cards
    ]

    try:
        client.table('cards').insert(cards_to_insert).execute()
        return new_deck_id
    except Exception as e:
        # If card insertion fails, roll back the deck creation to maintain atomicity.
        print(f"Error: Failed to insert cards. Rolling back deck creation for '{deck_name}'...")
        try:
            client.table('decks').delete().eq('id', new_deck_id).execute()
            print("Rollback successful.")
        except Exception as rollback_e:
            print(f"CRITICAL ERROR: Failed to roll back deck creation for deck ID {new_deck_id} ('{deck_name}'). Please clean this up manually. Rollback error: {rollback_e}")
        
        raise Exception(f"Failed to insert cards for deck '{deck_name}': {e}")


def delete_deck(deck_id: int):
    """Deletes a deck and all its cards from the database."""
    client = get_db_client()
    try:
        # ON DELETE CASCADE in the DB schema will handle deleting the cards.
        # First, check if the deck exists to provide a better error message.
        check_response = client.table('decks').select('id', count='exact').eq('id', deck_id).execute()
        if check_response.count == 0:
            raise ValueError(f"Deck with id {deck_id} not found.")

        # If it exists, delete it.
        client.table('decks').delete().eq('id', deck_id).execute()

    except ValueError as e:
        raise e # Re-raise not found error for the API to handle.
    except Exception as e:
        print(f"Error deleting deck {deck_id}: {e}")
        raise Exception(f"Could not delete deck {deck_id}.")


def update_card_srs(card_id: int, new_srs_state: dict):
    """Updates the SRS data for a single card."""
    client = get_db_client()
    try:
        # new_srs_state should contain fields like 'review_date', 'interval', etc.
        client.table('cards').update(new_srs_state).eq('id', card_id).execute()
    except Exception as e:
        print(f"Error updating SRS data for card {card_id}: {e}")
        raise e