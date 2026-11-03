const vscode = acquireVsCodeApi();
const app = document.getElementById('app');
app.innerHTML = `<main class="dialog"><header><div class="search-field"><span class="codicon codicon-search search-icon" aria-hidden="true"></span><input id="query" aria-label="Search text" autocomplete="off" spellcheck="false"><button class="toggle" id="clearQuery" title="Clear search" aria-label="Clear search" hidden><span class="codicon codicon-close" aria-hidden="true"></span></button><button class="toggle" id="case" title="Match case" aria-label="Match case" aria-pressed="false"><span class="codicon codicon-case-sensitive" aria-hidden="true"></span></button><button class="toggle" id="word" title="Match whole word" aria-label="Match whole word" aria-pressed="false"><span class="codicon codicon-whole-word" aria-hidden="true"></span></button><button class="toggle" id="regex" title="Regular expression" aria-label="Regular expression" aria-pressed="false"><span class="codicon codicon-regex" aria-hidden="true"></span></button></div></header><div class="replace-field"><span class="codicon codicon-replace search-icon" aria-hidden="true"></span><input id="replacement" aria-label="Replace text" placeholder="Replace" autocomplete="off" spellcheck="false"></div><div class="scopes"><button class="scope active" data-scope="project">In Project</button><button class="scope" data-scope="folder">Workspace Folder</button><button class="scope" data-scope="directory">Directory</button><div id="roots" class="workspace-dropdown" hidden><button id="rootButton" class="workspace-trigger" aria-label="Workspace folder" aria-haspopup="listbox" aria-expanded="false"><span id="rootLabel"></span><span class="codicon codicon-chevron-down" aria-hidden="true"></span></button><div id="rootOptions" class="workspace-options" role="listbox" aria-label="Workspace folder" hidden></div></div><button id="directory" class="directory-picker" aria-label="Choose search directory" title="Choose search directory" hidden><span class="codicon codicon-folder-opened" aria-hidden="true"></span><span id="directoryPath"></span></button><span id="status" role="status"></span></div><div id="results" class="empty-state" role="listbox" aria-label="Search results" tabindex="0"><div class="empty">Type search query to find in files</div></div><div class="splitter" id="splitter" role="separator" aria-label="Resize search results" aria-orientation="horizontal" aria-controls="results" aria-valuemin="0" aria-valuemax="100" aria-valuenow="34" tabindex="0" hidden></div><div class="preview-head" id="previewHead" hidden>Preview</div><div class="preview" id="preview" hidden><div class="empty">Select a result to preview its context.</div></div><footer><label class="new-tab"><input id="newTab" type="checkbox"> <span>Open results in new tab</span></label><div class="footer-actions"><button id="native" disabled>Open in Search View</button><button id="replaceAll" disabled>Replace All</button><button id="replace" disabled>Replace</button></div></footer></main>`;
const $ = id => document.getElementById(id);
const query=$('query'), results=$('results'), preview=$('preview'), splitter=$('splitter');
const savedState=vscode.getState()||{};
let previewRatio=Number.isFinite(savedState.previewRatio)?Math.max(.08,Math.min(.85,savedState.previewRatio)):.47;
preview.style.height=`${previewRatio*100}%`;
let items=[], selected=-1, scope='project', timer, workspaceFolders=[], selectedRoot='', searchComplete=false, searchTruncated=false, searchFailed=false;
let previewInfo, previewSerial=0, previewFrame, selectedDirectory='';
function chooseDirectory(){ vscode.postMessage({type:'chooseDirectory'}); }

