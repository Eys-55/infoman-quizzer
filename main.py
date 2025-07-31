import os
import os
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

from src.srs_logic import calculate_next_review
from src.parser import parse_deck
from src.db_client import get_all_decks, get_due_cards_for_deck, import_deck, get_card, update_card_srs, delete_deck

# --- Flask App Initialization ---
app = Flask(__name__, static_folder='frontend', static_url_path='')
CORS(app) # Allow Cross-Origin requests for development

# --- API Endpoints ---
@app.route('/api/decks', methods=['GET'])
def api_get_all_decks():
    """API endpoint to get all decks."""
    try:
        decks = get_all_decks()
        return jsonify(decks)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/decks/<int:deck_id>/cards', methods=['GET'])
def api_get_cards_for_deck(deck_id):
    """API endpoint to get all cards for a given deck that are due for review."""
    try:
        cards = get_due_cards_for_deck(deck_id)
        return jsonify(cards)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/import', methods=['POST'])
def api_import_deck():
    """API endpoint to import a new deck from a JSON object."""
    parsed_data = request.get_json()
    if not parsed_data:
        return jsonify({"error": "Request must be a valid JSON object."}), 400

    try:
        # The parse_deck function now validates the structure of the received dict
        parsed_data = parse_deck(parsed_data)
    except ValueError as e:
        return jsonify({"error": f"JSON Structure Error: {e}"}), 400

    try:
        import_deck(parsed_data)
        deck_name = parsed_data['deck_name']
        card_count = len(parsed_data['cards'])
        return jsonify({
            "message": "Import Successful",
            "deck_name": deck_name,
            "card_count": card_count
        }), 201
    except ValueError as e:  # Catch "deck already exists" error
        return jsonify({"error": f"Database Error: {e}"}), 409  # 409 Conflict
    except Exception as e:
        return jsonify({"error": f"Database Error: {e}"}), 500


@app.route('/api/decks/<int:deck_id>', methods=['DELETE'])
def api_delete_deck(deck_id):
    """API endpoint to delete a deck and all its associated cards."""
    try:
        delete_deck(deck_id)
        return jsonify({"message": f"Deck with id {deck_id} deleted successfully."}), 200
    except ValueError as e: # Catch "not found" from db_client
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": f"Database or I/O Error: {e}"}), 500


@app.route('/api/cards/review', methods=['POST'])
def api_review_card():
    """API endpoint to review a card and update its SRS data."""
    data = request.get_json()
    if not data or 'card_id' not in data or 'rating' not in data:
        return jsonify({"error": "Request must be JSON with 'card_id' and 'rating' fields."}), 400

    card_id = data['card_id']
    rating = data['rating'] # 'again', 'good', 'easy'

    try:
        # 1. Fetch current card state
        current_card = get_card(card_id)
        if not current_card:
            return jsonify({"error": f"Card with id {card_id} not found."}), 404

        # 2. Calculate new SRS state
        current_srs_state = {
            'interval': current_card.get('interval', 0),
            'ease_factor': current_card.get('ease_factor', 2.5),
            'status': current_card.get('status', 'new')
        }
        new_srs_state = calculate_next_review(current_srs_state, rating)

        # 3. Update the card in the database
        update_card_srs(card_id, new_srs_state)

        return jsonify({
            "message": "Card review updated successfully.",
            "card_id": card_id,
            "new_state": new_srs_state
        }), 200

    except ValueError as e: # Catches invalid rating from srs_logic
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Database or SRS logic Error: {e}"}), 500


# --- Frontend Serving ---
@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static_files(path):
    # This serves other files like study.html, app.js, etc.
    return send_from_directory(app.static_folder, path)

if __name__ == "__main__":
    # The --import and --study flags are no longer used.
    # The app is now a web server.
    # For production, use a proper WSGI server like Gunicorn or Waitress.
    app.run(debug=True, port=5000)