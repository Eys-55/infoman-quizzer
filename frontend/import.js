document.addEventListener('DOMContentLoaded', () => {
    const importForm = document.getElementById('import-form');
    const importBtn = document.getElementById('import-btn');
    const deckContentEl = document.getElementById('deck-content');
    const alertContainer = document.getElementById('alert-container');
    
    const API_BASE_URL = 'http://127.0.0.1:5000';

    function showAlert(message, type = 'danger') {
        alertContainer.innerHTML = `
            <div class="alert alert-${type} alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
    }

    async function handleImport(event) {
        event.preventDefault(); // Prevent default form submission
        console.log('handleImport triggered.');
        
        const content = deckContentEl.value.trim();
        if (!content) {
            showAlert('Deck content cannot be empty.');
            console.error('Import aborted: content is empty.');
            return;
        }
        console.log('Raw content from textarea:', content);

        // Client-side validation
        try {
            JSON.parse(content);
            console.log('JSON content is valid.');
        } catch (e) {
            showAlert(`<strong>Invalid JSON:</strong> ${e.message}`);
            console.error('Import aborted: Invalid JSON.', e);
            return;
        }

        // Disable button and show spinner
        importBtn.disabled = true;
        importBtn.querySelector('.spinner-border').classList.remove('d-none');
        console.log('Submitting content to /api/import...');

        try {
            const response = await fetch(`${API_BASE_URL}/api/import`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: content, // Send the raw JSON string
            });
            console.log('Received response from /api/import:', response);

            const result = await response.json();
            console.log('Parsed result from server:', result);

            if (!response.ok) {
                // Handle 4xx, 5xx errors from the server
                throw new Error(result.error || `HTTP error! status: ${response.status}`);
            }

            // Success!
            const successMsg = `Successfully imported deck '<strong>${result.deck_name}</strong>' with ${result.card_count} cards. You will be redirected shortly.`;
            showAlert(successMsg, 'success');
            console.log('Import successful:', result);
            deckContentEl.value = ''; // Clear textarea

            setTimeout(() => {
                console.log('Redirecting to homepage.');
                window.location.href = '/'; // Redirect to home page
            }, 3000);

        } catch (error) {
            console.error('Import failed:', error);
            showAlert(`<strong>Import Failed:</strong> ${error.message}`);
        } finally {
            // Re-enable button and hide spinner
            importBtn.disabled = false;
            importBtn.querySelector('.spinner-border').classList.add('d-none');
            console.log('Import process finished, button re-enabled.');
        }
    }

    importForm.addEventListener('submit', handleImport);
});