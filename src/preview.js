function getPreviewRange(start, end, lineCount) {
  const first = Math.max(0, Math.min(lineCount, Number.isFinite(start) ? Math.floor(start) : 0));
  const last = Math.max(first, Math.min(lineCount, first + 200, Number.isFinite(end) ? Math.ceil(end) : first));
  return { start:first, end:last };
}
function createRowMap(doc, columns) {
  const width = Math.max(20, Math.min(500, Math.floor(columns) || 100));
  const offsets = [0], breaks = new Map();
  // A final newline creates an empty second VS Code line; it is still a single-line file.
  const singleLine = doc.lineCount === 1 || (doc.lineCount === 2 && doc.lineAt(1).text === '');
  for (let i = 0; i < doc.lineCount; i++) {
    const text=doc.lineAt(i).text, starts=[0];
    let start=0;
    while(singleLine && start+width<text.length){
      let end=segmentBoundary(text,start+width);
      // Prefer a nearby whitespace boundary, retaining every character.
      const min=start+Math.floor(width/2);
      for(let j=end-1;j>=min;j--)if(/\s/u.test(text[j])){end=j+1;break;}
      if(end<=start)end=segmentBoundary(text,start+width);
      starts.push(end);start=end;
    }
    if(starts.length>1)breaks.set(i,starts);
    offsets.push(offsets[i]+starts.length);
  }
  return { width, offsets, breaks, count:offsets[offsets.length - 1] };
}
function segmentRange(map, line, part, text) {
  const starts=map.breaks.get(line);
  return {from:starts ? starts[part] : 0, to:starts && part+1<starts.length ? starts[part+1] : text.length};
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
  const starts=map.breaks.get(line);
  if(!starts)return map.offsets[line];
  let low=0,high=starts.length;
  while(low+1<high){const mid=Math.floor((low+high)/2);if(starts[mid]<=character)low=mid;else high=mid;}
  return map.offsets[line]+low;
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
module.exports = { getPreviewRange, createRowMap, rowPosition, segmentBoundary, segmentRange, matchRow, resultSnippet };
