function apiUrl() {
    return document.getElementById('apiUrlSelect').value;
}

function getQueryKey(url) {
    if (url.includes('aistroke.ssv.uz') || url.includes('test-hc.ssv.uz')) {
        return 'query';
    }
    return 'q';
}
