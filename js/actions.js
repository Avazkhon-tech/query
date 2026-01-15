window.copyResult = async function () {
    if (!lastResultData) return;

    const text = JSON.stringify(lastResultData, null, 2);
    const btn = document.getElementById('copy-btn');
    const span = btn.querySelector('span');

    try {
        await navigator.clipboard.writeText(text);
        btn.classList.add('success');
        span.textContent = 'Copied!';
        setTimeout(() => {
            btn.classList.remove('success');
            span.textContent = 'Copy';
        }, 2000);
    } catch (err) {
        console.error('Failed to copy: ', err);
        alert('Failed to copy results to clipboard');
    }
};

window.downloadResult = function () {
    if (!lastResultData) return;
    const text = JSON.stringify(lastResultData, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const inputName = document.getElementById('filename-input').value.trim();
    const finalName = (inputName || 'query-result') + '.json';

    const a = document.createElement('a');
    a.href = url;
    a.download = finalName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
