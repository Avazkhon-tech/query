const HISTORY_KEY = 'query_history';
const MAX_DAYS = 7;

window.saveToHistory = function (query) {
    if (!query) return;

    let history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');

    // Cleanup old items (older than 7 days)
    const now = Date.now();
    const expiry = MAX_DAYS * 24 * 60 * 60 * 1000;
    history = history.filter(item => (now - item.timestamp) < expiry);

    // Add new query
    // Avoid consecutive duplicates
    if (history.length > 0 && history[0].query === query) {
        history[0].timestamp = now; // update timestamp of the latest identical query
    } else {
        history.unshift({ query, timestamp: now });
    }

    // Keep only last 50 items for performance
    if (history.length > 50) history = history.slice(0, 50);

    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    renderHistory();
};

window.getHistory = function () {
    let history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    const now = Date.now();
    const expiry = MAX_DAYS * 24 * 60 * 60 * 1000;

    // Filter out old items on retrieval too
    return history.filter(item => (now - item.timestamp) < expiry);
};

window.renderHistory = function () {
    const historyList = document.getElementById('history-list');
    if (!historyList) return;

    const history = getHistory();
    historyList.innerHTML = '';

    if (history.length === 0) {
        historyList.innerHTML = '<li class="empty-msg">No history yet (last 7 days)</li>';
        return;
    }

    history.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'history-item';

        const date = new Date(item.timestamp);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });

        li.innerHTML = `
            <div class="history-query-text">${escapeHtml(item.query)}</div>
            <div class="history-meta">${dateStr}, ${timeStr}</div>
        `;

        li.addEventListener('mouseenter', () => showHistoryPreview(item.query, li));
        li.addEventListener('mouseleave', closeHistoryPreview);

        li.onclick = () => {
            const editor = document.getElementById('editor');
            if (editor) {
                editor.innerText = item.query;
                window.runQuery();
            }
        };

        historyList.appendChild(li);
    });
};

window.clearHistory = function () {
    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
};

function showHistoryPreview(query, anchor) {
    closeHistoryPreview();

    const popup = document.createElement('div');
    popup.id = 'history-preview-popup';
    popup.className = 'history-preview-popup';
    popup.innerHTML = `<pre class="history-preview-sql">${escapeHtml(query)}</pre>`;

    document.body.appendChild(popup);

    const rect = anchor.getBoundingClientRect();
    const popupW = 300;
    let left = rect.left - popupW - 6;
    if (left < 8) left = rect.right + 6;
    let top = rect.top;
    const maxTop = window.innerHeight - popup.offsetHeight - 8;
    if (top > maxTop) top = maxTop;
    popup.style.left = left + 'px';
    popup.style.top  = top + 'px';
}

function closeHistoryPreview() {
    const existing = document.getElementById('history-preview-popup');
    if (existing) existing.remove();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
