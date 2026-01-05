const autocomplete = document.getElementById('autocomplete');
let activeIndex = -1;
let currentOptions = [];
let lastRange = null;

editor.addEventListener('input', updateAutocomplete);
editor.addEventListener('keydown', handleKeydown);
editor.addEventListener('click', updateRange);

function getAllDbObjects() {
    const tables = [...document.querySelectorAll('#tables li')].map(li => li.textContent);
    const views = [...document.querySelectorAll('#views li')].map(li => li.textContent);
    const mviews = [...document.querySelectorAll('#mviews li')].map(li => li.textContent);
    const indexes = [...document.querySelectorAll('#indexes li')].map(li => li.textContent);
    return [...tables, ...views, ...mviews, ...indexes];
}

function saveRange() {
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
        lastRange = sel.getRangeAt(0);
    }
}

function showContextAutocomplete() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const preRange = range.cloneRange();
    preRange.selectNodeContents(document.getElementById('editor'));
    preRange.setEnd(range.endContainer, range.endOffset);
    const text = preRange.toString().trim();

    const words = text.split(/\s+/);
    if (!words.length) return;

    const contextKeyword = words[words.length - 1].toUpperCase();

    if (["FROM", "JOIN"].includes(contextKeyword)) {
        showAutocomplete(getAllDbObjects());
    } else if (contextKeyword === "WHERE" || contextKeyword === "AND" || contextKeyword === "OR") {
        const tableName = getTableNameForColumns();
        if (tableName) {
            getColumnsForTable(tableName).then(cols => {
                const uniqueCols = [...new Set(cols)];
                if (uniqueCols.length) {
                    showAutocomplete(uniqueCols);
                } else {
                    hideAutocomplete();
                }
            });
            return;
        }
    }

    showAutocomplete(sqlKeywords);
}

function getTableNameForColumns() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return null;

    const range = selection.getRangeAt(0);
    const text = range.startContainer.textContent.slice(0, range.startOffset);

    const rawText = document.getElementById('editor').innerText;

    const matches = [...rawText.matchAll(/(FROM|JOIN)\s+(\w+)/gi)];
    if (!matches.length) return null;

    return matches[matches.length - 1][2];
}

async function getColumnsForTable(tableName) {
    const tables = [...document.querySelectorAll('#tables li')].map(li => li.textContent);

    const token = localStorage.getItem('jwt');
    if (!token) return [];

    try {
        const base = document.getElementById('baseUrl').value;
        const url = `${base}/api/classificator/v1/query`;

        // Escape single quotes to prevent SQL injection
        const escapedTableName = tableName.replace(/'/g, "''");
        const query = `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${escapedTableName}'`;

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ query })
        });

        if (!res.ok) {
            return [];
        }

        const data = await res.json();

        if (!data || !data.length) {
            alert(`Table ${tableName} does not exist`);
            return [];
        }

        return data.map(r => ({ label: r.column_name, type: r.data_type }));

    } catch (e) {
        console.error(e);
        return [];
    }
}

editor.addEventListener('input', () => {
    const word = getCurrentWord();
    if (!word) {
        hideAutocomplete();
        return;
    }

    const lastWord = getLastWordBeforeCurrent();
    let options = [];

    if (["FROM", "JOIN"].includes(lastWord.toUpperCase())) {
        options = getAllDbObjects();
    } else {
        options = sqlKeywords;
    }

    const matches = options.filter(k => k.toLowerCase().startsWith(word.toLowerCase()));

    if (!matches.length) {
        hideAutocomplete();
        return;
    }

    showAutocomplete(matches);
});

function getCurrentWord() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return "";
    const range = selection.getRangeAt(0);
    const text = range.startContainer.textContent.slice(0, range.startOffset);
    const match = text.match(/(\w+)$/);
    return match ? match[1] : "";
}

function getLastWordBeforeCurrent() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return "";
    const range = selection.getRangeAt(0);
    const text = range.startContainer.textContent.slice(0, range.startOffset);
    const words = text.trim().split(/\s+/);
    return words.length > 1 ? words[words.length - 2] : "";
}

function showAutocomplete(options) {
    if (!options.length) return hideAutocomplete();
    currentOptions = options;
    activeIndex = 0;

    autocomplete.innerHTML = options.map((opt, i) => {
        const isActive = i === 0 ? 'active' : '';
        if (typeof opt === 'string') {
            return `<li class="${isActive}" data-value="${opt}">${opt}</li>`;
        } else {
            return `
                <li class="${isActive}" data-value="${opt.label}">
                    <span>${opt.label}</span>
                    <span style="float:right; opacity:0.5; font-size:12px;">${opt.type || ''}</span>
                </li>`;
        }
    }).join('');

    const rect = getCaretRect();
    const editorRect = document.getElementById('editor').getBoundingClientRect();

    // Calculate relative position
    let left = rect.left - editorRect.left;
    let top = rect.bottom - editorRect.top;

    // Adjust if valid
    if (rect.top !== 0 || rect.left !== 0) {
        autocomplete.style.left = left + 'px';
        autocomplete.style.top = top + 'px';
    } else if (lastRange) {
        // Fallback
        const r = lastRange.getBoundingClientRect();
        left = r.left - editorRect.left;
        top = r.bottom - editorRect.top;
        autocomplete.style.left = left + 'px';
        autocomplete.style.top = top + 'px';
    }

    autocomplete.classList.remove('hidden');
}


