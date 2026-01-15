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
    wrapper.appendChild(table);
    container.appendChild(wrapper);
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
