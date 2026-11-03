const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getPreviewRange } = require('../src/preview');

test('preview ranges reach both ends of a file and limit each request', () => {
  assert.deepEqual(getPreviewRange(-20, 30, 10000), {start:0,end:30});
  assert.deepEqual(getPreviewRange(9990, 10100, 10000), {start:9990,end:10000});
  assert.deepEqual(getPreviewRange(5000, 9000, 10000), {start:5000,end:5200});
  assert.deepEqual(getPreviewRange(50, 20, 100), {start:50,end:50});
});
