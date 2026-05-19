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
7. `js/script.js` — `connect()`, `runQuery()` — core query execution
8. `js/module.js` — editor `keydown` handler (Ctrl+Enter to run, Tab insert, Enter newline with scroll)
9. `js/ui.js` — DOMContentLoaded wiring: sidebar toggles, search filtering, editor resize, all global keyboard shortcuts, JWT paste trigger
10. `js/autocomplete.js` — autocomplete dropdown positioned relative to the caret; suggests SQL keywords, table/view names after `FROM`/`JOIN`, and column names after `WHERE`/`AND`/`OR` or dot-notation (`alias.col`)
11. `js/lib/index.js` — vendored `SqlString` utility (escape, format, etc.)

## Key behaviors

**JWT storage**: The token is persisted in `localStorage` under key `"jwt"` and auto-loaded on page load.

**API dispatch**: The selected URL from `#apiUrlSelect` determines which backend is hit. `getQueryKey()` returns `"query"` for aistroke endpoints and `"q"` for all others.

**Autocomplete**: The `#autocomplete` `<ul>` is positioned absolutely inside `.editor-wrapper` (relative to `#editor`). Caret position is computed via `Range.getBoundingClientRect()` with a zero-width space fallback. Dot-notation (`table.column` or `alias.col`) triggers column-fetch from the backend using `information_schema.columns`.

**Global shortcuts**:
- `Ctrl+Enter` — run query
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
