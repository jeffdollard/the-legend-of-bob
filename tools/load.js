// Loads the game's classic scripts into one Node vm context (no DOM) for tests.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadGame(files, exportsList) {
  const root = path.join(__dirname, '..', 'js');
  const src = files.map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n;\n')
    + `\n;globalThis.__exports = { ${exportsList.join(', ')} };`;
  const ctx = vm.createContext({ console, Math, Map, Set });
  vm.runInContext(src, ctx, { filename: 'game-bundle.js' });
  return ctx.__exports;
}

module.exports = { loadGame };
