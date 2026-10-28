// Fails if a shipped file uses syntax newer than ES5, which webOS TV 3.x
// (Chromium 38) can't parse. Enact doesn't transpile node_modules, so the
// ES module builds must be ES5 too.
import { readFileSync } from 'node:fs';
import { parse } from 'acorn';

const files = ['dist/index.cjs', 'dist/webos.cjs', 'dist/waktu-solat.js', 'dist/waktu-solat.min.js'];
let failed = false;

for (const file of files) {
  try {
    parse(readFileSync(file, 'utf8'), { ecmaVersion: 5, sourceType: 'script' });
    console.log('ES5 OK   ' + file);
  } catch (e) {
    failed = true;
    console.error('NOT ES5  ' + file + ': ' + e.message);
  }
}

// The ES module builds may use import/export, but nothing else past ES5.
for (const file of ['dist/index.mjs', 'dist/webos.mjs']) {
  const esm = readFileSync(file, 'utf8')
    .replace(/^export \{[^}]*\};?\s*$/m, '')
    .replace(/^import [^;]*;\s*$/gm, '');
  try {
    parse(esm, { ecmaVersion: 5, sourceType: 'script' });
    console.log('ES5 OK   ' + file + ' (apart from import/export)');
  } catch (e) {
    failed = true;
    console.error('NOT ES5  ' + file + ': ' + e.message);
  }
}

// APIs missing on older webOS engines (fetch is feature-detected, so it's allowed).
const banned = /\bObject\.assign\b|\bArray\.from\b|\.finally\(|\bAbortController\b|\bPromise\.allSettled\b|\.includes\(|\bSymbol\.iterator\b/;
for (const file of files.concat(['dist/index.mjs', 'dist/webos.mjs'])) {
  // tslib's async helper only touches Symbol after `typeof Symbol === "function"`.
  const code = readFileSync(file, 'utf8')
    .replace(/typeof Symbol\s*===?\s*["']function["']\s*&&\s*\(?[\w$]+\[Symbol\.iterator\]/g, '')
    .replace(/["']function["']\s*===?\s*typeof Symbol\s*&&\s*\(?[\w$]+\[Symbol\.iterator\]/g, '');
  const match = banned.exec(code);
  if (match) {
    failed = true;
    console.error('USES     ' + file + ': ' + match[0]);
  }
}

process.exit(failed ? 1 : 0);
