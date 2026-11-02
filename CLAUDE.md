# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A browser-based SQL playground for querying PostgreSQL databases via a REST API. Users paste a JWT token, connect to one of several backend environments, and run SQL queries directly from the browser. No build step — open `index.html` directly in a browser or serve it with any static file server.

## Running the app

```bash
# Any static server works, e.g.:
python3 -m http.server 8080
# Then open http://localhost:8080
```

There are no build tools, test frameworks, linters, or package dependencies.

## Architecture

All scripts are loaded as plain `<script defer>` tags in `index.html` in dependency order. They share state through globals on `window`. The load order matters:

1. `js/state.js` — global state (`window.lastResultData`, `window.currentView`)
2. `js/api.js` — `apiUrl()` and `getQueryKey(url)` helpers (key is `"q"` for most endpoints, `"query"` for aistroke)
3. `js/renderer.js` — `renderResult()`, `renderTable()`, `syntaxHighlight()`
4. `js/db.js` — `loadDbObjects()`, `runCount()` — fetches tables/views/mviews/indexes from the backend and populates the sidebar
5. `js/actions.js` — `copyResult()`, `downloadResult()`
6. `js/history.js` — `saveToHistory()`, `renderHistory()` using `localStorage` key `query_history` (last 7 days, max 50 entries)
6a. `js/sql-parser.js` — `parseSqlStatements()`, `stripSqlComments()`, `getActiveStatementInfo()`, `toggleComment()`
7. `js/script.js` — `connect()`, `runQuery()`, `toggleRunMenu()` — core query execution
7a. `js/auth.js` — Postman-style OAuth token fetching: modal UI (key button in topbar), `window.ensureFreshToken()`; config stored per backend origin in `localStorage` under `auth_config::<origin>`
8. `js/module.js` — editor keybindings (Ctrl+Enter / Cmd+Enter for single query, Ctrl+Shift+Enter for all, Ctrl+/ for comment, Tab insert), statement highlighting
9. `js/ui.js` — DOMContentLoaded wiring: sidebar toggles, search filtering, editor resize, all global keyboard shortcuts, JWT paste trigger
10. `js/autocomplete.js` — autocomplete dropdown positioned relative to the caret; suggests SQL keywords, table/view names after `FROM`/`JOIN`, and column names after `WHERE`/`AND`/`OR` or dot-notation (`alias.col`)
11. `js/lib/index.js` — vendored `SqlString` utility (escape, format, etc.)

## Key behaviors

**JWT storage**: Tokens are stored per backend origin under `jwt::<origin>` (`saveToken()` in `api.js`); switching `#apiUrlSelect` loads that environment's token into the field. `"jwt"` mirrors the active environment's token for code that reads it directly.

**Single Query Execution**: When multiple queries exist in the editor, `runQuery()` automatically detects and executes the statement under the cursor or active text selection. Semicolons inside strings/comments are safely ignored. Active query range is highlighted dynamically in CodeMirror.

**Commenting**: `toggleComment()` supports line comments (`--`) and block comments (`/* ... */`). Use `Ctrl+/` (`Cmd+/`) or the Comment button to comment/uncomment lines.

**Automatic tokens (OAuth)**: The key button next to the JWT input opens a modal where a token endpoint is configured (URL, grant type, client id/secret, username/password, form vs JSON body). `getToken()` fetches the token, fills the JWT field, and schedules a refresh 60s before the JWT `exp`. `ensureFreshToken()` is awaited in `connect()`/`runQuery()` so an expiring token is silently renewed before each request. Credentials live in `localStorage` per backend origin.

**Schemas**: `#schemaSelect` in the sidebar lists non-system schemas (`information_schema.schemata`); the choice is stored in `localStorage` key `schema` and exposed as `window.currentSchema`. The sidebar, row-count and double-click queries use `qualifiedName()` (schema-qualified for non-public). Autocomplete suggests other schemas after `FROM`/`JOIN`, tables after `schema.`, and columns for `schema.table.`. Typed queries run as-is, so use `schema.table` to cross schemas.

**API dispatch**: The selected URL from `#apiUrlSelect` determines which backend is hit. `getQueryKey()` returns `"query"` for aistroke endpoints and `"q"` for all others.

**Autocomplete**: The `#autocomplete` `<ul>` is positioned absolutely inside `.editor-wrapper` (relative to `#editor`). Caret position is computed via `Range.getBoundingClientRect()` with a zero-width space fallback. Dot-notation (`table.column` or `alias.col`) triggers column-fetch from the backend using `information_schema.columns`.

**Global shortcuts**:
- `Ctrl+Enter` / `Cmd+Enter` — run current statement or selection
- `Ctrl+Shift+Enter` — run all queries sequentially
- `Ctrl+/` / `Cmd+/` — toggle line comment (`--`)
- `Ctrl+Shift+/` / `Cmd+Shift+/` — toggle block comment (`/* ... */`)
- `Alt+C` — connect
- `Ctrl+Shift+C` — copy result JSON
- `Ctrl+S` — download result JSON
- `Alt+Q` — focus editor
- `Alt+N` — focus filename input
- `Alt+J` or typing `jwt` outside inputs — paste clipboard into JWT field and connect

## Backend environments

Configured as static `<option>` values in `#apiUrlSelect`:
- `hc.ssv.uz` — production
- `test-hc.ssv.uz`, `test2-hc.ssv.uz` — staging
- `aistroke.ssv.uz`, `test-aistroke.ssv.uz` — separate service with different payload key
