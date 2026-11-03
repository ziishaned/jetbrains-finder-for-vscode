const vscode = require('vscode');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');
const { rgPath } = require('@vscode/ripgrep');
const { buildArgs, parseMatch } = require('./search');
const { openQuickSearch } = require('./quickSearch');
const { createSyntax } = require('./syntax');
const { getPreviewRange } = require('./preview');

function activate(context) {
  let panel, processes = [], generation = 0, matches = [], originalColumn;
  const syntax = createSyntax(vscode);
  let syntaxGeneration = 0;
  const refreshSyntax = () => { syntaxGeneration++; syntax.reset(); panel?.webview.postMessage({type:'refreshSyntax'}); };
  context.subscriptions.push(vscode.window.onDidChangeActiveColorTheme(refreshSyntax), vscode.workspace.onDidChangeConfiguration(event => { if (event.affectsConfiguration('workbench.colorTheme') || event.affectsConfiguration('editor.tokenColorCustomizations')) refreshSyntax(); }), vscode.extensions.onDidChange(refreshSyntax));
  function stop() { generation++; for (const p of processes) p.kill(); processes = []; }
  async function search(options) {
    stop(); const current = generation; matches = [];
    const folders = vscode.workspace.workspaceFolders || [];
    if (!options.query) { panel.webview.postMessage({ type: 'results', items: [], count: 0, done: true }); return; }
    if (!folders.length) { panel.webview.postMessage({ type: 'error', message: 'Open a folder or workspace to search.' }); return; }
    const roots = options.scope === 'folder' && options.root ? folders.filter(f => f.uri.toString() === options.root) : folders;
    if (!roots.length || roots.some(f => f.uri.scheme !== 'file')) { panel.webview.postMessage({type:'error', message:'This search currently supports local folders and remote workspaces with file-based folders.'}); return; }
    let remaining = roots.length, truncated = false, errors = [];
    const files = new Set();
    panel.webview.postMessage({type:'results', items:[], count:0, done:false});
    for (const folder of roots) {
      let root = folder.uri.fsPath;
      if (options.directory && options.scope === 'directory') {
        const candidate = path.resolve(root, options.directory);
        if (candidate !== root && !candidate.startsWith(root + path.sep)) { errors.push('Directory must be inside a workspace folder.'); if (--remaining === 0) finish(); continue; }
        root = candidate;
      }
      const config = vscode.workspace.getConfiguration('search', folder.uri).get('exclude', {});
      const args = buildArgs(options, config);
      const child = spawn(rgPath, args, {cwd:root, windowsHide:true}); processes.push(child);
      let stderr = '', batch = [], timer;
      const flush = () => { clearTimeout(timer); timer = undefined; if (batch.length && current === generation) { panel.webview.postMessage({type:'append', items:batch, count:matches.length, files:files.size}); batch=[]; } };
      readline.createInterface({input:child.stdout}).on('line', line => {
        if (current !== generation || truncated) return;
        try {
          const event = JSON.parse(line); if (event.type !== 'match') return;
          for (const item of parseMatch(event.data, root)) {
            if (matches.length >= 1000) { truncated = true; for (const p of processes) p.kill(); break; }
            item.id = matches.length; item.label = vscode.workspace.asRelativePath(vscode.Uri.file(item.file)); matches.push(item); files.add(item.file); batch.push(item);
          }
          if (!timer) timer = setTimeout(flush, 60);
        } catch (_) { /* Ignore malformed ripgrep output. */ }
      });
      child.stderr.on('data', chunk => { stderr += chunk.toString(); });
      child.on('error', e => { errors.push(e.message); });
      child.on('close', code => { flush(); if (code > 1 && stderr) errors.push(stderr.trim()); if (--remaining === 0) finish(); });
    }
    function finish() { if (current !== generation) return; processes = []; panel.webview.postMessage({type:'done', count:matches.length, files:files.size, truncated, error:errors.join('\n')}); }
  }
  async function highlightResults(ids) {
    const active = syntaxGeneration, current = generation;
    const batch = [];
    for (const id of ids.slice(0, 1000)) {
      const item = matches[id]; if (!item || item.text.length > 20000) continue;
      try {
        const grammar = await syntax.grammarFor(item.file);
        if (active !== syntaxGeneration || current !== generation || !panel) return;
        if (grammar) batch.push({id, spans:syntax.tokenize(grammar, item.text, null).spans});
      } catch { /* Keep the webview fallback when a grammar fails. */ }
      if (batch.length >= 40) { panel.webview.postMessage({type:'resultSyntax', items:batch.splice(0)}); }
    }
    if (batch.length && panel && current === generation && active === syntaxGeneration) panel.webview.postMessage({type:'resultSyntax', items:batch});
  }
  let previewSequence = 0, previewRequest = 0;
  async function preview(id) {
    const item = matches[id], sequence = ++previewSequence; if (!item || !panel) return;
    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(item.file));
      if (matches[id] !== item || !panel || sequence !== previewSequence) return;
      panel.webview.postMessage({type:'previewInfo', id, label:item.label, lineCount:doc.lineCount, line:item.line, start:item.start, end:item.end});
    } catch (error) { if (panel && sequence === previewSequence) panel.webview.postMessage({type:'previewError', id, message:error.message}); }
  }
  async function previewLines(id, requestedStart, requestedEnd, serial) {
    const item = matches[id], sequence = previewSequence, current = generation, active = syntaxGeneration, request = ++previewRequest;
    if (!item || !panel) return;
    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(item.file));
      const range = getPreviewRange(requestedStart, requestedEnd, doc.lineCount);
      const lines = [];
      for (let i=range.start; i<range.end; i++) lines.push({number:i+1, text:doc.lineAt(i).text, active:i===item.line});
      try {
        const grammar = await syntax.grammarFor(item.file, doc.languageId);
        if (grammar) {
          let state = null, total = 0;
          const contextStart = range.start < 5000 ? 0 : range.start;
          for (let i=contextStart; i<range.end; i++) {
            if (i % 200 === 0) {
              await new Promise(resolve => setImmediate(resolve));
              if (sequence !== previewSequence || request !== previewRequest || active !== syntaxGeneration || current !== generation || !panel) return;
            }
            const text = doc.lineAt(i).text; total += text.length;
            if (total > 2000000 || text.length > 20000) { state = null; continue; }
            const tokenized = syntax.tokenize(grammar, text, state); state = tokenized.state;
            if (i >= range.start) lines[i-range.start].spans = tokenized.spans;
          }
        }
      } catch { /* Use the webview fallback if highlighting fails. */ }
      if (sequence === previewSequence && request === previewRequest && current === generation && active === syntaxGeneration && matches[id] === item && panel) panel.webview.postMessage({type:'previewLines', id, serial, first:range.start, lines});
    } catch (error) { if (panel && sequence === previewSequence && request === previewRequest) panel.webview.postMessage({type:'previewError',id,message:error.message}); }
  }
  context.subscriptions.push(vscode.commands.registerCommand('jetbrainsFinder.quick', () => {
    const selected = vscode.window.activeTextEditor?.document.getText(vscode.window.activeTextEditor.selection) || '';
    openQuickSearch(selected.includes('\n') ? '' : selected, query => vscode.commands.executeCommand('jetbrainsFinder.open', query));
  }));
  context.subscriptions.push(vscode.commands.registerCommand('jetbrainsFinder.open', (initialQuery) => {
    const selected = typeof initialQuery === 'string' ? initialQuery : (vscode.window.activeTextEditor?.document.getText(vscode.window.activeTextEditor.selection) || '');
    if (panel) { panel.reveal(); panel.webview.postMessage({type:'focus', query:selected.includes('\n') ? '' : selected}); return; }
    originalColumn = vscode.window.activeTextEditor?.viewColumn || vscode.ViewColumn.One;
    panel = vscode.window.createWebviewPanel('jetbrainsFinder', 'Find in Files', vscode.ViewColumn.Active, {enableScripts:true, retainContextWhenHidden:true, localResourceRoots:[vscode.Uri.joinPath(context.extensionUri,'media'), vscode.Uri.joinPath(context.extensionUri,'node_modules','@vscode','codicons','dist')]});
    const webview = panel.webview, script = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri,'media','main.js')), style = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri,'media','style.css'));
    const icons = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri,'node_modules','@vscode','codicons','dist','codicon.css'));
    const syntax = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri,'media','syntax.js'));
    const nonce = require('crypto').randomBytes(16).toString('base64');
    webview.html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; font-src ${webview.cspSource}; script-src 'nonce-${nonce}';"><link rel="stylesheet" href="${icons}"><link rel="stylesheet" href="${style}"></head><body><div id="app"></div><script nonce="${nonce}" src="${syntax}"></script><script nonce="${nonce}" src="${script}"></script></body></html>`;
    panel.onDidDispose(() => {stop(); panel = undefined;});
    webview.onDidReceiveMessage(async message => {
      if (message.type === 'ready') webview.postMessage({type:'init', folders:(vscode.workspace.workspaceFolders || []).map(f=>({name:f.name, uri:f.uri.toString()})), query:selected.includes('\n')?'':selected});
      else if (message.type === 'search') search(message.options);
      else if (message.type === 'preview') preview(message.id);
      else if (message.type === 'previewLines' && Number.isInteger(message.id)) previewLines(message.id, message.start, message.end, message.serial);
      else if (message.type === 'highlightResults' && Array.isArray(message.ids)) highlightResults(message.ids.filter(Number.isInteger));
      else if (message.type === 'open') { const item=matches[message.id]; if (!item) return; const column=originalColumn; panel.dispose(); const doc=await vscode.workspace.openTextDocument(vscode.Uri.file(item.file)); const editor=await vscode.window.showTextDocument(doc,{viewColumn:column, preview:false}); const range=new vscode.Range(item.line,item.start,item.line,item.end); editor.selection=new vscode.Selection(range.start,range.end); editor.revealRange(range,vscode.TextEditorRevealType.InCenter); }
      else if (message.type === 'close') panel?.dispose();
      else if (message.type === 'native') { panel.dispose(); await vscode.commands.executeCommand('workbench.action.findInFiles',{query:message.options.query,isRegex:message.options.regex,isCaseSensitive:message.options.caseSensitive,matchWholeWord:message.options.wholeWord,filesToInclude:message.options.mask}); }
    });
  }));
}
module.exports = { activate };
