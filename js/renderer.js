let pendingEdits = new Map(); // rowIndex -> { original: {}, changes: {} }

function renderResult() {
    if (!lastResultData) return;

    const resultPre = document.getElementById('result');
    const tableDiv = document.getElementById('table-result');
    const copyBtn = document.getElementById('copy-btn');
    const countDiv = document.getElementById('result-count');

    if (lastResultData) {
        copyBtn.classList.remove('hidden');
        document.getElementById('download-btn').classList.remove('hidden');
        document.getElementById('filename-input').classList.remove('hidden');
        if (Array.isArray(lastResultData)) {
            countDiv.textContent = `${lastResultData.length} rows`;
            countDiv.classList.remove('hidden');
        } else {
            countDiv.classList.add('hidden');
        }
    }

    if (currentView === 'json') {
        resultPre.style.display = 'block';
        tableDiv.classList.add('hidden');
        resultPre.innerHTML = syntaxHighlight(JSON.stringify(lastResultData, null, 2));
    } else {
        resultPre.style.display = 'none';
        tableDiv.classList.remove('hidden');
        renderTable(lastResultData, tableDiv);
    }
}

function renderTable(data, container) {
    pendingEdits.clear();
    updateCommitBar();
    container.innerHTML = '';

    if (!Array.isArray(data) || data.length === 0) {
        container.innerHTML = '<div style="padding:12px">No data or not a table result</div>';
        return;
    }

    const headers = Object.keys(data[0]);
    if (!headers.length) {
        container.innerHTML = '<div style="padding:12px">Empty rows</div>';
        return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'table-responsive';

    const table = document.createElement('table');
    table.className = 'table table-dark table-striped table-bordered table-hover table-sm mb-0';

    const thead = document.createElement('thead');
    const trHead = document.createElement('tr');

    headers.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        trHead.appendChild(th);
    });
    thead.appendChild(trHead);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    data.forEach((row, rowIndex) => {
        const tr = document.createElement('tr');
        headers.forEach(h => {
            const td = document.createElement('td');
            const val = row[h];
            td.dataset.col = h;

            if (typeof val === 'boolean') {
                const badge = makeBoolBadge(val);
                td.appendChild(badge);
                badge.addEventListener('click', e => {
                    e.stopPropagation();
                    toggleBoolCell(td, badge, rowIndex, row, h);
                });
            } else {
                td.textContent = (val === null) ? 'NULL' : (typeof val === 'object' ? JSON.stringify(val) : val);
                if (val === null) {
                    td.style.color = '#ce916a';
                    td.style.fontStyle = 'italic';
                }
            }
            tr.appendChild(td);
        });
        tr.addEventListener('dblclick', () => enterEditMode(tr, rowIndex, row));
        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    wrapper.appendChild(table);
    container.appendChild(wrapper);
}

function makeBoolBadge(val) {
    const span = document.createElement('span');
    span.className = `bool-badge bool-${val}`;
    span.textContent = val ? 'true' : 'false';
    return span;
}

function toggleBoolCell(td, badge, rowIndex, originalRow, col) {
    const origVal = originalRow[col]; // original boolean
    const current = badge.classList.contains('bool-true');
    const newVal = !current;

    badge.className = `bool-badge bool-${newVal}`;
    badge.textContent = newVal ? 'true' : 'false';

    if (newVal !== origVal) {
        if (!pendingEdits.has(rowIndex)) {
            pendingEdits.set(rowIndex, { original: originalRow, changes: {} });
        }
        pendingEdits.get(rowIndex).changes[col] = String(newVal);
        td.classList.add('cell-modified');
    } else {
        td.classList.remove('cell-modified');
        if (pendingEdits.has(rowIndex)) {
            delete pendingEdits.get(rowIndex).changes[col];
            if (!Object.keys(pendingEdits.get(rowIndex).changes).length) {
                pendingEdits.delete(rowIndex);
            }
        }
    }

    updateCommitBar();
}

function enterEditMode(tr, rowIndex, originalRow) {
    if (tr.classList.contains('row-editing')) return;
    tr.classList.add('row-editing');

    const tds = [...tr.querySelectorAll('td')];

    tds.forEach((td, tdIndex) => {
        const col = td.dataset.col;
        const origVal = originalRow[col];

        // Boolean cells are already toggleable — skip contenteditable
        if (typeof origVal === 'boolean') return;

        const displayText = origVal === null ? '' : (typeof origVal === 'object' ? JSON.stringify(origVal) : String(origVal));

        td.textContent = displayText;
        td.contentEditable = 'true';
        td.classList.add('cell-editable');
        td.style.color = '';
        td.style.fontStyle = '';

        td.addEventListener('paste', e => {
            e.preventDefault();
            document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
        });

        td.addEventListener('input', () => {
            const newVal = td.textContent;
            if (newVal !== displayText) {
                if (!pendingEdits.has(rowIndex)) {
                    pendingEdits.set(rowIndex, { original: originalRow, changes: {} });
                }
                pendingEdits.get(rowIndex).changes[col] = newVal;
                td.classList.add('cell-modified');
            } else {
                td.classList.remove('cell-modified');
                if (pendingEdits.has(rowIndex)) {
                    delete pendingEdits.get(rowIndex).changes[col];
                    if (!Object.keys(pendingEdits.get(rowIndex).changes).length) {
                        pendingEdits.delete(rowIndex);
                    }
                }
            }
            updateCommitBar();
        });

        td.addEventListener('keydown', e => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const next = e.shiftKey ? tds[tdIndex - 1] : tds[tdIndex + 1];
                if (next) next.focus();
            }
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                window.commitChanges();
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                td.textContent = displayText;
                td.classList.remove('cell-modified');
                if (pendingEdits.has(rowIndex)) {
                    delete pendingEdits.get(rowIndex).changes[col];
                    if (!Object.keys(pendingEdits.get(rowIndex).changes).length) {
                        pendingEdits.delete(rowIndex);
                    }
                }
                updateCommitBar();
            }
        });
    });

    tds[0]?.focus();
}

