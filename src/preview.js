function getPreviewRange(start, end, lineCount) {
  const first = Math.max(0, Math.min(lineCount, Number.isFinite(start) ? Math.floor(start) : 0));
  const last = Math.max(first, Math.min(lineCount, first + 200, Number.isFinite(end) ? Math.ceil(end) : first));
  return { start:first, end:last };
}
function createRowMap(doc, columns) {
  const width = Math.max(20, Math.min(500, Math.floor(columns) || 100));
  const offsets = [0];
  for (let i = 0; i < doc.lineCount; i++) offsets.push(offsets[i] + Math.max(1, Math.ceil(doc.lineAt(i).text.length / width)));
  return { width, offsets, count:offsets[offsets.length - 1] };
}
function rowPosition(map, row) {
  let low=0, high=map.offsets.length-1;
  while(low+1<high){const mid=Math.floor((low+high)/2);if(map.offsets[mid]<=row)low=mid;else high=mid;}
  return {line:low, part:row-map.offsets[low]};
}
function segmentBoundary(text, position) {
  if (position > 0 && position < text.length && /[\uDC00-\uDFFF]/.test(text[position]) && /[\uD800-\uDBFF]/.test(text[position-1])) return position-1;
  return Math.min(position,text.length);
}
function matchRow(map, doc, line, character) {
  const text=doc.lineAt(line).text;
  let part=Math.min(map.offsets[line+1]-map.offsets[line]-1,Math.floor(character/map.width));
  if (part+1<map.offsets[line+1]-map.offsets[line] && character >= segmentBoundary(text,(part+1)*map.width)) part++;
  return map.offsets[line]+part;
}
function resultSnippet(item, context=40, length=140) {
  const from=Math.max(0,item.start-context), to=Math.min(item.text.length,Math.max(from+length,item.end));
  return {text:item.text.slice(from,to)+(to<item.text.length?'…':''),start:item.start-from,end:item.end-from};
}
module.exports = { getPreviewRange, createRowMap, rowPosition, segmentBoundary, matchRow, resultSnippet };
