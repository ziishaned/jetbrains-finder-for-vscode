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
  const text=item.text, isWord = character => character !== undefined && /[\p{L}\p{N}\p{M}_]/u.test(character);
  let from=segmentBoundary(text,Math.max(0,item.start-context));
  // Move to the beginning of a word only when the cut would split one.
  if(from>0 && isWord(String.fromCodePoint(text.codePointAt(from)))) {
    while(from>0){
      const previous=from-(text.charCodeAt(from-1)>=0xDC00 && text.charCodeAt(from-1)<=0xDFFF ? 2 : 1);
      if(!isWord(String.fromCodePoint(text.codePointAt(previous))))break;
      from=previous;
    }
  }
  const to=Math.min(text.length,Math.max(from+length,item.end));
  return {text:text.slice(from,to),start:item.start-from,end:item.end-from};
}
module.exports = { getPreviewRange, createRowMap, rowPosition, segmentBoundary, matchRow, resultSnippet };
