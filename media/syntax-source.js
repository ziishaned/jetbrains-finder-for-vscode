const hljs = require('highlight.js/lib/common');

const extensions = {
  html: 'xml', htm: 'xml', xml: 'xml', svg: 'xml', vue: 'xml',
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
  ts: 'typescript', tsx: 'typescript', json: 'json', jsonc: 'json',
  css: 'css', scss: 'scss', less: 'less', md: 'markdown', markdown: 'markdown',
  py: 'python', rb: 'ruby', rs: 'rust', sh: 'bash', zsh: 'bash',
  yml: 'yaml', yaml: 'yaml', java: 'java', c: 'c', h: 'c', cpp: 'cpp',
  cc: 'cpp', hpp: 'cpp', cs: 'csharp', go: 'go', php: 'php', sql: 'sql',
  swift: 'swift', kt: 'kotlin', kts: 'kotlin', lua: 'lua', dart: 'dart',
  diff: 'diff', patch: 'diff', dockerfile: 'dockerfile', ini: 'ini', toml: 'ini'
};

window.renderSyntax = function (container, text, filename, start, end) {
  const name = filename.split(/[\\/]/).pop().toLowerCase();
  const extension = name.includes('.') ? name.split('.').pop() : name;
  const language = extensions[extension];
  if (language && hljs.getLanguage(language) && text.length < 20000) {
    container.innerHTML = hljs.highlight(text, { language, ignoreIllegals: true }).value;
  } else {
    container.textContent = text;
  }
  if (!Number.isInteger(start) || !Number.isInteger(end) || end <= start) return;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let offset = 0, node;
  while ((node = walker.nextNode())) {
    const nodeStart = offset, nodeEnd = offset + node.data.length;
    if (nodeEnd > start && nodeStart < end) nodes.push({ node, start: Math.max(0, start - nodeStart), end: Math.min(node.data.length, end - nodeStart) });
    offset = nodeEnd;
    if (offset >= end) break;
  }
  for (const part of nodes) {
    const range = document.createRange();
    range.setStart(part.node, part.start);
    range.setEnd(part.node, part.end);
    const mark = document.createElement('mark');
    range.surroundContents(mark);
  }
};
