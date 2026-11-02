// Postman-style automatic token fetching.
// Config is stored per backend origin under localStorage "auth_config::<origin>".
(function () {
    const CONFIG_PREFIX = 'auth_config::';
    let refreshTimer = null;

    function currentOrigin() {
        try { return new URL(apiUrl()).origin; } catch (e) { return ''; }
    }

    function loadConfig() {
        try {
            const raw = localStorage.getItem(CONFIG_PREFIX + currentOrigin());
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }

    function saveConfig(cfg) {
        localStorage.setItem(CONFIG_PREFIX + currentOrigin(), JSON.stringify(cfg));
    }

    function jwtExp(token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
            return payload.exp ? payload.exp * 1000 : null;
        } catch (e) { return null; }
    }

    function extractToken(data) {
        if (!data) return null;
        if (typeof data === 'string') return data.length > 20 ? data : null;
        for (const k of ['access_token', 'accessToken', 'token', 'jwt', 'id_token']) {
            if (typeof data[k] === 'string') return data[k];
        }
        for (const nest of ['data', 'result']) {
            if (data[nest] && typeof data[nest] === 'object') {
                const t = extractToken(data[nest]);
                if (t) return t;
            }
        }
        return null;
    }

    function applyToken(token) {
        saveToken(token);
        const input = document.getElementById('token');
        if (input) {
            input.value = token;
            input.classList.add('flash-success');
            setTimeout(() => input.classList.remove('flash-success'), 1000);
        }
    }

    async function getToken(cfg) {
        const headers = {};
        let body;

        if (cfg.format === 'json') {
            headers['Content-Type'] = 'application/json';
            const payload = {};
            if (cfg.username) payload.username = cfg.username;
            if (cfg.password) payload.password = cfg.password;
            if (cfg.clientId) payload.client_id = cfg.clientId;
            if (cfg.clientSecret) payload.client_secret = cfg.clientSecret;
            if (cfg.scope) payload.scope = cfg.scope;
            body = JSON.stringify(payload);
        } else {
            headers['Content-Type'] = 'application/x-www-form-urlencoded';
            const params = new URLSearchParams();
            params.set('grant_type', cfg.grantType || 'password');
            if (cfg.grantType !== 'client_credentials') {
                params.set('username', cfg.username || '');
                params.set('password', cfg.password || '');
            }
            if (cfg.scope) params.set('scope', cfg.scope);
            if (cfg.clientAuth === 'basic') {
                headers['Authorization'] = 'Basic ' + btoa((cfg.clientId || '') + ':' + (cfg.clientSecret || ''));
            } else {
                if (cfg.clientId) params.set('client_id', cfg.clientId);
                if (cfg.clientSecret) params.set('client_secret', cfg.clientSecret);
            }
            body = params.toString();
        }

        const res = await fetch(cfg.tokenUrl, { method: 'POST', headers, body });
        const text = await res.text();
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);

        let data;
        try { data = JSON.parse(text); } catch (e) { data = text.trim(); }
        const token = extractToken(data);
        if (!token) throw new Error('Token not found (no access_token/token/jwt field)');

        applyToken(token);
        scheduleRefresh();
        return token;
    }

    function scheduleRefresh() {
        clearTimeout(refreshTimer);
        const cfg = loadConfig();
        if (!cfg || !cfg.tokenUrl || !cfg.autoRefresh) return;
        const exp = jwtExp(localStorage.getItem('jwt') || '');
        if (!exp) return;
        // refresh 60s before expiry; clamp so setTimeout stays sane
        const delay = Math.min(Math.max(exp - Date.now() - 60000, 5000), 86400000);
        refreshTimer = setTimeout(() => {
            getToken(loadConfig()).catch(e => console.error('Token auto-refresh failed:', e));
        }, delay);
    }

    // Called before queries (and on load). force=true fetches even when
    // auto-refresh is off or the current token still looks valid.
    window.ensureFreshToken = async function (force = false) {
        const cfg = loadConfig();
        if (!cfg || !cfg.tokenUrl) return null;
        if (!force && !cfg.autoRefresh) return null;
        if (!force) {
            const jwt = localStorage.getItem('jwt');
            if (jwt) {
                const exp = jwtExp(jwt);
                if (!exp || exp - Date.now() > 30000) return jwt;
            }
        }
        try { return await getToken(cfg); }
        catch (e) { console.error('Token refresh failed:', e); return null; }
    };

    // ── Modal UI ─────────────────────────────────

    const FIELD_MAP = {
        tokenUrl: 'auth-url',
        grantType: 'auth-grant',
        format: 'auth-format',
        username: 'auth-username',
        password: 'auth-password',
        clientId: 'auth-client-id',
        clientSecret: 'auth-client-secret',
        scope: 'auth-scope',
        clientAuth: 'auth-client-auth'
    };

    function readFields() {
        const cfg = {};
        for (const [key, id] of Object.entries(FIELD_MAP)) {
            cfg[key] = document.getElementById(id).value.trim();
        }
        cfg.autoRefresh = document.getElementById('auth-autorefresh').checked;
        return cfg;
    }

    function fillFields(cfg) {
        cfg = cfg || {};
        for (const [key, id] of Object.entries(FIELD_MAP)) {
            document.getElementById(id).value = cfg[key] || '';
        }
        if (!cfg.grantType) document.getElementById('auth-grant').value = 'password';
        if (!cfg.format) document.getElementById('auth-format').value = 'form';
        if (!cfg.clientAuth) document.getElementById('auth-client-auth').value = 'body';
        document.getElementById('auth-autorefresh').checked = cfg.autoRefresh !== false;
        toggleUserRow();
    }

    function toggleUserRow() {
        const grant = document.getElementById('auth-grant').value;
        document.getElementById('auth-user-row').classList.toggle('hidden', grant === 'client_credentials');
    }

    function setStatus(msg, ok) {
        const el = document.getElementById('auth-status');
        el.textContent = msg;
        el.className = 'auth-status' + (msg ? (ok ? ' ok' : ' err') : '');
    }

    function openModal() {
        fillFields(loadConfig());
        let envName = currentOrigin();
        const select = document.getElementById('apiUrlSelect');
        if (select.selectedIndex >= 0) envName = select.options[select.selectedIndex].text;
        document.getElementById('auth-env').textContent = envName;
        setStatus('', true);
        document.getElementById('auth-overlay').classList.remove('hidden');
        document.getElementById('auth-url').focus();
    }

    function closeModal() {
        const cfg = readFields();
        if (cfg.tokenUrl) saveConfig(cfg);
        document.getElementById('auth-overlay').classList.add('hidden');
    }

    async function onGetToken() {
        const cfg = readFields();
        if (!cfg.tokenUrl) {
            setStatus('Please enter Access Token URL', false);
            return;
        }
        saveConfig(cfg);
        const btn = document.getElementById('auth-get');
        btn.disabled = true;
        setStatus('Requesting…', true);
        try {
            const token = await getToken(cfg);
            const exp = jwtExp(token);
            setStatus('Token received' + (exp ? ' — expires at: ' + new Date(exp).toLocaleTimeString() : ''), true);
        } catch (e) {
            setStatus('Error: ' + e.message, false);
        } finally {
            btn.disabled = false;
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('auth-btn').addEventListener('click', openModal);
        document.getElementById('auth-close').addEventListener('click', closeModal);
        document.getElementById('auth-get').addEventListener('click', onGetToken);
        document.getElementById('auth-grant').addEventListener('change', toggleUserRow);
        document.getElementById('auth-overlay').addEventListener('mousedown', (e) => {
            if (e.target === e.currentTarget) closeModal();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !document.getElementById('auth-overlay').classList.contains('hidden')) {
                closeModal();
            }
        });

        // refresh an expired/expiring token on load, then keep the timer armed
        window.ensureFreshToken().finally(scheduleRefresh);
    });
})();
