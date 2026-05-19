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
            'Ctrl-Enter': () => window.runQuery(),
            'Cmd-Enter':  () => window.runQuery(),
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
});
