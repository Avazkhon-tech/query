const SQL_KEYWORDS = "SELECT FROM WHERE INSERT UPDATE DELETE CREATE ALTER DROP TABLE INDEX VIEW DATABASE SCHEMA FUNCTION TRIGGER PROCEDURE JOIN INNER LEFT RIGHT FULL OUTER ON GROUP BY ORDER BY HAVING LIMIT OFFSET AS DISTINCT UNION ALL EXISTS IN BETWEEN LIKE IS NULL NOT AND OR CASE WHEN THEN ELSE END TRUE FALSE VALUES PRIMARY KEY FOREIGN KEY DEFAULT UNIQUE CHECK CONSTRAINT TRUNCATE GRANT REVOKE COMMIT ROLLBACK SAVEPOINT VACUUM EXPLAIN ANALYZE SET RETURNING WITH RECURSIVE".split(" ");

window.addEventListener('DOMContentLoaded', () => {
    const dropdown = document.getElementById('autocomplete');
    let activeIndex = -1;
    let currentOptions = [];

    // ── Cursor helpers ──────────────────────────────────────────

    function getCurrentWord() {
        const cur = window.cmEditor.getCursor();
        const line = window.cmEditor.getLine(cur.line);
        const m = line.slice(0, cur.ch).match(/(\w+)$/);
        return m ? m[1] : '';
    }

    function getWordBefore() {
        const cur = window.cmEditor.getCursor();
        const line = window.cmEditor.getLine(cur.line);
        const words = line.slice(0, cur.ch).trim().split(/\s+/);
        return words.length > 1 ? words[words.length - 2] : '';
    }

    function getDotContext() {
        const cur = window.cmEditor.getCursor();
        const line = window.cmEditor.getLine(cur.line);
        const before = line.slice(0, cur.ch);
        const q = before.match(/(\w+)\.(\w+)\.(\w*)$/);
        if (q) return { schema: q[1], prefix: q[2], word: q[3] };
        const m = before.match(/(\w+)\.(\w*)$/);
        return m ? { prefix: m[1], word: m[2] } : null;
    }

    // ── DB object helpers ────────────────────────────────────────

    function getAllDbObjects() {
        const pick = li => li.querySelector('span') ? li.querySelector('span').textContent : li.textContent;
        return [
            ...[...document.querySelectorAll('#tables li')].map(pick),
            ...[...document.querySelectorAll('#views li')].map(pick),
            ...[...document.querySelectorAll('#mviews li')].map(pick),
            ...(window.dbSchemas || []).filter(s => s !== window.currentSchema),
        ];
    }

    let tableAliases = {};

    function parseAliases(sql) {
        const out = {};
        const re = /(?:FROM|JOIN)\s+(?:(\w+)\.)?(\w+)(?:\s+(?:AS\s+)?(\w+))?/gi;
        let m;
        while ((m = re.exec(sql)) !== null) {
            const full = (m[1] ? m[1] + '.' : '') + m[2], alias = m[3];
            if (alias && !['ON','WHERE','SET','LEFT','RIGHT','INNER','OUTER','FULL','USING','GROUP','ORDER','LIMIT'].includes(alias.toUpperCase()))
                out[alias.toLowerCase()] = full.toLowerCase();
            out[m[2].toLowerCase()] = full.toLowerCase();
        }
        return out;
    }

    function resolveTable(nameOrAlias) {
        return tableAliases[nameOrAlias.toLowerCase()] || nameOrAlias;
    }

    const unquote = s => s.replace(/^"|"$/g, '');

    // Tables/views of another schema, for `schema.` completion
    const schemaObjCache = {};
    async function fetchSchemaObjects(schema) {
        if (schemaObjCache[schema]) return schemaObjCache[schema];
        try {
            const safe = schema.replace(/'/g, "''");
            const data = await dbQueryRaw(`SELECT table_name FROM information_schema.tables WHERE table_schema = '${safe}' ORDER BY table_name`);
            return (schemaObjCache[schema] = data.map(r => ({ label: r.table_name, type: 'table' })));
        } catch { return []; }
    }

    async function dbQueryRaw(sql) {
        const url = apiUrl();
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('jwt') },
            body: JSON.stringify({ [getQueryKey(url)]: sql })
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        return Array.isArray(data) ? data : [];
    }

    async function fetchColumns(tableName, schema) {
        const token = localStorage.getItem('jwt');
        if (!token) return [];
        try {
            const url = apiUrl();
            const key = getQueryKey(url);
            const safe = tableName.replace(/'/g, "''");
            const schemaSafe = (schema || window.currentSchema || 'public').replace(/'/g, "''");
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ [key]: `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = '${schemaSafe}' AND table_name = '${safe}'` })
            });
            if (!res.ok) return [];
            const data = await res.json();
            return Array.isArray(data) ? data.map(r => ({ label: r.column_name, type: r.data_type })) : [];
        } catch { return []; }
    }

    // ── Dropdown render & position ───────────────────────────────

    function showDropdown(options) {
        if (!options.length) return hideDropdown();
        currentOptions = options;
        activeIndex = 0;

        dropdown.innerHTML = options.map((opt, i) => {
            const isObj = typeof opt !== 'string';
            const label = isObj ? opt.label : opt;
            const meta  = isObj ? `<span class="ac-type">${opt.type || ''}</span>` : '';
            return `<li class="${i === 0 ? 'active' : ''}" data-value="${label}">${label}${meta}</li>`;
        }).join('');

        const cur    = window.cmEditor.getCursor();
        const coords = window.cmEditor.charCoords(cur, 'window');
        const wrap   = document.querySelector('.editor-wrapper').getBoundingClientRect();

        dropdown.style.left = (coords.left  - wrap.left) + 'px';
        dropdown.style.top  = (coords.bottom - wrap.top)  + 'px';
        dropdown.classList.remove('hidden');
    }

    function hideDropdown() {
        dropdown.classList.add('hidden');
        dropdown.innerHTML = '';
        activeIndex = -1;
        currentOptions = [];
    }

    function updateActive() {
        [...dropdown.children].forEach((li, i) => {
            li.classList.toggle('active', i === activeIndex);
            if (i === activeIndex) li.scrollIntoView({ block: 'nearest' });
        });
    }

    // ── Insert selected ──────────────────────────────────────────

    function insertSelected(word) {
        const cur  = window.cmEditor.getCursor();
        const line = window.cmEditor.getLine(cur.line);
        const before = line.slice(0, cur.ch);

        const dotMatch = before.match(/(\w+)\.(\w*)$/);
        let from;
        if (dotMatch) {
            from = { line: cur.line, ch: cur.ch - dotMatch[2].length };
        } else {
            const m = before.match(/(\w+)$/);
            from = { line: cur.line, ch: m ? cur.ch - m[1].length : cur.ch };
        }

        const prevWord = before.trim().split(/\s+/).slice(-2, -1)[0] || '';
        const noTrail  = ['FROM', 'JOIN'].includes(prevWord.toUpperCase());
        window.cmEditor.replaceRange(noTrail ? word : word + ' ', from, cur);
        window.cmEditor.focus();
        hideDropdown();
    }

    // ── extraKey handlers (called from module.js) ────────────────

    window.acHandleTab = () => {
        if (dropdown.classList.contains('hidden')) return false;
        const sel = currentOptions[activeIndex];
        insertSelected(typeof sel === 'string' ? sel : sel.label);
        return true;
    };

    window.acHandleUp = () => {
        if (dropdown.classList.contains('hidden')) return false;
        activeIndex = (activeIndex - 1 + currentOptions.length) % currentOptions.length;
        updateActive();
        return true;
    };

    window.acHandleDown = () => {
        if (dropdown.classList.contains('hidden')) return false;
        activeIndex = (activeIndex + 1) % currentOptions.length;
        updateActive();
        return true;
    };

    window.acHandleEnter = () => {
        if (dropdown.classList.contains('hidden')) return false;
        const sel = currentOptions[activeIndex];
        insertSelected(typeof sel === 'string' ? sel : sel.label);
        return true;
    };

    window.acHandleEsc = () => {
        if (dropdown.classList.contains('hidden')) return false;
        hideDropdown();
        return true;
    };

    // ── Main change listener ─────────────────────────────────────

    window.cmEditor.on('change', async (cm, change) => {
        if (change.origin === 'setValue') {
            hideDropdown(); return;
        }

        tableAliases = parseAliases(window.cmEditor.getValue());

        const dotCtx = getDotContext();
        if (dotCtx) {
            let schema = dotCtx.schema;
            let tbl = resolveTable(dotCtx.prefix);
            if (tbl.includes('.')) [schema, tbl] = tbl.split('.');
            const isSchema = !schema && (tableAliases[dotCtx.prefix.toLowerCase()] || dotCtx.prefix.toLowerCase()) === dotCtx.prefix.toLowerCase() &&
                (window.dbSchemas || []).includes(dotCtx.prefix);
            const cols = isSchema
                ? await fetchSchemaObjects(dotCtx.prefix)
                : await fetchColumns(unquote(tbl), schema);
            if (cols.length) {
                const matches = dotCtx.word
                    ? cols.filter(c => c.label.toLowerCase().startsWith(dotCtx.word.toLowerCase()))
                    : cols;
                if (matches.length) { showDropdown(matches); return; }
            }
            hideDropdown(); return;
        }

        const word = getCurrentWord();
        if (!word) { hideDropdown(); return; }

        const prev = getWordBefore().toUpperCase();
        let pool;
        if (['FROM', 'JOIN'].includes(prev)) {
            pool = getAllDbObjects();
        } else if (['WHERE', 'AND', 'OR', 'SET'].includes(prev)) {
            pool = [...Object.keys(tableAliases), ...SQL_KEYWORDS];
        } else {
            pool = SQL_KEYWORDS;
        }

        const matches = pool.filter(k =>
            (typeof k === 'string' ? k : k.label).toLowerCase().startsWith(word.toLowerCase())
        );
        matches.length ? showDropdown(matches) : hideDropdown();
    });

    // Click to select from dropdown
    dropdown.addEventListener('mousedown', e => {
        e.preventDefault();
        const li = e.target.closest('li');
        if (li) insertSelected(li.dataset.value);
    });
});
