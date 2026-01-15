async function loadDbObjects() {
    const token = localStorage.getItem('jwt');
    if (!token) return;

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
    };

    try {
        const url = apiUrl();
        const payloadKey = getQueryKey(url);

        const tvRes = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ [payloadKey]: "SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;" })
        });
        const tvData = await tvRes.json();

        const tables = document.getElementById('tables');
        const views = document.getElementById('views');
        tables.innerHTML = ''; views.innerHTML = '';

        tvData.sort((a, b) => a.table_name.localeCompare(b.table_name));

        tvData.forEach(r => {
            const li = document.createElement('li');
            li.setAttribute('data-name', r.table_name.toLowerCase());

            li.innerHTML = `
                <span>${r.table_name}</span>
                <button class="count-btn" onclick="runCount('${r.table_name}', this); event.stopPropagation();" title="Get total count">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M7 2a2 2 0 0 1 2 2v1h6V4a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2v18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h1z"></path>
                    </svg>
                    <span class="count-val">count</span>
                </button>
            `;

            li.ondblclick = () => {
                const q = `SELECT * FROM ${r.table_name} LIMIT 50;`;
                if (window.editor) insertQuery(q); else document.getElementById('editor').innerText = q;
                window.runQuery();
            };
            if (r.table_type === 'BASE TABLE') tables.appendChild(li);
            else if (r.table_type === 'VIEW') views.appendChild(li);
        });

        const mvRes = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ [payloadKey]: "SELECT matviewname FROM pg_matviews WHERE schemaname = 'public' ORDER BY matviewname;" }) });
        const mvData = await mvRes.json();
        const mviews = document.getElementById('mviews');
        mviews.innerHTML = '';
        mvData.sort((a, b) => a.matviewname.localeCompare(b.matviewname));

        mvData.forEach(r => {
            const li = document.createElement('li');
            li.setAttribute('data-name', r.matviewname.toLowerCase());

            li.innerHTML = `
                <span>${r.matviewname}</span>
                <button class="count-btn" onclick="runCount('${r.matviewname}', this); event.stopPropagation();" title="Get total count">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M7 2a2 2 0 0 1 2 2v1h6V4a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2v18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h1z"></path>
                    </svg>
                    <span class="count-val">count</span>
                </button>
            `;

            li.ondblclick = () => {
                const q = `SELECT * FROM ${r.matviewname} LIMIT 10;`;
                if (window.editor) insertQuery(q); else document.getElementById('editor').innerText = q;
                window.runQuery();
            };
            mviews.appendChild(li);
        });

        const idxRes = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ [payloadKey]: "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY indexname;" }) });
        const idxData = await idxRes.json();
        const indexes = document.getElementById('indexes');
        indexes.innerHTML = '';
        idxData.sort((a, b) => a.indexname.localeCompare(b.indexname));

        idxData.forEach(r => {
            const li = document.createElement('li');
            li.textContent = r.indexname;
            li.setAttribute('data-name', r.indexname.toLowerCase());
            li.ondblclick = () => {
                const escapedIndexName = r.indexname.replace(/'/g, "''");
                const q = `-- Index info\nSELECT * FROM pg_indexes WHERE indexname = '${escapedIndexName}';`;
                if (window.editor) insertQuery(q); else document.getElementById('editor').innerText = q;
                window.runQuery();
            };
            indexes.appendChild(li);
        });
    } catch (e) {
        console.error('loadDbObjects error:', e);
    }
}

window.runCount = async function (tableName, btn) {
    const countVal = btn.querySelector('.count-val');
    countVal.textContent = '...';

    const query = `SELECT count(*) as total FROM ${tableName};`;
    if (window.editor) {
        document.getElementById('editor').innerText = query;
    }

    // We execute the query normally so user sees it in result area
    await window.runQuery();

    // Also update the badge if lastResultData has the count
    if (window.lastResultData && Array.isArray(window.lastResultData) && window.lastResultData.length > 0) {
        const total = window.lastResultData[0].total || window.lastResultData[0].count;
        if (total !== undefined) {
            countVal.textContent = total;
            btn.style.opacity = '1';
            btn.style.pointerEvents = 'auto'; // Keep it visible after count
            btn.classList.add('counted');
        } else {
            countVal.textContent = 'err';
        }
    } else {
        countVal.textContent = 'err';
    }
};
