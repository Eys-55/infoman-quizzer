document.addEventListener('DOMContentLoaded', () => {
    // --- State ---
    let cards = [];
    let currentCardIndex = 0;
    let isBackVisible = false;

    // --- DOM Elements ---
    const deckTitleEl = document.getElementById('deck-title');
    const sessionStatusEl = document.getElementById('session-status');
    const frontCardEl = document.getElementById('front-card');
    const backCardEl = document.getElementById('back-card');
    const frontContentEl = document.getElementById('card-front-content');
    const backContentEl = document.getElementById('card-back-content');
    const actionBtn = document.getElementById('action-btn');
    const ratingButtonsEl = document.getElementById('rating-buttons');
    const studyAreaEl = document.getElementById('study-area');
    const sessionCompleteEl = document.getElementById('session-complete');
    const errorMessageEl = document.getElementById('error-message');

    const API_BASE_URL = 'http://127.0.0.1:5000';

    // --- Content Rendering Logic ---

    /**
     * Parses the content of a [TABLE] block string into headers and rows.
     * @param {string} tableContent - The raw string content from within a [TABLE] block.
     * @returns {{headers: string[], rows: string[][]}|null}
     */
    function parseTableData(tableContent) {
        console.log('%c--- Parsing Table Data ---', 'color: blue; font-weight: bold;');
        console.log('Input tableContent:\n', tableContent);
        const lines = tableContent.trim().split('\n').filter(line => line.trim());
        console.log('Filtered lines:', lines);
        if (lines.length < 2) {
            console.error('Table parse failed: Not enough lines.', lines);
            return null; // Not a valid table
        }

        const headers = lines[0].split('|').map(h => h.trim());
        console.log('Parsed headers:', headers);
        // Line 2 is a separator, we skip it.

        const rows = [];
        for (let i = 2; i < lines.length; i++) {
            const rowData = lines[i].split('|').map(r => r.trim());
            // Pad row if it has fewer columns than headers
            if (rowData.length < headers.length) {
                console.warn('Row has fewer columns than headers. Padding...', { rowData, headers });
            }
            while (rowData.length < headers.length) {
                rowData.push('');
            }
            rows.push(rowData);
        }
        console.log('Parsed rows:', rows);
        console.log('%c--- Finished Parsing Table ---', 'color: blue; font-weight: bold;');

        return { headers, rows };
    }

    /**
     * Renders card content, including special blocks like [TABLE] and [CODE], and inline `code`,
     * into a target DOM element.
     * @param {string} content - The raw string content of a card's side.
     * @param {HTMLElement} targetElement - The DOM element to render the content into.
     */
    function renderContent(content, targetElement) {
        console.log(`%c--- Rendering Content into ${targetElement.id} ---`, 'color: green; font-weight: bold;');
        console.log('Input content:\n', content);
        targetElement.innerHTML = ''; // Clear previous content

        // Regex to find [TAG=param]...[/TAG] blocks.
        const blockRegex = /\[([A-Z]+)(?:=([a-zA-Z0-9_\-]+))?\](.*?)\[\/\1\]/gs;
        let lastIndex = 0;
        let match;

        // Use a document fragment for performance
        const fragment = document.createDocumentFragment();

        // Renders a text string, safely handling `inline code` and line breaks.
        const renderText = (text) => {
            if (!text) return;
            const p = document.createElement('p');
            // Split by `...` and alternate between text nodes and <code> elements.
            // The capturing group in split() keeps the delimiter in the result array.
            const parts = text.split(/(`[^`]+`)/g);
            parts.forEach(part => {
                if (part.startsWith('`') && part.endsWith('`')) {
                    const code = document.createElement('code');
                    // Bootstrap's `<code>` styling is subtle, let's add a background.
                    code.className = 'bg-body-secondary px-1 rounded border';
                    code.textContent = part.substring(1, part.length - 1);
                    p.appendChild(code);
                } else if (part) {
                    // Handle line breaks in plain text parts
                    const lines = part.split('\n');
                    lines.forEach((line, index) => {
                        p.appendChild(document.createTextNode(line));
                        if (index < lines.length - 1) {
                            p.appendChild(document.createElement('br'));
                        }
                    });
                }
            });
            fragment.appendChild(p);
        };

        while ((match = blockRegex.exec(content)) !== null) {
            console.log('Found a block match:', match);
            // Render text before the block
            const preBlockText = content.substring(lastIndex, match.index).trim();
            renderText(preBlockText);

            const tagName = match[1];
            const tagParam = match[2]; // e.g., 'sql' in [CODE=sql]
            const blockContent = match[3];

            if (tagName === 'TABLE') {
                console.log('Content of table block:', blockContent);
                const parsedTable = parseTableData(blockContent);

                if (parsedTable) {
                    console.log('Table parsed successfully. Creating table element.', parsedTable);
                    const table = document.createElement('table');
                    table.className = 'table table-bordered table-striped';

                    const thead = table.createTHead();
                    const headerRow = thead.insertRow();
                    for (const headerText of parsedTable.headers) {
                        const th = document.createElement('th');
                        th.scope = 'col';
                        th.textContent = headerText;
                        headerRow.appendChild(th);
                    }

                    const tbody = table.createTBody();
                    for (const rowData of parsedTable.rows) {
                        const row = tbody.insertRow();
                        for (const cellData of rowData) {
                            const cell = row.insertCell();
                            cell.textContent = cellData;
                        }
                    }
                    fragment.appendChild(table);
                } else {
                    console.error('Table parsing failed. Rendering as error block.');
                    const pre = document.createElement('pre');
                    pre.className = 'bg-light p-2 border rounded';
                    const code = document.createElement('code');
                    code.className = 'text-danger';
                    code.textContent = `Could not parse table block:\n${match[0]}`;
                    pre.appendChild(code);
                    fragment.appendChild(pre);
                }
            } else if (tagName === 'CODE') {
                console.log('Content of code block:', blockContent);
                const pre = document.createElement('pre');
                // Removed bg-dark and text-light, Prism's theme will handle it.
                // Kept padding and borders for consistent block styling.
                pre.className = 'p-3 border rounded';
                const code = document.createElement('code');
                
                let codeText = blockContent.trim();

                if (tagParam) {
                    const lang = tagParam.toLowerCase();
                    code.className = `language-${lang}`;
                    // User request: if lang is sql and content starts with 'sql ', trim it.
                    if (lang === 'sql' && codeText.toLowerCase().startsWith('sql ')) {
                        const match = codeText.match(/^sql\s+/i);
                        if (match) {
                            codeText = codeText.substring(match[0].length);
                        }
                    }
                }
                
                // Use textContent to prevent any HTML from being rendered
                code.textContent = codeText;
                pre.appendChild(code);
                fragment.appendChild(pre);
            } else {
                 console.warn(`Unknown block type "${tagName}". Rendering as plain text.`);
                 const pre = document.createElement('pre');
                 pre.className = 'bg-light p-2 border rounded';
                 const code = document.createElement('code');
                 code.className = 'text-warning';
                 code.textContent = `Unknown block type:\n${match[0]}`;
                 pre.appendChild(code);
                 fragment.appendChild(pre);
            }
            lastIndex = blockRegex.lastIndex;
        }

        // Render any remaining text after the last block
        const remainingText = content.substring(lastIndex).trim();
        renderText(remainingText);
        
        console.log(`%c--- Finished Rendering Content for ${targetElement.id} ---`, 'color: green; font-weight: bold;');
        targetElement.appendChild(fragment);

        // Manually trigger Prism highlighting on the new elements.
        // The autoloader will fetch the language definition if needed.
        if (window.Prism) {
            targetElement.querySelectorAll('pre code[class*="language-"]').forEach(el => {
                Prism.highlightElement(el);
            });
        }
    }
    
    // --- Study Flow Logic ---

    function shuffleArray(array) {
        console.log('Shuffling array. Original:', [...array]);
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        console.log('Shuffled array. New:', array);
    }

    function loadCard(cardIndex) {
        console.log(`%c--- Loading Card ${cardIndex + 1}/${cards.length} ---`, 'color: purple; font-weight: bold;');
        if (cardIndex >= cards.length) {
            // End of session
            console.log('Session complete. All cards reviewed.');
            studyAreaEl.classList.add('d-none');
            document.getElementById('controls').classList.add('d-none');
            sessionCompleteEl.classList.remove('d-none');
            return;
        }

        isBackVisible = false;
        const card = cards[cardIndex];
        console.log('Current card object:', card);

        renderContent(card.front_content, frontContentEl);
        renderContent(card.back_content, backContentEl);

        // Reset UI for the new card
        backCardEl.classList.add('d-none');
        frontCardEl.classList.remove('d-none');
        
        ratingButtonsEl.classList.add('d-none');
        // Re-enable buttons for the next card, as they are disabled on click.
        ratingButtonsEl.querySelectorAll('button').forEach(b => b.disabled = false);
        
        actionBtn.classList.remove('d-none');
        actionBtn.disabled = false;
        
        sessionStatusEl.textContent = `Card ${cardIndex + 1}/${cards.length}`;
        console.log('Card UI reset and ready.');
    }

    // This function now ONLY reveals the answer
    function handleActionClick() {
        console.log('Action button clicked (Reveal Answer).');
        if (isBackVisible) {
            console.warn('Action button clicked, but back is already visible. Doing nothing.');
            return; // Should not be clickable again
        }

        // Reveal the back
        backCardEl.classList.remove('d-none');
        isBackVisible = true;
        console.log('Back of card revealed.');

        // Switch controls from "Reveal" to "Ratings"
        actionBtn.classList.add('d-none');
        ratingButtonsEl.classList.remove('d-none');
        console.log('Rating buttons displayed.');
    }

    // New function to handle submitting the SRS rating
    async function handleRatingClick(rating) {
        const card = cards[currentCardIndex];
        console.log(`Rating button clicked: '${rating}'. Submitting review for card ID: ${card.id}`);
        if (!card) {
            console.error('handleRatingClick called but no current card found.');
            return;
        }

        // Disable buttons to prevent double-clicking while waiting for API
        ratingButtonsEl.querySelectorAll('button').forEach(b => b.disabled = true);
        console.log('Rating buttons disabled to prevent double-clicks.');

        try {
            const payload = {
                card_id: card.id,
                rating: rating
            };
            console.log('Sending review to /api/cards/review with payload:', payload);
            const response = await fetch(`${API_BASE_URL}/api/cards/review`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
            console.log('Received response from /api/cards/review:', response);

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Server returned an error:', errorData);
                throw new Error(errorData.error || `Server responded with status ${response.status}`);
            }
            const result = await response.json();
            console.log('Review submitted successfully. Server response:', result);

            // Success, advance to the next card
            currentCardIndex++;
            loadCard(currentCardIndex);

        } catch (error) {
            console.error('Failed to submit card review:', error);
            errorMessageEl.textContent = `Error submitting review: ${error.message}`;
            errorMessageEl.classList.remove('d-none');
            // Re-enable buttons on error so user can try again
            console.log('Re-enabling rating buttons after error.');
            ratingButtonsEl.querySelectorAll('button').forEach(b => b.disabled = false);
        }
    }
    
    async function initializeStudySession() {
        console.log('Initializing study session...');
        const params = new URLSearchParams(window.location.search);
        const deckId = params.get('deck');
        console.log('Deck ID from URL:', deckId);

        if (!deckId) {
            console.error('No deck ID found in URL.');
            errorMessageEl.innerHTML = 'No deck selected. Please <a href="index.html">go back</a> and choose a deck.';
            errorMessageEl.classList.remove('d-none');
            studyAreaEl.classList.add('d-none');
            document.getElementById('controls').classList.add('d-none');
            deckTitleEl.textContent = 'Error';
            return;
        }

        try {
            // Get deck name first
            console.log('Fetching all decks to find the name...');
            const deckInfoResponse = await fetch(`${API_BASE_URL}/api/decks`);
            if(!deckInfoResponse.ok) throw new Error('Could not fetch deck info');
            const allDecks = await deckInfoResponse.json();
            console.log('Fetched all decks:', allDecks);
            const currentDeck = allDecks.find(d => d.id == deckId);
            const deckName = currentDeck ? currentDeck.name : 'Study Session';
            deckTitleEl.textContent = deckName;
            console.log('Set deck title to:', deckName);

            // Then get the due cards for that deck
            console.log(`Fetching due cards for deck ID ${deckId}...`);
            const response = await fetch(`${API_BASE_URL}/api/decks/${deckId}/cards`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            cards = await response.json();
            console.log(`Found ${cards.length} due cards:`, cards);
            
            if (!cards || cards.length === 0) {
                 // This is not an error, it's a valid state when no cards are due.
                 console.log('No cards due for this deck. Displaying "All Caught Up" message.');
                 sessionCompleteEl.querySelector('h2').textContent = '✨ All Caught Up! ✨';
                 sessionCompleteEl.querySelector('p').textContent = 'There are no cards due for review in this deck right now. Great job!';
                 sessionCompleteEl.classList.remove('d-none');
                 studyAreaEl.classList.add('d-none');
                 document.getElementById('controls').classList.add('d-none');
                 return;
            }

            shuffleArray(cards);
            currentCardIndex = 0;
            loadCard(currentCardIndex);
            
            // Setup event listeners for the new flow
            console.log('Setting up event listeners for action and rating buttons.');
            actionBtn.addEventListener('click', handleActionClick);
            ratingButtonsEl.querySelectorAll('button').forEach(button => {
                button.addEventListener('click', () => {
                    const rating = button.dataset.rating;
                    handleRatingClick(rating);
                });
            });
            console.log('Study session initialization complete.');

        } catch (error) {
            console.error('Failed to initialize study session:', error);
            errorMessageEl.textContent = 'Could not load the deck. Please ensure the backend is running and the deck ID is valid.';
            errorMessageEl.classList.remove('d-none');
            studyAreaEl.classList.add('d-none');
            document.getElementById('controls').classList.add('d-none');
            deckTitleEl.textContent = 'Error Loading Deck';
        }
    }

    initializeStudySession();
});