const options=()=>({query:query.value,caseSensitive:$('case').getAttribute('aria-pressed')==='true',wholeWord:$('word').getAttribute('aria-pressed')==='true',regex:$('regex').getAttribute('aria-pressed')==='true',scope,root:selectedRoot,directory:selectedDirectory});
function updateReplaceButtons(){ $('replace').disabled=!searchComplete||searchFailed||selected<0; $('replaceAll').disabled=!searchComplete||searchFailed||searchTruncated||!items.length; }
function schedule(){ searchComplete=false; searchTruncated=false; searchFailed=false; updateReplaceButtons(); $('clearQuery').hidden=!query.value; previewInfo=undefined; previewSerial++; clearTimeout(timer); items=[]; selected=-1; results.classList.add('empty-state'); results.innerHTML=query.value?'<div class="empty">Searching…</div>':'<div class="empty">Type search query to find in files</div>'; preview.hidden=true; splitter.hidden=true; $('previewHead').hidden=true; $('native').disabled=!query.value; $('status').textContent=''; preview.innerHTML='<div class="empty">Select a result to preview its context.</div>'; $('previewHead').textContent='Preview'; timer=setTimeout(()=>vscode.postMessage({type:'search',options:options()}),180); }
function select(index){if (!items.length) return; previewInfo=undefined; previewSerial++; selected=Math.max(0,Math.min(index,items.length-1)); updateReplaceButtons(); for(const el of results.querySelectorAll('.result')) el.classList.toggle('selected',Number(el.dataset.id)===selected); results.querySelector(`[data-id="${selected}"]`)?.scrollIntoView({block:'nearest'}); vscode.postMessage({type:'preview',id:selected,columns:previewColumns()});}
function renderThemed(container,text,spans,start,end){
  if(!Array.isArray(spans))spans=[];
  container.textContent='';
  const boundaries=new Set([0,text.length]);
  for(const span of spans){boundaries.add(Math.max(0,Math.min(text.length,span.start)));boundaries.add(Math.max(0,Math.min(text.length,span.end)));}
  if(Number.isInteger(start)&&Number.isInteger(end)){boundaries.add(Math.max(0,Math.min(text.length,start)));boundaries.add(Math.max(0,Math.min(text.length,end)));}
  const points=[...boundaries].sort((a,b)=>a-b);let index=0;
  for(let i=0;i<points.length-1;i++){
    const a=points[i],b=points[i+1];if(a===b)continue;
    while(index+1<spans.length&&spans[index].end<=a)index++;
    const token=spans[index], part=document.createElement(start<b&&end>a?'mark':'span');
    part.textContent=text.slice(a,b);
    if(token&&token.start<=a&&token.end>=b){if(/^#[0-9a-f]{6,8}$/i.test(token.color||''))part.style.color=token.color;if(token.bold)part.style.fontWeight='bold';if(token.italic)part.style.fontStyle='italic';if(token.underline||token.strike)part.style.textDecoration=[token.underline?'underline':'',token.strike?'line-through':''].filter(Boolean).join(' ');}
    container.append(part);
  }
}
let resizing=false, previewResizeTimer;
function resizePreview(requestedHeight){
  const dialogHeight=document.querySelector('.dialog').clientHeight;
  const available=preview.getBoundingClientRect().height+results.getBoundingClientRect().height;
  if(!dialogHeight||available<=0)return;
  const minimum=Math.min(60,available/3), maximum=Math.max(minimum,available-minimum);
  const height=Math.max(minimum,Math.min(maximum,requestedHeight));
  previewRatio=height/dialogHeight;preview.style.height=`${previewRatio*100}%`;
  splitter.setAttribute('aria-valuenow',String(Math.round(100*(available-height)/available)));
}
function savePreviewSize(){vscode.setState({...vscode.getState(),previewRatio});}
splitter.addEventListener('pointerdown',event=>{
  if(event.button!==0)return;
  event.preventDefault();resizing=true;splitter.classList.add('dragging');splitter.setPointerCapture(event.pointerId);
  const initialY=event.clientY,initialHeight=preview.getBoundingClientRect().height;
  const move=e=>resizePreview(initialHeight+initialY-e.clientY);
  const finish=()=>{resizing=false;splitter.classList.remove('dragging');savePreviewSize();clearTimeout(previewResizeTimer);if(previewInfo)requestPreviewLines();splitter.removeEventListener('pointermove',move);splitter.removeEventListener('pointerup',finish);splitter.removeEventListener('pointercancel',finish);splitter.removeEventListener('lostpointercapture',finish);};
  splitter.addEventListener('pointermove',move);splitter.addEventListener('pointerup',finish);splitter.addEventListener('pointercancel',finish);splitter.addEventListener('lostpointercapture',finish);
});
splitter.addEventListener('keydown',event=>{
  if(event.key!=='ArrowUp'&&event.key!=='ArrowDown')return;
  event.preventDefault();resizePreview(preview.getBoundingClientRect().height+(event.key==='ArrowUp'?16:-16));savePreviewSize();
});
function previewColumns(){
  const style=getComputedStyle(preview), canvas=document.createElement('canvas'), ctx=canvas.getContext('2d');
  ctx.font=`${style.fontSize} ${style.fontFamily}`;
  return Math.max(20,Math.min(500,Math.floor((preview.clientWidth-84)/Math.max(1,ctx.measureText('M').width))));
}
function lineHeight(){return (parseFloat(getComputedStyle(preview).fontSize)||13)*1.65;}
function requestPreviewLines(){
  if(!previewInfo||previewInfo.id!==selected)return;
  const height=lineHeight(), start=Math.max(0,Math.floor(preview.scrollTop/height)-12);
  const end=Math.min(previewInfo.lineCount,start+Math.min(200,Math.ceil(preview.clientHeight/height)+26));
  vscode.postMessage({type:'previewLines',id:selected,start,end,serial:++previewSerial});
}
preview.addEventListener('scroll',()=>{if(previewFrame)cancelAnimationFrame(previewFrame);previewFrame=requestAnimationFrame(()=>{previewFrame=undefined;requestPreviewLines();});});
new ResizeObserver(()=>{
  if(!previewInfo)return;
  const columns=previewColumns();
  if(columns!==previewInfo.columns){previewInfo=undefined;previewSerial++;vscode.postMessage({type:'preview',id:selected,columns});}
  else if(resizing){clearTimeout(previewResizeTimer);previewResizeTimer=setTimeout(requestPreviewLines,100);}
  else requestPreviewLines();
}).observe(preview);
function drawPreview(m){
  const height=lineHeight(), info=previewInfo;
  const fragment=document.createDocumentFragment();
  const top=document.createElement('div');top.style.height=`${m.first*height}px`;fragment.append(top);
  for(const line of m.lines){const row=document.createElement('div');row.className='line'+(line.active?' active-line':'');const num=document.createElement('span');num.className='number';num.textContent=line.number;if(line.continuation){const marker=document.createElement('span');marker.className='wrap-start';marker.setAttribute('aria-hidden','true');row.append(num,marker);}else row.append(num);const text=document.createElement('span');text.className='code';text.dataset.file=info.label;renderThemed(text,line.text,line.spans,line.active?info.start-line.from:undefined,line.active?info.end-line.from:undefined);row.append(text);if(line.wraps){const marker=document.createElement('span');marker.className='wrap-end';marker.textContent='↩';marker.setAttribute('aria-hidden','true');row.append(marker);}fragment.append(row);}
  const bottom=document.createElement('div');bottom.style.height=`${Math.max(0,info.lineCount-m.first-m.lines.length)*height}px`;fragment.append(bottom);
  preview.replaceChildren(fragment);
}
function append(item){ const row=document.createElement('div'); row.className='result'; row.dataset.id=item.id; row.setAttribute('role','option'); const content=document.createElement('span'); content.className='result-text'; renderThemed(content,item.snippet.text,[],item.snippet.start,item.snippet.end); const file=document.createElement('span'); file.className='file'; file.textContent=`${item.label.split(/[\\/]/).pop()} ${item.line+1}`; file.title=`${item.label}:${item.line+1}`; row.append(content,file); row.addEventListener('click',()=>select(item.id)); row.addEventListener('dblclick',()=>vscode.postMessage({type:'open',id:item.id})); results.append(row); }
for(const id of ['case','word','regex']) $(id).addEventListener('click',()=>{$(id).setAttribute('aria-pressed',String($(id).getAttribute('aria-pressed')!=='true'));schedule();});
query.addEventListener('input',schedule); $('clearQuery').addEventListener('click',()=>{query.value='';schedule();query.focus();}); $('directory').addEventListener('click',chooseDirectory);
function closeRoots(restoreFocus=false){
  const list=$('rootOptions');if(list.hidden)return;
  list.hidden=true;$('rootButton').setAttribute('aria-expanded','false');if(restoreFocus)$('rootButton').focus();
}
function chooseRoot(index){
  const folder=workspaceFolders[index];if(!folder)return;
  selectedRoot=folder.uri;$('rootLabel').textContent=folder.name;closeRoots(true);schedule();
}
function openRoots(){
  const list=$('rootOptions');if(!workspaceFolders.length)return;
  list.textContent='';
  workspaceFolders.forEach((folder,index)=>{const option=document.createElement('div');option.className='workspace-option';option.role='option';option.tabIndex=-1;option.textContent=folder.name;option.setAttribute('aria-selected',String(folder.uri===selectedRoot));option.addEventListener('pointermove',()=>option.focus({preventScroll:true}));option.addEventListener('click',()=>chooseRoot(index));list.append(option);});
  const box=$('rootButton').getBoundingClientRect();list.style.left=`${box.left}px`;list.style.top=`${box.bottom}px`;list.style.width=`${box.width}px`;
  list.hidden=false;$('rootButton').setAttribute('aria-expanded','true');
  const index=Math.max(0,workspaceFolders.findIndex(folder=>folder.uri===selectedRoot));list.children[index].focus();
}
$('rootButton').addEventListener('click',()=>{if($('rootOptions').hidden)openRoots();else closeRoots();});
$('rootButton').addEventListener('keydown',e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();openRoots();}});
$('rootOptions').addEventListener('keydown',e=>{const list=$('rootOptions'),options=[...list.children],index=options.indexOf(document.activeElement);if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeRoots(true);}else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();options[Math.max(0,Math.min(options.length-1,index+(e.key==='ArrowDown'?1:-1)))].focus();}else if(e.key==='Home'||e.key==='End'){e.preventDefault();options[e.key==='Home'?0:options.length-1].focus();}else if(e.key==='Enter'||e.key===' '){e.preventDefault();chooseRoot(index);}else if(e.key==='Tab'){closeRoots();}});
document.addEventListener('pointerdown',e=>{if(!$('roots').contains(e.target))closeRoots();});
window.addEventListener('resize',()=>closeRoots());
function setScope(value){closeRoots();scope=value; document.querySelectorAll('.scope').forEach(b=>b.classList.toggle('active',b.dataset.scope===scope)); $('roots').hidden=scope!=='folder'; $('directory').hidden=scope!=='directory'; schedule();}
for(const button of document.querySelectorAll('.scope')) button.addEventListener('click',()=>{if(button.dataset.scope==='directory'&&!selectedDirectory){chooseDirectory();return;}setScope(button.dataset.scope);});
$('replace').onclick=()=>vscode.postMessage({type:'replace',id:selected,replacement:$('replacement').value});
$('replaceAll').onclick=()=>vscode.postMessage({type:'replace',all:true,replacement:$('replacement').value});
$('native').onclick=()=>vscode.postMessage({type:'native',options:options(),newTab:$('newTab').checked});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();vscode.postMessage({type:'close'});} else if(e.key==='ArrowDown' && (document.activeElement===query || document.activeElement===results)){e.preventDefault();select(selected+1);} else if(e.key==='ArrowUp' && (document.activeElement===query || document.activeElement===results)){e.preventDefault();select(selected-1);} else if(e.key==='Enter' && selected>=0 && (document.activeElement===query || document.activeElement===results)){e.preventDefault();vscode.postMessage({type:'open',id:selected});}});
window.addEventListener('message',event=>{const m=event.data;
 if(m.type==='init'){selectedDirectory=m.directory||'';$('directoryPath').textContent=selectedDirectory;$('directory').title=selectedDirectory||'Choose search directory';workspaceFolders=m.folders;selectedRoot=workspaceFolders[0]?.uri||'';$('rootLabel').textContent=workspaceFolders[0]?.name||'No workspace folder';$('rootButton').disabled=!workspaceFolders.length; query.value=m.query||'';query.focus();if(query.value)schedule();}
 if(m.type==='directorySelected'){selectedDirectory=m.path;$('directoryPath').textContent=m.path;$('directory').title=m.path;setScope('directory');}
 if(m.type==='focus'){if(m.query){query.value=m.query;schedule();}query.focus();query.select();}
 if(m.type==='results'){searchComplete=!!m.done;searchFailed=false;searchTruncated=false;updateReplaceButtons();items=[];selected=-1;results.classList.add('empty-state');results.innerHTML=m.done?'<div class="empty">Type search query to find in files</div>':'<div class="empty">Searching…</div>';preview.hidden=true;splitter.hidden=true;$('previewHead').hidden=true;$('status').textContent=m.done?'':'Searching…';}
 if(m.type==='append'){if(!items.length){results.textContent='';results.classList.remove('empty-state');preview.hidden=false;splitter.hidden=false;$('previewHead').hidden=false;}for(const item of m.items){items.push(item);append(item);} vscode.postMessage({type:'highlightResults',ids:m.items.map(item=>item.id)}); $('status').textContent=`${m.count} matches in ${m.files} files`;if(selected<0 && items.length)select(0);}
 if(m.type==='done'){ searchComplete=true;searchTruncated=!!m.truncated;searchFailed=!!m.error;updateReplaceButtons(); $('status').textContent=`${m.truncated?'First ':''}${m.count} ${m.count===1?'match':'matches'} in ${m.files} ${m.files===1?'file':'files'}${m.truncated?' (limit reached)':''}`;if(m.error){const e=document.createElement('div');e.className='error';e.textContent=m.error;results.append(e);}else if(!m.count)results.innerHTML='<div class="empty">Nothing found</div>';}
 if(m.type==='replacing'){searchComplete=false;updateReplaceButtons();$('status').textContent='Replacing…';}
 if(m.type==='error'){searchFailed=true;updateReplaceButtons();$('status').textContent='Search unavailable';results.classList.add('empty-state');results.textContent=m.message;}
 if(m.type==='previewInfo' && m.id===selected){
   previewInfo=m;
   const previewHead=$('previewHead'), parts=m.label.split(/[\\/]/), name=parts.pop(), filename=document.createElement('span'), folder=document.createElement('span');
   filename.className='preview-filename'; filename.textContent=name; folder.className='preview-folder'; folder.textContent=parts.join('/');
   previewHead.replaceChildren(filename,folder); previewHead.title=m.label;preview.textContent='';
   const placeholder=document.createElement('div');placeholder.style.height=`${m.lineCount*lineHeight()}px`;preview.append(placeholder);
   preview.scrollTop=Math.max(0,(m.line+0.5)*lineHeight()-preview.clientHeight/2);requestPreviewLines();
 }
 if(m.type==='previewLines' && previewInfo && m.id===selected && m.serial===previewSerial)drawPreview(m);
 if(m.type==='resultSyntax'){for(const result of m.items){const item=items[result.id],element=results.querySelector(`[data-id="${result.id}"] .result-text`);if(item&&element)renderThemed(element,item.snippet.text,result.spans,item.snippet.start,item.snippet.end);}}
 if(m.type==='refreshSyntax'){if(items.length)vscode.postMessage({type:'highlightResults',ids:items.map(item=>item.id)});if(previewInfo)requestPreviewLines();}
 if(m.type==='previewError' && m.id===selected)preview.textContent=m.message;
});
vscode.postMessage({type:'ready'});
