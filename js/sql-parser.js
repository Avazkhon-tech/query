// SQL Statement Parsing & Commenting Utilities

/**
 * Splits SQL script into individual statements, preserving positions.
 * Correctly ignores ';' inside single quotes, double quotes, dollar quotes ($$...$$),
 * single-line comments (-- or #), and block comments (/* ... *\/).
 */
window.parseSqlStatements = function (sqlText) {
    if (!sqlText) return [];

    const statements = [];
    let start = 0;
    let i = 0;
    const len = sqlText.length;

    let inSingleQuote = false;
    let inDoubleQuote = false;
    let dollarTag = null;
    let inLineComment = false;
    let inBlockComment = false;

    while (i < len) {
        const char = sqlText[i];
        const nextChar = i + 1 < len ? sqlText[i + 1] : '';

        if (inLineComment) {
            if (char === '\n' || char === '\r') {
                inLineComment = false;
            }
            i++;
            continue;
        }

        if (inBlockComment) {
            if (char === '*' && nextChar === '/') {
                inBlockComment = false;
                i += 2;
                continue;
            }
            i++;
            continue;
        }

        if (inSingleQuote) {
            if (char === "'") {
                if (nextChar === "'") {
                    i += 2;
                    continue;
                } else {
                    inSingleQuote = false;
                }
            }
            i++;
            continue;
        }

        if (inDoubleQuote) {
            if (char === '"') {
                if (nextChar === '"') {
                    i += 2;
                    continue;
                } else {
                    inDoubleQuote = false;
                }
            }
            i++;
            continue;
        }

        if (dollarTag !== null) {
            if (sqlText.startsWith(dollarTag, i)) {
                i += dollarTag.length;
                dollarTag = null;
                continue;
            }
            i++;
            continue;
        }

        // Line comment start
        if ((char === '-' && nextChar === '-') || char === '#') {
            inLineComment = true;
            i += (char === '-' ? 2 : 1);
            continue;
        }

        // Block comment start
        if (char === '/' && nextChar === '*') {
            inBlockComment = true;
            i += 2;
            continue;
        }

        // Quote starts
        if (char === "'") {
            inSingleQuote = true;
            i++;
            continue;
        }

        if (char === '"') {
            inDoubleQuote = true;
            i++;
            continue;
        }

        // Dollar quote start ($tag$)
        if (char === '$') {
            const dollarMatch = sqlText.slice(i).match(/^(\$[a-zA-Z0-9_]*\$)/);
            if (dollarMatch) {
                dollarTag = dollarMatch[1];
                i += dollarTag.length;
                continue;
            }
        }

        // Statement separator check
        if (char === ';') {
            const stmtText = sqlText.slice(start, i + 1);
            const cleanText = window.stripSqlComments(stmtText).trim();
            statements.push({
                text: stmtText,
                cleanText: cleanText,
                start: start,
                end: i + 1,
                hasSemicolon: true
            });
            start = i + 1;
        }

        i++;
    }

    // Trailing statement
    if (start < len) {
        const stmtText = sqlText.slice(start, len);
        const cleanText = window.stripSqlComments(stmtText).trim();
        if (stmtText.trim().length > 0) {
            statements.push({
                text: stmtText,
                cleanText: cleanText,
                start: start,
                end: len,
                hasSemicolon: false
            });
        }
    }

    return statements;
};

/**
 * Strips single-line and multi-line comments from SQL text
 */
window.stripSqlComments = function (sql) {
    if (!sql) return '';
    let result = '';
    let i = 0;
    const len = sql.length;

    let inSingleQuote = false;
    let inDoubleQuote = false;
    let dollarTag = null;
    let inLineComment = false;
    let inBlockComment = false;

    while (i < len) {
        const char = sql[i];
        const nextChar = i + 1 < len ? sql[i + 1] : '';

        if (inLineComment) {
            if (char === '\n' || char === '\r') {
                inLineComment = false;
                result += char;
            }
            i++;
            continue;
        }

        if (inBlockComment) {
            if (char === '*' && nextChar === '/') {
                inBlockComment = false;
                i += 2;
                continue;
            }
            i++;
            continue;
        }

        if (inSingleQuote) {
            result += char;
            if (char === "'") {
                if (nextChar === "'") {
                    result += nextChar;
                    i += 2;
                    continue;
                } else {
                    inSingleQuote = false;
                }
            }
            i++;
            continue;
        }

        if (inDoubleQuote) {
            result += char;
            if (char === '"') {
                if (nextChar === '"') {
                    result += nextChar;
                    i += 2;
                    continue;
                } else {
                    inDoubleQuote = false;
                }
            }
            i++;
            continue;
        }

        if (dollarTag !== null) {
            if (sql.startsWith(dollarTag, i)) {
                result += dollarTag;
                i += dollarTag.length;
                dollarTag = null;
                continue;
            }
            result += char;
            i++;
            continue;
        }

        if ((char === '-' && nextChar === '-') || char === '#') {
            inLineComment = true;
            i += (char === '-' ? 2 : 1);
            continue;
        }

        if (char === '/' && nextChar === '*') {
            inBlockComment = true;
            i += 2;
            continue;
        }

        if (char === "'") {
            inSingleQuote = true;
            result += char;
            i++;
            continue;
        }

        if (char === '"') {
            inDoubleQuote = true;
            result += char;
            i++;
            continue;
        }

        if (char === '$') {
            const dollarMatch = sql.slice(i).match(/^(\$[a-zA-Z0-9_]*\$)/);
            if (dollarMatch) {
                dollarTag = dollarMatch[1];
                result += dollarTag;
                i += dollarTag.length;
                continue;
            }
        }

        result += char;
        i++;
    }

    return result;
};

