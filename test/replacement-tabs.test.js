const {test} = require('node:test');
const assert = require('node:assert/strict');
const {replacementTabsToClose} = require('../src/replacement-tabs');

test('closes only clean tabs opened for replacement targets', () => {
  const tab = (uri, isDirty = false) => ({input: {uri: {toString: () => uri}}, isDirty});
  const existing = tab('file:///existing');
  const opened = tab('file:///target');
  const dirty = tab('file:///dirty', true);
  const unrelated = tab('file:///other');
  const secondViewOfExisting = tab('file:///existing');
  const result = replacementTabsToClose([{tabs:[existing, opened, dirty, unrelated, secondViewOfExisting]}], new Set([existing]), new Set(['file:///existing']), new Set(['file:///existing', 'file:///target', 'file:///dirty']));
  assert.deepEqual(result, [opened]);
});
