const editor = document.getElementById('editor');

editor.addEventListener('keydown', (e) => {

    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        window.runQuery();
    }

    if (e.key === 'Tab') {
        if (!document.getElementById('autocomplete').classList.contains('hidden')) return;
        e.preventDefault();
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        const tabNode = document.createTextNode("    ");
        range.insertNode(tabNode);
        range.setStartAfter(tabNode);
        range.setEndAfter(tabNode);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    if (e.key === 'Enter') {
        e.preventDefault();

        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        range.deleteContents();

        const br = document.createElement('br');
        const textNode = document.createTextNode("");

        range.insertNode(br);
        br.after(textNode);

        range.setStart(textNode, 0);
        range.setEnd(textNode, 0);

        selection.removeAllRanges();
        selection.addRange(range);

        editor.scrollTop = editor.scrollHeight;
    }
});
