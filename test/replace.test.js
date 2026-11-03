const { test } = require('node:test');
const assert = require('node:assert/strict');
const { replacementFor } = require('../src/replace');

test('literal replacements preserve dollar signs and can remove text', () => {
  const item = {text:'one one', start:4, end:7};
  assert.equal(replacementFor(item, {regex:false}, '$1'), '$1');
  assert.equal(replacementFor(item, {regex:false}, ''), '');
});
test('regex replacements use captures at the selected occurrence', () => {
  const item = {text:'cat cat!', start:4, end:7};
  assert.equal(replacementFor(item, {regex:true, query:'(c)(at)', caseSensitive:true}, '$2$1'), 'atc');
  assert.equal(replacementFor(item, {regex:true, query:'(?<animal>cat)', caseSensitive:true}, '$<animal>$$'), 'cat$');
});
test('replacement refuses a match that cannot be reproduced', () => {
  assert.throws(() => replacementFor({text:'cat', start:0, end:3}, {regex:true, query:'dog'}, 'x'), /could not be reproduced/);
  assert.throws(() => replacementFor({text:'cat', start:0, end:3}, {regex:true, query:'['}, 'x'), /cannot be used/);
});
