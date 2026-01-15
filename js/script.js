
window.connect = async function () {
    const tokenInput = document.getElementById("token").value.trim();
    if (!tokenInput) {
        alert("JWT token kiriting");
        return;
    }
    localStorage.setItem("jwt", tokenInput);
    await loadDbObjects();
};

window.runQuery = async function () {
    const rawQuery = document.getElementById('editor').innerText;
    const cleanQuery = rawQuery.trim();
    const result = document.getElementById('result');
    const timeDiv = document.getElementById('execution-time');

    if (!cleanQuery) {
        result.textContent = 'Query empty';
        return;
    }

    saveToHistory(cleanQuery);

    result.textContent = 'Running...';
    document.getElementById('table-result').innerHTML = '';
    document.getElementById('copy-btn').classList.add('hidden');
    document.getElementById('download-btn').classList.add('hidden');
    document.getElementById('filename-input').classList.add('hidden');
    document.getElementById('result-count').classList.add('hidden');
    timeDiv.classList.add('hidden');

    const startTime = performance.now();

    try {
        const token = localStorage.getItem('jwt');
        const url = apiUrl();
        const payloadKey = getQueryKey(url);

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ [payloadKey]: cleanQuery })
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

        const data = await res.json();
        const endTime = performance.now();
        const duration = ((endTime - startTime) / 1000).toFixed(3);

        timeDiv.textContent = `${duration}s`;
        timeDiv.classList.remove('hidden');

        lastResultData = data;
        renderResult();

    } catch (e) {
        result.textContent = 'Error: ' + e.message;
        console.error(e);
        lastResultData = null;
    }
};