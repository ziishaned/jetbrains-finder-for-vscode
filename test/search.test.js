const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { rgPath } = require('@vscode/ripgrep');
const { buildArgs, parseMatch } = require('../src/search');

test('search flags and masks are passed as separate arguments', () => {
  const args=buildArgs({query:'-hello',mask:'*.js, *.ts',wholeWord:true,regex:false,caseSensitive:false},{'**/build':true,'**/keep':false});
  assert.deepEqual(args.slice(-3),['--','-hello','.']);
  assert.ok(args.includes('--fixed-strings')); assert.ok(args.includes('--word-regexp')); assert.ok(args.includes('!**/build')); assert.ok(args.includes('*.ts')); assert.ok(!args.includes('!**/keep'));
});
test('ripgrep finds matches and byte offsets convert to editor offsets', () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'finder-test-'));
  try {
    fs.writeFileSync(path.join(dir,'one.txt'),'😀 café target\nTARGET again\n');
    const run=spawnSync(rgPath,buildArgs({query:'target',mask:'*.txt'}),{cwd:dir,encoding:'utf8'});
    assert.equal(run.status,0,run.stderr);
    const events=run.stdout.trim().split('\n').map(JSON.parse).filter(e=>e.type==='match');
    assert.equal(events.length,2);
    const match=parseMatch(events[0].data,dir)[0];
    assert.equal(match.start,8); assert.equal(match.end,14); assert.equal(match.text.slice(match.start,match.end),'target');
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
test('invalid regular expressions are reported by the search engine', () => {
  const run=spawnSync(rgPath,buildArgs({query:'[',regex:true}),{cwd:os.tmpdir(),encoding:'utf8'});
  assert.equal(run.status,2); assert.match(run.stderr,/regex parse error/i);
});
