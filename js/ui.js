window.toggleResultFullscreen = function () {
    const container = document.getElementById('result-container');
    const isFs = container.classList.toggle('fullscreen');
    document.getElementById('fs-expand').style.display   = isFs ? 'none' : '';
    document.getElementById('fs-compress').style.display = isFs ? '' : 'none';
};

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
    if (window.cmEditor) window.cmEditor.setValue(q);
    window.runQuery();
}

window.addEventListener("DOMContentLoaded", () => {
    // Theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);

    document.getElementById('theme-toggle').addEventListener('click', () => {
        const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        localStorage.setItem('theme', next);
    });

    function applyTheme(theme) {
        document.documentElement.dataset.theme = theme;
        document.getElementById('icon-moon').style.display = theme === 'dark' ? 'none' : '';
        document.getElementById('icon-sun').style.display  = theme === 'dark' ? '' : 'none';
        if (window.cmEditor) window.cmEditor.setOption('theme', theme === 'dark' ? 'query-dark' : 'query-light');
    }

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

    // Panel resize — left sidebar
    (function () {
        const handle = document.getElementById('resize-left');
        const sidebar = document.querySelector('.sidebar');
        const MIN = 160, MAX = 520;
        let dragging = false, startX, startW;

        handle.addEventListener('mousedown', e => {
            if (sidebar.classList.contains('closed')) return;
            dragging = true;
            startX = e.clientX;
            startW = sidebar.getBoundingClientRect().width;
            handle.classList.add('dragging');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', e => {
            if (!dragging) return;
            const w = Math.min(MAX, Math.max(MIN, startW + (e.clientX - startX)));
            sidebar.style.width = w + 'px';
            // keep closed offset in sync
            const style = document.getElementById('sidebar-closed-style') || (() => {
                const s = document.createElement('style');
                s.id = 'sidebar-closed-style';
                document.head.appendChild(s);
                return s;
            })();
            style.textContent = `.sidebar.closed { margin-left: -${w}px !important; }`;
        });

        document.addEventListener('mouseup', () => {
            if (!dragging) return;
            dragging = false;
            handle.classList.remove('dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        });
    })();

    // Panel resize — right sidebar
    (function () {
        const handle = document.getElementById('resize-right');
        const sidebar = document.querySelector('.sidebar-right');
        const MIN = 160, MAX = 520;
        let dragging = false, startX, startW;

        handle.addEventListener('mousedown', e => {
            if (sidebar.classList.contains('closed')) return;
            dragging = true;
            startX = e.clientX;
            startW = sidebar.getBoundingClientRect().width;
            handle.classList.add('dragging');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', e => {
            if (!dragging) return;
            const w = Math.min(MAX, Math.max(MIN, startW - (e.clientX - startX)));
            sidebar.style.width = w + 'px';
            const style = document.getElementById('sidebar-right-closed-style') || (() => {
                const s = document.createElement('style');
                s.id = 'sidebar-right-closed-style';
                document.head.appendChild(s);
                return s;
            })();
            style.textContent = `.sidebar-right.closed { margin-right: -${w}px !important; }`;
        });

        document.addEventListener('mouseup', () => {
            if (!dragging) return;
            dragging = false;
            handle.classList.remove('dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        });
    })();

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
        if (newHeight > 50 && window.cmEditor) window.cmEditor.setSize(null, newHeight);
    });
    document.addEventListener('mouseup', () => isResizing = false);

    // Global Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
        // Commit pending edits: Ctrl + Enter (when commit bar is visible)
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            if (document.getElementById('edit-commit-bar')) {
                e.preventDefault();
                window.commitChanges();
                return;
            }
        }

        // Exit fullscreen: Escape
        if (e.key === 'Escape') {
            const container = document.getElementById('result-container');
            if (container && container.classList.contains('fullscreen')) {
                window.toggleResultFullscreen();
                return;
            }
        }

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
            if (window.cmEditor) {
                window.cmEditor.focus();
                const last = window.cmEditor.lastLine();
                window.cmEditor.setCursor({ line: last, ch: window.cmEditor.getLine(last).length });
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
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) || document.getElementById('editor').contains(document.activeElement)) {
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
