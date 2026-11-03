const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createSyntax, readTheme, customizationRules } = require('../src/syntax');

test('theme includes and user token overrides color TextMate tokens', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'finder-syntax-'));
  try {
    fs.writeFileSync(path.join(dir, 'base.json'), '{"tokenColors":[{"scope":"string","settings":{"foreground":"#112233"}}]}');
    fs.writeFileSync(path.join(dir, 'theme.json'), '{"include":"base.json","tokenColors":[{"scope":"keyword","settings":{"foreground":"#445566"}}]}');
    fs.writeFileSync(path.join(dir, 'grammar.json'), JSON.stringify({scopeName:'source.demo',patterns:[{name:'keyword.demo',match:'\\bhello\\b'},{name:'string.demo',begin:'"',end:'"'}]}));
    const extension = {extensionPath:dir,packageJSON:{contributes:{themes:[{id:'Demo',path:'theme.json'}],languages:[{id:'demo',extensions:['.demo']}],grammars:[{language:'demo',scopeName:'source.demo',path:'grammar.json'}]}}};
    const vscode = {extensions:{all:[extension]},workspace:{getConfiguration: section => ({get: key => section === 'workbench' ? 'Demo' : key === 'tokenColorCustomizations' ? {strings:'#ABCDEF','[Demo]':{keywords:'#010203'}} : undefined})}};
    assert.equal(readTheme(path.join(dir,'theme.json')).length, 2);
    assert.equal(customizationRules({strings:'#ABCDEF','[Demo]':{keywords:'#010203'}},'Demo').length, 2);
    const syntax = createSyntax(vscode);
    const grammar = await syntax.grammarFor('file.demo');
    const {spans} = syntax.tokenize(grammar, 'hello "world"', null);
    assert.equal(spans.find(span=>span.start===0).color.toUpperCase(), '#010203');
    assert.equal(spans.find(span=>span.start===6).color.toUpperCase(), '#ABCDEF');
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
