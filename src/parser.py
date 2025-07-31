def parse_deck(data: dict) -> dict:
    """
    Validates and sanitizes the structure of a deck dictionary.
    Raises ValueError for invalid structures.
    """
    if not isinstance(data, dict):
        raise ValueError("The root of the JSON must be an object.")

    if 'deck_name' not in data or not isinstance(data['deck_name'], str) or not data['deck_name'].strip():
        raise ValueError("JSON must have a non-empty string 'deck_name' key.")
    
    data['deck_name'] = data['deck_name'].strip()

    if 'cards' not in data or not isinstance(data['cards'], list):
        raise ValueError("JSON must have a 'cards' key containing a list.")

    parsed_cards = []
    for i, card in enumerate(data['cards']):
        if not isinstance(card, dict):
            raise ValueError(f"Card at index {i} is not a valid object.")
        
        if 'front_content' not in card or not isinstance(card['front_content'], str):
            raise ValueError(f"Card at index {i} is missing 'front_content' or it's not a string.")
        
        # 'back_content' is also required, even if empty.
        if 'back_content' not in card or not isinstance(card['back_content'], str):
            raise ValueError(f"Card at index {i} is missing 'back_content' or it's not a string.")

        validated_card = {
            'front_content': card['front_content'],
            'back_content': card['back_content'],
            'tags': card.get('tags', [])
        }
        
        if not isinstance(validated_card['tags'], list):
            raise ValueError(f"Tags for card at index {i} must be a list of strings.")
        
        # Ensure all tags are strings
        if not all(isinstance(tag, str) for tag in validated_card['tags']):
            raise ValueError(f"All items in 'tags' for card at index {i} must be strings.")
        
        parsed_cards.append(validated_card)
    
    data['cards'] = parsed_cards
    return data