/**
 * Returns info about the query statement at caret position or selection
 */
window.getActiveStatementInfo = function (cm) {
    if (!cm) return null;

    // 1. Check selection
    const selection = cm.getSelection();
    if (selection && selection.trim().length > 0) {
        return {
            query: selection.trim(),
            cleanQuery: window.stripSqlComments(selection).trim(),
            isSelection: true,
            statementIndex: null,
            totalStatements: null,
            range: null
        };
    }

    const fullText = cm.getValue();
    const allStatements = window.parseSqlStatements(fullText);
    const executableStatements = allStatements.filter(s => s.cleanText.length > 0);

    if (executableStatements.length === 0) {
        return {
            query: fullText.trim(),
            cleanQuery: window.stripSqlComments(fullText).trim(),
            isSelection: false,
            statementIndex: 0,
            totalStatements: 0,
            range: null,
            allStatements: []
        };
    }

    const caretIndex = cm.indexFromPos(cm.getCursor());

    // Find statement containing cursor
    let targetIndex = -1;
    for (let i = 0; i < executableStatements.length; i++) {
        const s = executableStatements[i];
        if (caretIndex >= s.start && caretIndex <= s.end) {
            targetIndex = i;
            break;
        }
    }

    if (targetIndex === -1) {
        if (caretIndex < executableStatements[0].start) {
            targetIndex = 0;
        } else {
            targetIndex = executableStatements.length - 1;
        }
    }

    const targetStmt = executableStatements[targetIndex];
    const fromPos = cm.posFromIndex(targetStmt.start);
    const toPos = cm.posFromIndex(targetStmt.end);

    return {
        query: targetStmt.text.trim(),
        cleanQuery: targetStmt.cleanText,
        isSelection: false,
        statementIndex: targetIndex + 1,
        totalStatements: executableStatements.length,
        range: { from: fromPos, to: toPos },
        allStatements: executableStatements
    };
};

/**
 * Toggles line or block comments for CodeMirror editor selection or current line(s)
 */
window.toggleComment = function (cm, mode = 'line') {
    if (!cm) return;

    if (mode === 'line') {
        const selections = cm.listSelections();
        cm.operation(() => {
            selections.forEach(sel => {
                const fromLine = Math.min(sel.anchor.line, sel.head.line);
                const toLine = Math.max(sel.anchor.line, sel.head.line);

                let allCommented = true;
                let nonBlankCount = 0;
                for (let l = fromLine; l <= toLine; l++) {
                    const lineText = cm.getLine(l).trim();
                    if (lineText.length > 0) {
                        nonBlankCount++;
                        if (!lineText.startsWith('--')) {
                            allCommented = false;
                        }
                    }
                }

                if (nonBlankCount === 0) allCommented = false;

                for (let l = fromLine; l <= toLine; l++) {
                    const lineContent = cm.getLine(l);
                    if (allCommented) {
                        if (lineContent.trimStart().startsWith('-- ')) {
                            const idx = lineContent.indexOf('-- ');
                            cm.replaceRange('', { line: l, ch: idx }, { line: l, ch: idx + 3 });
                        } else if (lineContent.trimStart().startsWith('--')) {
                            const idx = lineContent.indexOf('--');
                            cm.replaceRange('', { line: l, ch: idx }, { line: l, ch: idx + 2 });
                        }
                    } else {
                        const firstNonSpace = lineContent.search(/\S/);
                        const insertPos = firstNonSpace === -1 ? 0 : firstNonSpace;
                        cm.replaceRange('-- ', { line: l, ch: insertPos });
                    }
                }
            });
        });
    } else if (mode === 'block') {
        const selection = cm.getSelection();
        if (selection) {
            const trimmed = selection.trim();
            if (trimmed.startsWith('/*') && trimmed.endsWith('*/')) {
                const unwrap = selection.replace(/^\s*\/\*\s?/, '').replace(/\s?\*\/\s*$/, '');
                cm.replaceSelection(unwrap);
            } else {
                cm.replaceSelection(`/* ${selection} */`);
            }
        } else {
            const cur = cm.getCursor();
            const line = cm.getLine(cur.line);
            const trimmed = line.trim();
            if (trimmed.startsWith('/*') && trimmed.endsWith('*/')) {
                const unwrap = line.replace(/^\s*\/\*\s?/, '').replace(/\s?\*\/\s*$/, '');
                cm.replaceRange(unwrap, { line: cur.line, ch: 0 }, { line: cur.line, ch: line.length });
            } else {
                cm.replaceRange(`/* ${line} */`, { line: cur.line, ch: 0 }, { line: cur.line, ch: line.length });
            }
        }
    }
};
