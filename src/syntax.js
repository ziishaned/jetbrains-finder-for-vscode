const fs = require('fs');
const path = require('path');
const textmate = require('vscode-textmate');
const oniguruma = require('vscode-oniguruma');
const jsonc = require('jsonc-parser');
const plist = require('plist');

const simpleScopes = {
  comments: ['comment'], strings: ['string'], keywords: ['keyword'],
  numbers: ['constant.numeric'], types: ['entity.name.type', 'support.type'],
  functions: ['entity.name.function', 'support.function'], variables: ['variable']
};
let onigPromise;
function onigLib() {
  if (!onigPromise) onigPromise = fs.promises.readFile(require.resolve('vscode-oniguruma/release/onig.wasm')).then(bytes => oniguruma.loadWASM(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))).then(() => ({ createOnigScanner: patterns => new oniguruma.OnigScanner(patterns), createOnigString: value => new oniguruma.OnigString(value) }));
  return onigPromise;
}
function parseThemeFile(file) {
  const contents = fs.readFileSync(file, 'utf8');
  if (/\.tmtheme$/i.test(file)) return { tokenColors: plist.parse(contents).settings || [] };
  const errors = [];
  const value = jsonc.parse(contents, errors, { allowTrailingComma: true, disallowComments: false });
  if (errors.length || !value || typeof value !== 'object') throw new Error(`Invalid theme: ${file}`);
  return value;
}
function readTheme(file, visited = new Set()) {
  if (visited.has(file)) return [];
  visited.add(file);
  const theme = parseThemeFile(file);
  let rules = theme.include ? readTheme(path.resolve(path.dirname(file), theme.include), visited) : [];
  if (typeof theme.tokenColors === 'string') rules = rules.concat(readTheme(path.resolve(path.dirname(file), theme.tokenColors), visited));
  else if (Array.isArray(theme.tokenColors)) rules = rules.concat(theme.tokenColors);
  return rules;
}
function customizationRules(settings, themeName) {
  const flatten = value => {
    if (!value || typeof value !== 'object') return [];
    const rules = [];
    for (const [key, scopes] of Object.entries(simpleScopes)) if (typeof value[key] === 'string') rules.push({ scope: scopes, settings: { foreground: value[key] } });
    if (Array.isArray(value.textMateRules)) rules.push(...value.textMateRules);
    return rules;
  };
  let result = flatten(settings);
  for (const [key, value] of Object.entries(settings || {})) {
    const names = [...key.matchAll(/\[([^\]]+)\]/g)].map(match => match[1]);
    if (names.includes(themeName)) result = result.concat(flatten(value));
  }
  return result;
}
function findTheme(extensions, name) {
  for (const extension of extensions) for (const theme of extension.packageJSON?.contributes?.themes || []) {
    if (theme.id === name || theme.label === name) return path.resolve(extension.extensionPath, theme.path);
  }
}
function createSyntax(vscode) {
  let registry, grammarPaths, languageScopes, languages, injections, initialized;
  function initialize() {
    grammarPaths = new Map(); languageScopes = new Map(); languages = []; injections = new Map();
    for (const extension of vscode.extensions.all) {
      const contributes = extension.packageJSON?.contributes || {};
      for (const language of contributes.languages || []) languages.push(language);
      for (const grammar of contributes.grammars || []) {
        if (!grammar.scopeName || !grammar.path) continue;
        grammarPaths.set(grammar.scopeName, path.resolve(extension.extensionPath, grammar.path));
        if (grammar.language) languageScopes.set(grammar.language, grammar.scopeName);
        for (const target of grammar.injectTo || []) injections.set(target, [...(injections.get(target) || []), grammar.scopeName]);
      }
    }
    registry = new textmate.Registry({ onigLib: onigLib(), loadGrammar: async scope => {
      const file = grammarPaths.get(scope); if (!file) return null;
      try { return textmate.parseRawGrammar(await fs.promises.readFile(file, 'utf8'), file); } catch { return null; }
    }, getInjections: scope => injections.get(scope) || [] });
    applyTheme();
  }
  function applyTheme() {
    const name = vscode.workspace.getConfiguration('workbench').get('colorTheme');
    const file = findTheme(vscode.extensions.all, name);
    let rules = [];
    try { if (file) rules = readTheme(file); } catch { /* Keep the fallback palette when a theme cannot be read. */ }
    if (!rules.length) { initialized = false; return; }
    const config = vscode.workspace.getConfiguration('editor').get('tokenColorCustomizations', {});
    registry.setTheme({ settings: rules.concat(customizationRules(config, name)) });
    initialized = true;
  }
  function languageForFile(file) {
    const name = path.basename(file).toLowerCase();
    const lower = file.toLowerCase();
    for (const language of languages) if ((language.filenames || []).some(n => n.toLowerCase() === name)) return language.id;
    let best, length = 0;
    for (const language of languages) for (const ext of language.extensions || []) if (lower.endsWith(ext.toLowerCase()) && ext.length > length) { best = language.id; length = ext.length; }
    return best;
  }
  async function grammarFor(file, languageId) {
    if (!registry) initialize();
    if (!initialized) return null;
    const scope = languageScopes.get(languageId || languageForFile(file));
    return scope ? registry.loadGrammar(scope) : null;
  }
  function tokenize(grammar, line, state) {
    const result = grammar.tokenizeLine2(line, state);
    const map = registry.getColorMap();
    const spans = [];
    for (let i = 0; i < result.tokens.length; i += 2) {
      const metadata = result.tokens[i + 1], font = (metadata >>> 11) & 15;
      spans.push({ start: result.tokens[i], end: i + 2 < result.tokens.length ? result.tokens[i + 2] : line.length, color: ((metadata >>> 15) & 511) === 1 ? undefined : map[(metadata >>> 15) & 511], italic: !!(font & 1), bold: !!(font & 2), underline: !!(font & 4), strike: !!(font & 8) });
    }
    return { spans, state: result.ruleStack };
  }
  return { grammarFor, tokenize, reset() { registry = undefined; initialized = false; } };
}
module.exports = { createSyntax, readTheme, customizationRules };
