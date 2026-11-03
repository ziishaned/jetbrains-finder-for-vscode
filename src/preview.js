function getPreviewRange(start, end, lineCount) {
  const first = Math.max(0, Math.min(lineCount, Number.isFinite(start) ? Math.floor(start) : 0));
  const last = Math.max(first, Math.min(lineCount, first + 200, Number.isFinite(end) ? Math.ceil(end) : first));
  return { start:first, end:last };
}

module.exports = { getPreviewRange };
