function apiUrl() {
    return document.getElementById('apiUrlSelect').value;
}

// Tokens are stored per backend origin; "jwt" mirrors the active environment's token
// so the code that reads it directly keeps working.
function tokenKey() {
    try { return 'jwt::' + new URL(apiUrl()).origin; } catch (e) { return 'jwt'; }
}

function saveToken(token) {
    localStorage.setItem('jwt', token);
    localStorage.setItem(tokenKey(), token);
}

function switchEnvToken() {
    const token = localStorage.getItem(tokenKey()) || '';
    if (token) localStorage.setItem('jwt', token); else localStorage.removeItem('jwt');
    document.getElementById('token').value = token;
    return token;
}

function getQueryKey(url) {
    if (url.includes('aistroke')) {
        return 'query';
    }
    return 'q';
}
