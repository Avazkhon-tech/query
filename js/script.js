let lastResultData = null;
let currentView = 'json';

window.connect = async function () {
    const tokenInput = document.getElementById("token").value.trim();
    if (!tokenInput) {
        alert("JWT token kiriting");
        return;
    }
    const token = tokenInput;
    localStorage.setItem("jwt", token);
    await loadDbObjects();
};

window.toggleSection = function (header) {
    header.parentElement.classList.toggle("open");
};

window.runQuery = async function () {
    const rawQuery = document.getElementById('editor').innerText;
    const cleanQuery = rawQuery.trim();
    const result = document.getElementById('result');

    if (!cleanQuery) {
        result.textContent = 'Query empty';
        return;
    }

    const safeQuery = cleanQuery.replace(/'/g, "''").replace(/\\/g, "\\\\");

    result.textContent = 'Running...';
    document.getElementById('table-result').innerHTML = '';

    try {
        const token = localStorage.getItem('jwt');
        const res = await fetch(apiUrl(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ query: safeQuery })
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

        const data = await res.json();
        lastResultData = data;
        renderResult();

    } catch (e) {
        result.textContent = 'Error: ' + e.message;
        console.error(e);
        lastResultData = null;
    }
};

window.switchView = function (view) {
    currentView = view;
    document.getElementById('btn-json').classList.toggle('active', view === 'json');
    document.getElementById('btn-table').classList.toggle('active', view === 'table');

    renderResult();
};

function renderResult() {
    if (!lastResultData) return;

    const resultPre = document.getElementById('result');
    const tableDiv = document.getElementById('table-result');

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

    // Create Bootstrap responsive wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'table-responsive';

    const table = document.createElement('table');
    table.className = 'table table-dark table-striped table-bordered table-hover table-sm mb-0';

    const thead = document.createElement('thead');
    const trHead = document.createElement('tr');

    headers.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        // th.style.whiteSpace = 'nowrap';
        trHead.appendChild(th);
    });
    thead.appendChild(trHead);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    data.forEach(row => {
        const tr = document.createElement('tr');
        headers.forEach(h => {
            const td = document.createElement('td');
            const val = row[h];
            td.textContent = (val === null) ? 'NULL' : (typeof val === 'object' ? JSON.stringify(val) : val);
            if (val === null) {
                td.style.color = '#ce916a';
                td.style.fontStyle = 'italic';
            }
            // td.style.whiteSpace = 'nowrap';
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    wrapper.appendChild(table);
    container.appendChild(wrapper);
}
function apiUrl() {
    const base = document.getElementById('baseUrl').value;
    return `${base}/api/classificator/v1/query`;
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

async function loadDbObjects() {
    const token = localStorage.getItem('jwt');
    if (!token) return;

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
    };

    try {
        const tvRes = await fetch(apiUrl(), {
            method: 'POST',
            headers,
            body: JSON.stringify({ query: "SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = 'public';" })
        });
        const tvData = await tvRes.json();

        const tables = document.getElementById('tables');
        const views = document.getElementById('views');
        tables.innerHTML = ''; views.innerHTML = '';

        tvData.forEach(r => {
            const li = document.createElement('li');
            li.textContent = r.table_name;
            li.ondblclick = () => {
                const q = `SELECT * FROM ${r.table_name} LIMIT 50;`;
                if (window.editor) insertQuery(q); else document.getElementById('editor').innerText = q;
                window.runQuery();
            };
            if (r.table_type === 'BASE TABLE') tables.appendChild(li);
            else if (r.table_type === 'VIEW') views.appendChild(li);
        });

        const mvRes = await fetch(apiUrl(), { method: 'POST', headers, body: JSON.stringify({ query: "SELECT matviewname FROM pg_matviews WHERE schemaname = 'public';" }) });
        const mvData = await mvRes.json();
        const mviews = document.getElementById('mviews');
        mviews.innerHTML = '';
        mvData.forEach(r => {
            const li = document.createElement('li');
            li.textContent = r.matviewname;
            li.ondblclick = () => {
                const q = `SELECT * FROM ${r.matviewname} LIMIT 10;`;
                if (window.editor) insertQuery(q); else document.getElementById('editor').innerText = q;
                window.runQuery();
            };
            mviews.appendChild(li);
        });

        const idxRes = await fetch(apiUrl(), { method: 'POST', headers, body: JSON.stringify({ query: "SELECT indexname FROM pg_indexes WHERE schemaname = 'public';" }) });
        const idxData = await idxRes.json();
        const indexes = document.getElementById('indexes');
        indexes.innerHTML = '';
        idxData.forEach(r => {
            const li = document.createElement('li');
            li.textContent = r.indexname;
            li.ondblclick = () => {
                const q = `-- Index info\nSELECT * FROM pg_indexes WHERE indexname = '${r.indexname}';`;
                if (window.editor) insertQuery(q); else document.getElementById('editor').innerText = q;
                window.runQuery();
            };
            indexes.appendChild(li);
        });
    } catch (e) {
        console.error('loadDbObjects error:', e);
    }
}

window.addEventListener("DOMContentLoaded", () => {

    const savedToken = localStorage.getItem('jwt');
    if (savedToken) {
        document.getElementById("token").value = savedToken;
        loadDbObjects();
    }

    document.getElementById('sidebar-toggle').addEventListener('click', () => {
        const sidebar = document.querySelector('.sidebar');
        sidebar.classList.toggle('closed');
    });

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

    const auto = document.getElementById('autocomplete');
    const isOpen = !auto.classList.contains('hidden');

    editorEl.addEventListener('keydown', (e) => {

        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            window.runQuery();
        }

    });
});

function insertQuery(q) {
    document.getElementById('editor').innerText = q;
    runQuery()
}


function renderTable(data, container) {
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

    const table = document.createElement('table');
    table.className = 'table table-dark table-striped table-bordered table-hover table-sm mb-0';

    const thead = document.createElement('thead');
    thead.className = 'table-light sticky-top';
    const trHead = document.createElement('tr');

    headers.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        trHead.appendChild(th);
    });
    thead.appendChild(trHead);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    data.forEach(row => {
        const tr = document.createElement('tr');
        headers.forEach(h => {
            const td = document.createElement('td');
            const val = row[h];
            td.textContent = (val === null) ? 'NULL' : (typeof val === 'object' ? JSON.stringify(val) : val);
            if (val === null) {
                td.style.color = '#ce916a';
                td.style.fontStyle = 'italic';
            }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    
    table.appendChild(tbody);
    
    // Add the table directly to container without wrapper
    container.appendChild(table);
}