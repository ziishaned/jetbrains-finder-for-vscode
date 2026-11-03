const path = require('path');

function buildArgs(options, excludes = {}) {
  const args = ['--json', '--line-number', '--hidden', '--no-config', '--glob', '!.git', '--max-columns', '1000'];
  for (const [glob, enabled] of Object.entries(excludes)) if (enabled === true) args.push('--glob', `!${glob}`);
  if (!options.caseSensitive) args.push('--ignore-case');
  if (options.wholeWord) args.push('--word-regexp');
  if (!options.regex) args.push('--fixed-strings');
  if (options.mask && options.mask.trim()) {
    for (const mask of options.mask.split(',').map(s => s.trim()).filter(Boolean)) args.push('--glob', mask);
  }
  args.push('--', options.query, '.');
  return args;
}

function parseMatch(data, root) {
  if (!data.path || typeof data.path.text !== 'string' || !data.lines || typeof data.lines.text !== 'string') return [];
  const line = data.lines.text.replace(/\r?\n$/, '');
  const file = path.resolve(root, data.path.text);
  return data.submatches.map(match => ({
    file, line: data.line_number - 1,
    start: Buffer.from(line).subarray(0, match.start).toString('utf8').length,
    end: Buffer.from(line).subarray(0, match.end).toString('utf8').length,
    text: line
  }));
}
function selectSearchRoots(scope, folders, selectedDirectory, selectedRoot) {
  if (scope === 'directory') return selectedDirectory ? [{uri:selectedDirectory}] : [];
  if (scope === 'folder' && selectedRoot) return folders.filter(folder => folder.uri.toString() === selectedRoot);
  return folders;
}
module.exports = { buildArgs, parseMatch, selectSearchRoots };