function updateCommitBar() {
    const hasChanges = pendingEdits.size > 0;
    let bar = document.getElementById('edit-commit-bar');

    if (!hasChanges) {
        if (bar) bar.remove();
        return;
    }

    const totalChanges = [...pendingEdits.values()].reduce((s, e) => s + Object.keys(e.changes).length, 0);

    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'edit-commit-bar';
        bar.className = 'edit-commit-bar';
        bar.innerHTML = `
            <span id="commit-info-text"></span>
            <div class="commit-actions">
                <button class="commit-revert-btn" onclick="revertAllChanges()">Revert All</button>
                <button class="commit-submit-btn" id="commit-submit-btn" onclick="commitChanges()">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    Commit
                </button>
            </div>`;
        const resultBody = document.querySelector('.result-body');
        if (resultBody) resultBody.before(bar);
    }

    document.getElementById('commit-info-text').textContent =
        `${pendingEdits.size} row(s) · ${totalChanges} change(s) pending`;
}

window.commitChanges = async function () {
    if (!pendingEdits.size) return;
    let tableName = extractTableName();
    if (!tableName) {
        tableName = prompt('Could not detect table name from query. Enter table name to UPDATE:');
        if (!tableName) return;
    }
    await executeCommit(tableName.trim());
};

async function executeCommit(tableName) {
    const sqls = buildUpdateStatements(tableName);
    if (!sqls.length) return;

    const btn = document.getElementById('commit-submit-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Committing…'; }

    const token = localStorage.getItem('jwt');
    const url = apiUrl();
    const payloadKey = getQueryKey(url);
    let successCount = 0;
    const errors = [];

    for (const sql of sqls) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ [payloadKey]: sql })
            });
            const text = await res.text();
            if (res.ok || text.toLowerCase().includes('no result')) {
                successCount++;
            } else {
                errors.push(`HTTP ${res.status}: ${text}`);
            }
        } catch (e) {
            errors.push(e.message);
        }
    }

    if (errors.length) {
        alert(`${successCount} succeeded, ${errors.length} failed:\n${errors.slice(0, 5).join('\n')}`);
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Commit';
        }
    } else {
        pendingEdits.clear();
        await window.runQuery();
    }
}

window.revertAllChanges = function () {
    pendingEdits.clear();
    window.runQuery();
};

function extractTableName() {
    const q = window.cmEditor ? window.cmEditor.getValue().trim() : '';
    const m = q.match(/\bFROM\s+["'`]?(\w+)["'`]?/i);
    return m ? m[1] : null;
}

function formatSqlValue(newVal, origVal) {
    if (newVal.trim() === '' || newVal.trim() === 'NULL') return 'NULL';
    if (typeof origVal === 'number') {
        const n = Number(newVal);
        return isNaN(n) ? `'${newVal.replace(/'/g, "''")}'` : String(n);
    }
    if (typeof origVal === 'boolean') return /^true$/i.test(newVal.trim()) ? 'true' : 'false';
    return `'${newVal.replace(/'/g, "''")}'`;
}

function buildUpdateStatements(tableName) {
    const statements = [];
    pendingEdits.forEach(({ original, changes }) => {
        if (!Object.keys(changes).length) return;
        const setClauses = Object.entries(changes)
            .map(([col, val]) => `${col} = ${formatSqlValue(val, original[col])}`)
            .join(', ');
        let whereClause;
        if (original.id != null) {
            whereClause = `id = ${formatSqlValue(String(original.id), original.id)}`;
        } else {
            whereClause = Object.entries(original)
                .map(([col, val]) => val === null ? `${col} IS NULL` : `${col} = ${formatSqlValue(String(val), val)}`)
                .join(' AND ');
        }
        statements.push(`UPDATE ${tableName} SET ${setClauses} WHERE ${whereClause};`);
    });
    return statements;
}

function syntaxHighlight(json) {
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(
        /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
        match => {
            let cls = 'number';
            if (/^"/.test(match)) cls = /:$/.test(match) ? 'key' : 'string';
            else if (/true|false/.test(match)) cls = 'boolean';
            else if (/null/.test(match)) cls = 'null';
            return `<span class="${cls}">${match}</span>`;
        }
    );
}
