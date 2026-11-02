window.connect = async function () {
    let tokenInput = document.getElementById("token").value.trim();
    if (!tokenInput && window.ensureFreshToken) {
        tokenInput = (await window.ensureFreshToken(true)) || '';
    }
    if (!tokenInput) {
        alert("Please enter a JWT token (or set up OAuth using the key button)");
        return;
    }
    saveToken(tokenInput);
    await loadDbObjects();
};

window.toggleRunMenu = function (e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('run-menu');
    if (menu) menu.classList.toggle('hidden');
};

window.runQuery = async function (options = {}) {
    const runMenu = document.getElementById('run-menu');
    if (runMenu) runMenu.classList.add('hidden');

    const result = document.getElementById('result');
    const timeDiv = document.getElementById('execution-time');

    if (!window.cmEditor) {
        result.textContent = 'Editor not initialized';
        return;
    }

    const mode = options.mode || 'smart';

    let queriesToRun = [];

    if (mode === 'all') {
        const fullText = window.cmEditor.getValue();
        const statements = window.parseSqlStatements ? window.parseSqlStatements(fullText) : [];
        const cleanStmts = statements.filter(s => s.cleanText.length > 0);
        if (cleanStmts.length > 0) {
            queriesToRun = cleanStmts.map(s => ({
                query: s.text.trim(),
                cleanQuery: s.cleanText
            }));
        } else {
            const raw = fullText.trim();
            if (raw) queriesToRun.push({ query: raw, cleanQuery: window.stripSqlComments ? window.stripSqlComments(raw).trim() : raw });
        }
    } else {
        const stmtInfo = window.getActiveStatementInfo ? window.getActiveStatementInfo(window.cmEditor) : null;
        if (stmtInfo && (stmtInfo.cleanQuery || stmtInfo.query)) {
            queriesToRun.push({
                query: stmtInfo.query,
                cleanQuery: stmtInfo.cleanQuery || stmtInfo.query
            });
        } else {
            const raw = window.cmEditor.getValue().trim();
            if (raw) queriesToRun.push({ query: raw, cleanQuery: window.stripSqlComments ? window.stripSqlComments(raw).trim() : raw });
        }
    }

    if (queriesToRun.length === 0 || !queriesToRun.some(q => q.cleanQuery)) {
        result.textContent = 'Query empty or only comments';
        return;
    }

    result.textContent = 'Running...';
    document.getElementById('table-result').innerHTML = '';
    document.getElementById('copy-btn').classList.add('hidden');
    document.getElementById('download-btn').classList.add('hidden');
    document.getElementById('filename-input').classList.add('hidden');
    document.getElementById('result-count').classList.add('hidden');
    timeDiv.classList.add('hidden');

    const startTime = performance.now();

    try {
        if (window.ensureFreshToken) await window.ensureFreshToken();
        const token = localStorage.getItem('jwt');
        const url = apiUrl();
        const payloadKey = getQueryKey(url);

        let finalData = null;
        let noResultCount = 0;

        for (let i = 0; i < queriesToRun.length; i++) {
            const item = queriesToRun[i];
            if (!item.cleanQuery) continue;

            saveToHistory(item.query);

            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({ [payloadKey]: item.cleanQuery })
            });

            if (!res.ok) {
                const errText = await res.text();
                // Statements like INSERT/UPDATE/DDL return no rows; the server reports that as a 500.
                if (res.status === 500 && /no results/i.test(errText)) {
                    noResultCount++;
                    continue;
                }
                throw new Error(queriesToRun.length > 1
                    ? `[Query ${i + 1}/${queriesToRun.length}] HTTP ${res.status}: ${errText}`
                    : `HTTP ${res.status}: ${errText}`);
            }

            finalData = await res.json();
        }

        const endTime = performance.now();
        const duration = ((endTime - startTime) / 1000).toFixed(3);

        const querySuffix = queriesToRun.length > 1 ? ` (${queriesToRun.length} queries)` : '';
        timeDiv.textContent = `${duration}s${querySuffix}`;
        timeDiv.classList.remove('hidden');

        if (finalData === null) {
            lastResultData = null;
            result.textContent = `Executed successfully (${noResultCount} statement${noResultCount === 1 ? '' : 's'}, no results returned)`;
            return;
        }

        lastResultData = finalData;
        renderResult();

    } catch (e) {
        result.textContent = 'Error: ' + e.message;
        console.error(e);
        lastResultData = null;
    }
};