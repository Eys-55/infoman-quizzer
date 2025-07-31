document.addEventListener('DOMContentLoaded', () => {
    const deckListEl = document.getElementById('deck-list');
    const loadingSpinnerEl = document.getElementById('loading-spinner');
    const errorMessageEl = document.getElementById('error-message');
    
    const API_BASE_URL = 'http://127.0.0.1:5000'; // Or your deployed backend URL

    async function fetchDecks() {
        console.log('Attempting to fetch decks...');
        try {
            const response = await fetch(`${API_BASE_URL}/api/decks`);
            console.log('Received response from /api/decks:', response);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const decks = await response.json();
            console.log('Parsed decks JSON:', decks);
            
            loadingSpinnerEl.classList.add('d-none');

            if (decks && decks.length > 0) {
                renderDecks(decks);
            } else {
                console.log('No decks found in the database.');
                errorMessageEl.textContent = 'No decks found. Use the import tool to add a deck.';
                errorMessageEl.classList.remove('d-none');
            }

        } catch (error) {
            console.error('Failed to fetch decks:', error);
            loadingSpinnerEl.classList.add('d-none');
            errorMessageEl.textContent = 'Could not connect to the server to fetch decks. Please make sure the backend is running.';
            errorMessageEl.classList.remove('d-none');
        }
    }

    async function handleDeleteDeck(deckId, deckName) {
        if (!confirm(`Are you sure you want to permanently delete the deck "${deckName}" and all its cards? This cannot be undone.`)) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/decks/${deckId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Server responded with status ${response.status}`);
            }
            
            // Remove from UI on success
            const deckElement = deckListEl.querySelector(`[data-deck-id='${deckId}']`);
            if (deckElement) {
                deckElement.remove();
            }
            // If no decks are left, show the "no decks" message.
            if (deckListEl.children.length === 0) {
                 errorMessageEl.textContent = 'No decks found. Use the import tool to add a deck.';
                 errorMessageEl.classList.remove('d-none');
            }

        } catch (error) {
            console.error('Failed to delete deck:', error);
            // Use a more specific error div if available, or the main one.
            errorMessageEl.textContent = `Could not delete deck: ${error.message}`;
            errorMessageEl.classList.remove('d-none');
        }
    }

    function renderDecks(decks) {
        console.log('Rendering decks:', decks);
        deckListEl.innerHTML = ''; // Clear existing content
        decks.forEach(deck => {
            const item = document.createElement('div');
            item.className = 'list-group-item d-flex justify-content-between align-items-center';
            item.setAttribute('data-deck-id', deck.id);

            const nameAndDueWrapper = document.createElement('div');
            
            const deckName = document.createElement('span');
            deckName.className = 'fw-bold me-3';
            deckName.textContent = deck.name;
            
            const dueCountBadge = document.createElement('span');
            dueCountBadge.className = 'badge rounded-pill';
            dueCountBadge.textContent = `${deck.due_card_count} due`;
            if (deck.due_card_count > 0) {
                dueCountBadge.classList.add('bg-warning', 'text-dark');
            } else {
                dueCountBadge.classList.add('bg-light', 'text-dark');
            }

            nameAndDueWrapper.appendChild(deckName);
            nameAndDueWrapper.appendChild(dueCountBadge);

            const buttonsWrapper = document.createElement('div');
            
            const studyButton = document.createElement('a');
            studyButton.href = `study.html?deck=${deck.id}`;
            studyButton.className = 'btn btn-sm btn-primary';
            studyButton.textContent = 'Study';

            const deleteButton = document.createElement('button');
            deleteButton.className = 'btn btn-sm btn-danger ms-2';
            deleteButton.textContent = 'Delete';
            deleteButton.title = `Delete deck: ${deck.name}`;
            deleteButton.addEventListener('click', () => handleDeleteDeck(deck.id, deck.name));

            buttonsWrapper.appendChild(studyButton);
            buttonsWrapper.appendChild(deleteButton);

            item.appendChild(nameAndDueWrapper);
            item.appendChild(buttonsWrapper);
            deckListEl.appendChild(item);
        });
        console.log('Deck rendering complete.');
    }

    fetchDecks();
});