const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const Module=require('node:module');

test('overlay searches workspace and opens the chosen match',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'finder-overlay-'));
  const file=path.join(dir,'sample.txt'); fs.writeFileSync(file,'first line\nHello Finder\n');
  const handlers={}; let opened, picker;
  class Range {constructor(a,b,c,d){this.start={line:a,character:b};this.end={line:c,character:d};}}
  const vscode={ThemeIcon:class{constructor(id){this.id=id;}},Uri:{file:p=>({fsPath:p})},Range,Selection:class{constructor(start,end){this.start=start;this.end=end;}},TextEditorRevealType:{InCenter:1},
    workspace:{workspaceFolders:[{uri:{scheme:'file',fsPath:dir}}],getConfiguration:()=>({get:()=>({})}),asRelativePath:u=>path.basename(u.fsPath),openTextDocument:async u=>{opened=u.fsPath;return u;}},
    window:{createQuickPick:()=>picker={value:'',items:[],selectedItems:[],onDidChangeValue:f=>handlers.change=f,onDidTriggerButton:f=>handlers.button=f,onDidAccept:f=>handlers.accept=f,onDidHide:f=>handlers.hide=f,show(){},hide(){handlers.hide();},dispose(){}},showTextDocument:async()=>({revealRange(){}}),showErrorMessage:message=>{throw new Error(message);}}};
  const load=Module._load;
  Module._load=function(name,...args){return name==='vscode'?vscode:load.call(this,name,...args);};
  try{
    delete require.cache[require.resolve('../src/quickSearch')];
    require('../src/quickSearch').openQuickSearch('',()=>{});
    picker.value='finder';handlers.change();
    const deadline=Date.now()+5000; while(picker.busy && Date.now()<deadline) await new Promise(resolve=>setTimeout(resolve,20));
    assert.equal(picker.items.length,1);assert.equal(picker.items[0].description,'sample.txt:2');
    picker.selectedItems=[picker.items[0]];await handlers.accept();assert.equal(opened,file);
  }finally{Module._load=load;fs.rmSync(dir,{recursive:true,force:true});}
});
