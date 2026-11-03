const vscode = require('vscode');
const { spawn } = require('child_process');
const readline = require('readline');
const { rgPath } = require('@vscode/ripgrep');
const { buildArgs, parseMatch } = require('./search');

function openQuickSearch(initialQuery, openAdvanced) {
  const picker = vscode.window.createQuickPick();
  const options = {caseSensitive:false, wholeWord:false, regex:false, mask:''};
  let processes = [], generation = 0, timer, closed = false;
  const button = (icon, tooltip) => ({iconPath:new vscode.ThemeIcon(icon), tooltip});
  const caseButton=button('case-sensitive','Match Case: off');
  const wordButton=button('whole-word','Match Whole Word: off');
  const regexButton=button('regex','Use Regular Expression: off');
  const advancedButton=button('settings-gear','Open advanced search with preview and scope controls');
  picker.buttons=[caseButton, wordButton, regexButton, advancedButton];
  picker.title='Find in Files';
  picker.placeholder='Search text in the workspace';
  picker.matchOnDescription=false;
  picker.ignoreFocusOut=false;
  picker.value=initialQuery;
  function cancel() { generation++; clearTimeout(timer); for (const process of processes) process.kill(); processes=[]; }
  function schedule() {
    cancel(); picker.items=[]; picker.busy=false;
    if (!picker.value) { picker.title='Find in Files'; return; }
    const current=generation; picker.busy=true; picker.title='Find in Files — searching…';
    timer=setTimeout(()=>run(current),180);
  }
  function run(current) {
    const folders=vscode.workspace.workspaceFolders || [];
    if (!folders.length || folders.some(f=>f.uri.scheme!=='file')) {
      picker.busy=false; picker.title=folders.length?'Find in Files — file-based workspaces only':'Find in Files — open a folder first'; return;
    }
    let remaining=folders.length, truncated=false, count=0; const results=[], files=new Set(), errors=[];
    const opts={...options,query:picker.value};
    function finish(){
      if(current!==generation || closed) return;
      picker.busy=false; processes=[];
      picker.items=results;
      picker.title=errors.length ? `Find in Files — ${errors[0]}` : `Find in Files — ${truncated?'first ':''}${count} ${count===1?'match':'matches'} in ${files.size} ${files.size===1?'file':'files'}${truncated?' (limit reached)':''}`;
    }
    for(const folder of folders){
      const root=folder.uri.fsPath;
      const excludes=vscode.workspace.getConfiguration('search',folder.uri).get('exclude',{});
      const child=spawn(rgPath,buildArgs(opts,excludes),{cwd:root,windowsHide:true}); processes.push(child);
      let stderr='', batchTimer;
      const flush=()=>{batchTimer=undefined; if(current===generation && !closed) picker.items=[...results];};
      readline.createInterface({input:child.stdout}).on('line',line=>{
        if(current!==generation || truncated || closed) return;
        try {
          const event=JSON.parse(line); if(event.type!=='match') return;
          for(const match of parseMatch(event.data,root)){
            if(count>=1000){truncated=true;for(const process of processes)process.kill();break;}
            count++;files.add(match.file);
            results.push({label:match.text || ' ', description:`${vscode.workspace.asRelativePath(vscode.Uri.file(match.file))}:${match.line+1}`, alwaysShow:true, highlights:{label:[[match.start,match.end]]}, match});
          }
          if(!batchTimer)batchTimer=setTimeout(flush,80);
        } catch (_) { /* Ignore malformed ripgrep output. */ }
      });
      child.stderr.on('data',data=>{stderr+=data.toString();});
      child.on('error',error=>errors.push(error.message));
      child.on('close',code=>{clearTimeout(batchTimer);if(code>1 && stderr)errors.push(stderr.trim().split('\n')[0]);if(--remaining===0)finish();});
    }
  }
  picker.onDidChangeValue(schedule);
  picker.onDidTriggerButton(button=>{
    if(button===advancedButton){const query=picker.value; picker.hide(); openAdvanced(query);return;}
    if(button===caseButton){options.caseSensitive=!options.caseSensitive;caseButton.tooltip=`Match Case: ${options.caseSensitive?'on':'off'}`;}
    if(button===wordButton){options.wholeWord=!options.wholeWord;wordButton.tooltip=`Match Whole Word: ${options.wholeWord?'on':'off'}`;}
    if(button===regexButton){options.regex=!options.regex;regexButton.tooltip=`Use Regular Expression: ${options.regex?'on':'off'}`;}
    picker.buttons=[caseButton,wordButton,regexButton,advancedButton]; schedule();
  });
  picker.onDidAccept(async()=>{
    const item=picker.selectedItems[0]; if(!item?.match)return;
    const match=item.match; picker.hide();
    try {const doc=await vscode.workspace.openTextDocument(vscode.Uri.file(match.file));const editor=await vscode.window.showTextDocument(doc,{preview:false});const range=new vscode.Range(match.line,match.start,match.line,match.end);editor.selection=new vscode.Selection(range.start,range.end);editor.revealRange(range,vscode.TextEditorRevealType.InCenter);}
    catch(error){vscode.window.showErrorMessage(`Unable to open result: ${error.message}`);}
  });
  picker.onDidHide(()=>{closed=true;cancel();picker.dispose();});
  picker.show(); if(initialQuery)schedule();
}
module.exports={openQuickSearch};
