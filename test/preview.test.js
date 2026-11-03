const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getPreviewRange } = require('../src/preview');

test('preview ranges reach both ends of a file and limit each request', () => {
  assert.deepEqual(getPreviewRange(-20, 30, 10000), {start:0,end:30});
  assert.deepEqual(getPreviewRange(9990, 10100, 10000), {start:9990,end:10000});
  assert.deepEqual(getPreviewRange(5000, 9000, 10000), {start:5000,end:5200});
  assert.deepEqual(getPreviewRange(50, 20, 100), {start:50,end:50});
});

test('long lines wrap into scrollable rows and keep the selected match visible', () => {
  const {createRowMap,rowPosition,segmentBoundary,matchRow,resultSnippet} = require('../src/preview');
  const text='a'.repeat(155)+'something'+'b'.repeat(40);
  const doc={lineCount:2,lineAt:i=>({text:i===0?'short':text})};
  const map=createRowMap(doc,40);
  assert.equal(map.count,7);
  const match=matchRow(map,doc,1,155);
  assert.deepEqual(rowPosition(map,match),{line:1,part:3});
  assert.equal(text.slice(segmentBoundary(text,120),segmentBoundary(text,160)).endsWith('somet'),true);
  const snippet=resultSnippet({text,start:155,end:164});
  assert.equal(snippet.text.slice(snippet.start,snippet.end),'something');
  assert.ok(snippet.text.startsWith('…'));
  assert.deepEqual(rowPosition(map,map.count-1),{line:1,part:5});
});

test('wrapped rows do not split a surrogate pair', () => {
  const {createRowMap,segmentBoundary,matchRow} = require('../src/preview');
  const text='x'.repeat(19)+'😀'+'y'.repeat(20), doc={lineCount:1,lineAt:()=>({text})};
  const map=createRowMap(doc,20);
  assert.equal(segmentBoundary(text,20),19);
  assert.equal(matchRow(map,doc,0,19),1);
  assert.equal(text.slice(segmentBoundary(text,20),segmentBoundary(text,40)).startsWith('😀'),true);
});
