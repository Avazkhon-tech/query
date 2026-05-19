let pendingEdits = new Map(); // rowIndex -> { original: {}, changes: {} }
let activeDatePicker = null;

const DATE_COL_RE = /date|time|stamp|created|modified|updated|deleted|published|expires?|birth|start|end|at$/i;
const DATE_STRING_RE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?/;

function parseDateStr(str) {
    const m = String(str).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?/);
    if (!m) return null;
    return {
        year: parseInt(m[1]),
        month: parseInt(m[2]),
        day: parseInt(m[3]),
        hour: m[4] != null ? parseInt(m[4]) : 0,
        min: m[5] != null ? parseInt(m[5]) : 0,
        sec: m[6] != null ? parseInt(m[6]) : 0,
        frac: m[7] || null,
        hasTime: m[4] != null,
    };
}

function showDatePicker(td, rowIndex, originalRow, col) {
    if (activeDatePicker) {
        activeDatePicker.remove();
        activeDatePicker = null;
    }

    const rawVal = originalRow[col];
    const displayText = td.textContent;
    const parsed = parseDateStr(typeof rawVal === 'number' ? displayText : rawVal);
    if (!parsed) return;

    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const pad = n => String(n).padStart(2, '0');

    const popup = document.createElement('div');
    popup.className = 'date-picker-popup';

    const daySelect = document.createElement('select');
    daySelect.className = 'dp-sel dp-day';
    for (let d = 1; d <= 31; d++) {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        if (d === parsed.day) opt.selected = true;
        daySelect.appendChild(opt);
    }

    const monthSelect = document.createElement('select');
    monthSelect.className = 'dp-sel dp-month';
    MONTHS.forEach((name, i) => {
        const opt = document.createElement('option');
        opt.value = i + 1;
        opt.textContent = name;
        if (i + 1 === parsed.month) opt.selected = true;
        monthSelect.appendChild(opt);
    });

    const yearInput = document.createElement('input');
    yearInput.type = 'number';
    yearInput.className = 'dp-num dp-year';
    yearInput.value = parsed.year;
    yearInput.min = 1900;
    yearInput.max = 2100;

    const dateRow = document.createElement('div');
    dateRow.className = 'dp-row';
    dateRow.append(daySelect, monthSelect, yearInput);
    popup.appendChild(dateRow);

    if (parsed.hasTime) {
        const hourInput = document.createElement('input');
        hourInput.type = 'number';
        hourInput.className = 'dp-num dp-time';
        hourInput.value = parsed.hour;
        hourInput.min = 0; hourInput.max = 23;

        const minInput = document.createElement('input');
        minInput.type = 'number';
        minInput.className = 'dp-num dp-time';
        minInput.value = parsed.min;
        minInput.min = 0; minInput.max = 59;

        const secInput = document.createElement('input');
        secInput.type = 'number';
        secInput.className = 'dp-num dp-time';
        secInput.value = parsed.sec;
        secInput.min = 0; secInput.max = 59;

        const timeRow = document.createElement('div');
        timeRow.className = 'dp-row';
        const s1 = document.createElement('span'); s1.className = 'dp-sep'; s1.textContent = ':';
        const s2 = document.createElement('span'); s2.className = 'dp-sep'; s2.textContent = ':';
        timeRow.append(hourInput, s1, minInput, s2, secInput);
        popup.appendChild(timeRow);

        [daySelect, monthSelect, yearInput, hourInput, minInput, secInput].forEach(el => el.addEventListener('input', sync));
        popup._inputs = { daySelect, monthSelect, yearInput, hourInput, minInput, secInput };
    } else {
        [daySelect, monthSelect, yearInput].forEach(el => el.addEventListener('input', sync));
        popup._inputs = { daySelect, monthSelect, yearInput };
    }

    document.body.appendChild(popup);
    activeDatePicker = popup;

    const rect = td.getBoundingClientRect();
    popup.style.top = (rect.bottom + 4) + 'px';
    popup.style.left = rect.left + 'px';
    requestAnimationFrame(() => {
        const pw = popup.offsetWidth;
        if (rect.left + pw > window.innerWidth - 8) {
            popup.style.left = Math.max(8, window.innerWidth - pw - 8) + 'px';
        }
    });

    function sync() {
        const { daySelect, monthSelect, yearInput, hourInput, minInput, secInput } = popup._inputs;
        const y = String(yearInput.value).padStart(4, '0');
        const mo = pad(monthSelect.value);
        const d = pad(daySelect.value);
        let newVal;
        if (parsed.hasTime) {
            const h = pad(hourInput.value);
            const mi = pad(minInput.value);
            const s = pad(secInput.value);
            const frac = parsed.frac ? '.' + parsed.frac : '';
            newVal = `${y}-${mo}-${d} ${h}:${mi}:${s}${frac}`;
        } else {
            newVal = `${y}-${mo}-${d}`;
        }

        td.textContent = newVal;
        if (newVal !== displayText) {
            if (!pendingEdits.has(rowIndex)) pendingEdits.set(rowIndex, { original: originalRow, changes: {} });
            pendingEdits.get(rowIndex).changes[col] = newVal;
            td.classList.add('cell-modified');
        } else {
            td.classList.remove('cell-modified');
            if (pendingEdits.has(rowIndex)) {
                delete pendingEdits.get(rowIndex).changes[col];
                if (!Object.keys(pendingEdits.get(rowIndex).changes).length) pendingEdits.delete(rowIndex);
            }
        }
        updateCommitBar();
    }

    const onOutside = e => {
        if (!popup.contains(e.target) && e.target !== td) {
            popup.remove();
            activeDatePicker = null;
            document.removeEventListener('mousedown', onOutside, true);
        }
    };
    setTimeout(() => document.addEventListener('mousedown', onOutside, true), 0);

    popup.addEventListener('keydown', e => {
        if (e.key === 'Escape') { popup.remove(); activeDatePicker = null; }
    });
}

