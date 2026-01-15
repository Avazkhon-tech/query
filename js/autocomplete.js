const autocomplete = document.getElementById('autocomplete');
let activeIndex = -1;
let currentOptions = [];
let lastRange = null;

editor.addEventListener('input', updateAutocomplete);
editor.addEventListener('keydown', handleKeydown);
editor.addEventListener('click', updateRange);

function getAllDbObjects() {
    const extractName = li => li.querySelector('span') ? li.querySelector('span').textContent : li.textContent;
    const tables = [...document.querySelectorAll('#tables li')].map(extractName);
    const views = [...document.querySelectorAll('#views li')].map(extractName);
    const mviews = [...document.querySelectorAll('#mviews li')].map(extractName);
    const indexes = [...document.querySelectorAll('#indexes li')].map(extractName);
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
    const extractName = li => li.querySelector('span') ? li.querySelector('span').textContent : li.textContent;
    const tables = [...document.querySelectorAll('#tables li')].map(extractName);

    const token = localStorage.getItem('jwt');
    if (!token) return [];

    try {
        const url = apiUrl();
        const payloadKey = getQueryKey(url);

        // Escape single quotes to prevent SQL injection
        const escapedTableName = tableName.replace(/'/g, "''");
        const query = `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${escapedTableName}'`;

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ [payloadKey]: query })
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

// Store table aliases mapping
let tableAliases = {};

editor.addEventListener('input', async () => {
    const word = getCurrentWord();
    const fullText = document.getElementById('editor').innerText;

    // Update table aliases from the query
    tableAliases = parseTableAliases(fullText);

    // Check if we're typing after a dot (table.column or alias.column)
    const dotContext = getDotContext();
    if (dotContext) {
        const tableName = resolveTableName(dotContext.prefix);
        if (tableName) {
            const cols = await getColumnsForTable(tableName);
            if (cols.length) {
                const matches = dotContext.word
                    ? cols.filter(c => c.label.toLowerCase().startsWith(dotContext.word.toLowerCase()))
                    : cols;
                if (matches.length) {
                    showAutocomplete(matches);
                    return;
                }
            }
        }
        hideAutocomplete();
        return;
    }

    if (!word) {
        hideAutocomplete();
        return;
    }

    const lastWord = getLastWordBeforeCurrent();
    let options = [];

    if (["FROM", "JOIN"].includes(lastWord.toUpperCase())) {
        options = getAllDbObjects();
    } else if (["WHERE", "AND", "OR"].includes(lastWord.toUpperCase())) {
        // After WHERE/AND/OR, suggest table names/aliases AND keywords
        const tableAndAliasNames = Object.keys(tableAliases);
        options = [...tableAndAliasNames, ...sqlKeywords];
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

// Parse table aliases from SQL query (e.g., "FROM visits v" -> {v: "visits"})
function parseTableAliases(sql) {
    const aliases = {};

    // Match patterns like: FROM table_name alias, JOIN table_name alias
    const pattern = /(?:FROM|JOIN)\s+(\w+)(?:\s+(?:AS\s+)?(\w+))?/gi;
    let match;

    while ((match = pattern.exec(sql)) !== null) {
        const tableName = match[1];
        const alias = match[2];

        if (alias && alias.toUpperCase() !== 'ON' && alias.toUpperCase() !== 'WHERE') {
            aliases[alias.toLowerCase()] = tableName.toLowerCase();
        }
        // Also map table name to itself
        aliases[tableName.toLowerCase()] = tableName.toLowerCase();
    }

    return aliases;
}

// Get context when typing after a dot
function getDotContext() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return null;

    const range = selection.getRangeAt(0);
    const text = range.startContainer.textContent.slice(0, range.startOffset);

    // Match pattern: word.word or word. (e.g., "v." or "v.col")
    const match = text.match(/(\w+)\.(\w*)$/);
    if (match) {
        return {
            prefix: match[1],  // table name or alias before dot
            word: match[2]     // partial column name after dot
        };
    }

    return null;
}

// Resolve table name from alias or return the name itself
function resolveTableName(nameOrAlias) {
    const lower = nameOrAlias.toLowerCase();
    return tableAliases[lower] || nameOrAlias;
}


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

    // Check if we're completing after a dot (e.g., "v.col")
    const dotMatch = before.match(/(\w+)\.(\w*)$/);
    let start;

    if (dotMatch) {
        // Only replace the part after the dot
        start = offset - dotMatch[2].length;
    } else {
        // Normal word completion
        const match = before.match(/(\w+)$/);
        start = match ? offset - match[1].length : offset;
    }

    range.setStart(node, start);
    range.setEnd(node, offset);
    range.deleteContents();

    // Determine if we should add a space after the word
    // Don't add space after table names (user will type space or alias)
    // Add space for keywords and columns
    const fullText = document.getElementById('editor').innerText;
    const beforeCursor = fullText.substring(0, fullText.lastIndexOf(before) + before.length - (offset - start));
    const lastWords = beforeCursor.trim().split(/\s+/).slice(-2);
    const isTableName = lastWords.length > 0 && ['FROM', 'JOIN'].includes(lastWords[lastWords.length - 1].toUpperCase());

    const insert = document.createTextNode(isTableName ? word : word + " ");
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
    [...autocomplete.children].forEach((li, i) => {
        const isActive = i === activeIndex;
        li.classList.toggle('active', isActive);

        // Scroll the active item into view
        if (isActive) {
            li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    });
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
