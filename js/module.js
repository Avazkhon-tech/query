window.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') === 'dark' ? 'query-dark' : 'query-light';

    window.cmEditor = CodeMirror(document.getElementById('editor'), {
        mode: 'text/x-sql',
        theme: savedTheme,
        lineNumbers: true,
        matchBrackets: true,
        autoCloseBrackets: true,
        styleActiveLine: true,
        indentWithTabs: false,
        indentUnit: 4,
        tabSize: 4,
        lineWrapping: false,
        scrollbarStyle: 'native',
        extraKeys: {
            'Ctrl-Enter': () => window.runQuery({ mode: 'smart' }),
            'Cmd-Enter':  () => window.runQuery({ mode: 'smart' }),
            'Ctrl-Shift-Enter': () => window.runQuery({ mode: 'all' }),
            'Cmd-Shift-Enter':  () => window.runQuery({ mode: 'all' }),
            'Ctrl-/': cm => window.toggleComment(cm, 'line'),
            'Cmd-/':  cm => window.toggleComment(cm, 'line'),
            'Ctrl-Shift-/': cm => window.toggleComment(cm, 'block'),
            'Cmd-Shift-/':  cm => window.toggleComment(cm, 'block'),
            'Tab': cm => {
                if (window.acHandleTab && window.acHandleTab(cm)) return;
                cm.execCommand('indentMore');
            },
            'Up': cm => {
                if (window.acHandleUp && window.acHandleUp()) return;
                return CodeMirror.Pass;
            },
            'Down': cm => {
                if (window.acHandleDown && window.acHandleDown()) return;
                return CodeMirror.Pass;
            },
            'Enter': cm => {
                if (window.acHandleEnter && window.acHandleEnter()) return;
                return CodeMirror.Pass;
            },
            'Esc': () => {
                if (window.acHandleEsc && window.acHandleEsc()) return;
                return CodeMirror.Pass;
            },
        }
    });

    window.cmEditor.setSize(null, 150);

    let activeStatementMark = null;

    function updateActiveStatementHighlight() {
        if (!window.cmEditor) return;

        if (activeStatementMark) {
            activeStatementMark.clear();
            activeStatementMark = null;
        }

        const badge = document.getElementById('query-stmt-badge');
        const runBtnText = document.getElementById('run-btn-text');
        const mainRunBtn = document.getElementById('main-run-btn');

        const info = window.getActiveStatementInfo ? window.getActiveStatementInfo(window.cmEditor) : null;

        if (!info) {
            if (badge) badge.classList.add('hidden');
            if (runBtnText) runBtnText.textContent = 'Run';
            return;
        }

        if (info.isSelection) {
            if (badge) {
                badge.textContent = 'Selected Query';
                badge.classList.remove('hidden');
            }
            if (runBtnText) runBtnText.textContent = 'Run Selected';
            if (mainRunBtn) mainRunBtn.title = 'Run Selected Query (Ctrl+Enter)';
        } else if (info.totalStatements > 1) {
            if (badge) {
                badge.textContent = `Query ${info.statementIndex} of ${info.totalStatements}`;
                badge.classList.remove('hidden');
            }
            if (runBtnText) runBtnText.textContent = `Run Query ${info.statementIndex}`;
            if (mainRunBtn) mainRunBtn.title = `Run Query ${info.statementIndex} of ${info.totalStatements} (Ctrl+Enter)`;

            if (info.range) {
                activeStatementMark = window.cmEditor.markText(info.range.from, info.range.to, {
                    className: 'cm-active-statement'
                });
            }
        } else {
            if (badge) badge.classList.add('hidden');
            if (runBtnText) runBtnText.textContent = 'Run';
            if (mainRunBtn) mainRunBtn.title = 'Run Query (Ctrl+Enter)';
        }
    }

    window.cmEditor.on('cursorActivity', updateActiveStatementHighlight);
    window.cmEditor.on('change', updateActiveStatementHighlight);
    window.updateActiveStatementHighlight = updateActiveStatementHighlight;
});