function formatTimestamp(val, colName) {
    if (!DATE_COL_RE.test(colName)) return null;
    const num = Number(val);
    if (!Number.isInteger(num) || isNaN(num)) return null;

    let date;
    if (num > 1e12 && num < 1e14) {
        date = new Date(num);          // milliseconds
    } else if (num > 1e9 && num < 1e11) {
        date = new Date(num * 1000);   // seconds
    } else {
        return null;
    }

    if (isNaN(date.getTime())) return null;

    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} `
         + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

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
                if (val === null) {
                    td.textContent = 'NULL';
                    td.style.color = '#ce916a';
                    td.style.fontStyle = 'italic';
                } else if (typeof val === 'object') {
                    td.textContent = JSON.stringify(val);
                } else {
                    const formatted = formatTimestamp(val, h);
                    if (formatted) {
                        td.textContent = formatted;
                        td.title = String(val);
                        td.classList.add('cell-date');
                    } else if (DATE_COL_RE.test(h) && typeof val === 'string' && DATE_STRING_RE.test(val)) {
                        td.textContent = val;
                        td.classList.add('cell-date');
                    } else {
                        td.textContent = val;
                    }
                }
            }
            if (td.classList.contains('cell-date')) {
                td.style.cursor = 'pointer';
                td.addEventListener('click', e => {
                    e.stopPropagation();
                    showDatePicker(td, rowIndex, row, h);
                });
                td.addEventListener('dblclick', e => e.stopPropagation());
            }

            tr.appendChild(td);
        });
        tr.addEventListener('dblclick', (e) => enterEditMode(tr, rowIndex, row, e.target.closest('td')));
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

function enterEditMode(tr, rowIndex, originalRow, clickedTd) {
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

    const focusTd = (clickedTd && clickedTd.contentEditable === 'true')
        ? clickedTd
        : tds.find(td => td.contentEditable === 'true');
    focusTd?.focus();
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
        const resultContainer = document.querySelector('.result-container');
        if (resultContainer) resultContainer.appendChild(bar);
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