function getCaretRect() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return { left: 0, top: 0, bottom: 0 };
    const range = sel.getRangeAt(0).cloneRange();

    let rect = range.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) return rect;

    const span = document.createElement('span');
    span.appendChild(document.createTextNode('\u200b'));
    range.insertNode(span);
    rect = span.getBoundingClientRect();
    span.remove();
    return rect;
}

editor.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        showContextAutocomplete();
    }
});

function insertAutocomplete(word) {
    if (!lastRange) return;
    editor.focus();
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(lastRange);

    let range = lastRange;
    let node = range.startContainer;
    let offset = range.startOffset;

    if (node.nodeType !== Node.TEXT_NODE) {
        if (!node.lastChild) node.appendChild(document.createTextNode(""));
        node = node.lastChild;
        offset = node.textContent.length;
    }

    const text = node.textContent;
    const before = text.slice(0, offset);
    const match = before.match(/(\w+)$/);
    const start = match ? offset - match[1].length : offset;

    range.setStart(node, start);
    range.setEnd(node, offset);
    range.deleteContents();

    const insert = document.createTextNode(word + " ");
    range.insertNode(insert);
    range.setStartAfter(insert);
    range.collapse(true);

    selection.removeAllRanges();
    selection.addRange(range);

    hideAutocomplete();
}

function handleKeydown(e) {
    if (!autocomplete || autocomplete.classList.contains('hidden')) return;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = (activeIndex + 1) % currentOptions.length;
        updateActive();
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = (activeIndex - 1 + currentOptions.length) % currentOptions.length;
        updateActive();
    } else if (e.key === 'Enter' || e.key === 'Tab' || e.key === 'Space') {
        e.preventDefault();
        const selected = currentOptions[activeIndex];
        const value = (typeof selected === 'string') ? selected : selected.label;
        insertAutocomplete(value);
    } else if (e.key === 'Escape') {
        e.preventDefault();
        hideAutocomplete();
    }
}

editor.addEventListener('keydown', (e) => {
    const isOpen = !autocomplete.classList.contains('hidden');
    if (!isOpen) return;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = (activeIndex + 1) % currentOptions.length;
        updateActive();
        return;
    }
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = (activeIndex - 1 + currentOptions.length) % currentOptions.length;
        updateActive();
        return;
    }
    if (e.key === 'Enter' || e.key === 'Tab' || e.key === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        const selected = currentOptions[activeIndex];
        const value = (typeof selected === 'string') ? selected : selected.label;
        insertAutocomplete(value);
        return;
    }
    if (e.key === 'Escape') {
        e.preventDefault();
        hideAutocomplete();
        return;
    }
});

function updateRange() {
    const sel = window.getSelection();
    if (sel.rangeCount > 0) lastRange = sel.getRangeAt(0).cloneRange();
}

function getCurrentWord() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return "";
    const range = selection.getRangeAt(0);
    const text = range.startContainer.textContent.slice(0, range.startOffset);
    const match = text.match(/(\w+)$/);
    return match ? match[1] : "";
}

function updateAutocomplete() {
    updateRange();
    const word = getCurrentWord();
    if (!word) return hideAutocomplete();

    const matches = sqlKeywords.filter(k => k.toLowerCase().startsWith(word.toLowerCase()));
    if (!matches.length) return hideAutocomplete();

    currentOptions = matches;
    activeIndex = 0;
    autocomplete.innerHTML = matches.map((w, i) => `<li class="${i === 0 ? 'active' : ''}" data-value="${w}">${w}</li>`).join('');

    const rect = lastRange.getBoundingClientRect();
    const editorRect = document.getElementById('editor').getBoundingClientRect();

    const left = rect.left - editorRect.left;
    const top = rect.bottom - editorRect.top;

    autocomplete.style.left = left + 'px';
    autocomplete.style.top = top + 'px';
    autocomplete.classList.remove('hidden');
}

autocomplete.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const li = e.target.closest('li');
    if (li) insertAutocomplete(li.dataset.value);
});

function updateActive() {
    [...autocomplete.children].forEach((li, i) => li.classList.toggle('active', i === activeIndex));
}

function hideAutocomplete() {
    autocomplete.classList.add('hidden');
    autocomplete.innerHTML = '';
}

const sqlKeywords = "SELECT FROM WHERE INSERT UPDATE DELETE CREATE ALTER DROP TABLE INDEX VIEW DATABASE SCHEMA FUNCTION TRIGGER PROCEDURE JOIN INNER LEFT RIGHT FULL OUTER ON GROUP BY ORDER BY HAVING LIMIT OFFSET AS DISTINCT UNION ALL EXISTS IN BETWEEN LIKE IS NULL NOT AND OR CASE WHEN THEN ELSE END TRUE FALSE VALUES PRIMARY KEY FOREIGN KEY DEFAULT UNIQUE CHECK CONSTRAINT TRUNCATE GRANT REVOKE COMMIT ROLLBACK SAVEPOINT VACUUM EXPLAIN ANALYZE".split(" ");

function sqlCompletion(context) {
    let word = context.matchBefore(/\w*/);
    if (!word || (word.from === word.to && !context.explicit)) return null;

    return {
        from: word.from,
        options: sqlKeywords
            .filter(k => k.toLowerCase().startsWith(word.text.toLowerCase()))
            .map(k => ({ label: k, type: "keyword" }))
    };
}
