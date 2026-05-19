function apiUrl() {
    return document.getElementById('apiUrlSelect').value;
}

function getQueryKey(url) {
    if (url.includes('aistroke')) {
        return 'query';
    }
    return 'q';
}
