window.toggleSection = function (header) {
    header.parentElement.classList.toggle("open");
};

window.switchView = function (view) {
    currentView = view;
    document.getElementById('btn-json').classList.toggle('active', view === 'json');
    document.getElementById('btn-table').classList.toggle('active', view === 'table');
    renderResult();
};

function insertQuery(q) {
    document.getElementById('editor').innerText = q;
    window.runQuery();
}

window.addEventListener("DOMContentLoaded", () => {
    const savedToken = localStorage.getItem('jwt');
    if (savedToken) {
        document.getElementById("token").value = savedToken;
        loadDbObjects();
    }

    renderHistory();

    document.getElementById('sidebar-toggle').addEventListener('click', () => {
        document.querySelector('.sidebar').classList.toggle('closed');
    });

    document.getElementById('sidebar-right-toggle').addEventListener('click', () => {
        document.querySelector('.sidebar-right').classList.toggle('closed');
    });

    // Search functionality
    const searchInput = document.getElementById('db-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            const allItems = document.querySelectorAll('#tables li, #views li, #mviews li, #indexes li');
            allItems.forEach(item => {
                const itemName = item.getAttribute('data-name') || item.textContent.toLowerCase();
                item.style.display = itemName.includes(searchTerm) ? '' : 'none';
            });
        });
    }

    // Editor Resize
    const editorEl = document.getElementById('editor');
    let isResizing = false;
    editorEl.addEventListener('mousedown', (e) => {
        const rect = editorEl.getBoundingClientRect();
        if (e.clientX > rect.right - 20 && e.clientY > rect.bottom - 20) {
            isResizing = true;
            e.preventDefault();
        }
    });
    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const newHeight = e.clientY - editorEl.getBoundingClientRect().top;
        if (newHeight > 50) editorEl.style.height = newHeight + 'px';
    });
    document.addEventListener('mouseup', () => isResizing = false);

    // Global Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
        // Connect: Alt + C
        if (e.altKey && e.key.toLowerCase() === 'c') {
            e.preventDefault();
            const connectBtn = document.getElementById('connectBtn');
            if (connectBtn) connectBtn.click();
        }

        // Copy: Ctrl + Shift + C
        if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'c') {
            e.preventDefault();
            const copyBtn = document.getElementById('copy-btn');
            if (copyBtn && !copyBtn.classList.contains('hidden')) {
                window.copyResult();
            }
        }

        // Download: Ctrl + S
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            const downloadBtn = document.getElementById('download-btn');
            if (downloadBtn && !downloadBtn.classList.contains('hidden')) {
                window.downloadResult();
            }
        }

        // Focus Query Console: Alt + Q
        if (e.altKey && e.key.toLowerCase() === 'q') {
            e.preventDefault();
            const editor = document.getElementById('editor');
            if (editor) {
                editor.focus();
                const range = document.createRange();
                range.selectNodeContents(editor);
                range.collapse(false);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            }
        }

        // Focus Filename: Alt + N
        if (e.altKey && e.key.toLowerCase() === 'n') {
            const filenameInput = document.getElementById('filename-input');
            if (filenameInput && !filenameInput.classList.contains('hidden')) {
                e.preventDefault();
                filenameInput.focus();
                filenameInput.select();
            }
        }

        // Paste into JWT: Alt + J
        if (e.altKey && e.key.toLowerCase() === 'j') {
            e.preventDefault();
            triggerJwtPaste();
        }
    });

    function triggerJwtPaste() {
        navigator.clipboard.readText().then(text => {
            const tokenInput = document.getElementById('token');
            if (tokenInput) {
                const cleanToken = text.trim();
                tokenInput.value = cleanToken;
                localStorage.setItem('jwt', cleanToken);
                tokenInput.classList.add('flash-success');
                setTimeout(() => tokenInput.classList.remove('flash-success'), 1000);
                window.connect();
            }
        }).catch(err => {
            console.error('Failed to read clipboard: ', err);
            // Fallback: just focus the input if clipboard access is denied
            const tokenInput = document.getElementById('token');
            if (tokenInput) tokenInput.focus();
        });
    }

    // JWT Paste Sequence Detector
    let keyBuffer = '';
    window.addEventListener('keydown', (e) => {
        // Only track if not in an input
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) || document.activeElement.id === 'editor') {
            return;
        }

        keyBuffer += e.key.toLowerCase();
        if (keyBuffer.length > 3) keyBuffer = keyBuffer.slice(-3);

        if (keyBuffer === 'jwt') {
            triggerJwtPaste();
            keyBuffer = '';
        }
    });

    // Token input focus
    const tokenInput = document.getElementById('token');
    if (tokenInput) {
        tokenInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                window.connect();
            }
        });
    }
});
