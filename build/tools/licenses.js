// =============================================================================
// Compile list of all open source dependency licenses
// (c) Mathigon
// =============================================================================


const checker = require('license-checker');
const {OUTPUT, writeFile} = require('../utilities');


const LICENSE_RENAME = {
  'Apache 2.0': 'Apache-2.0',
  '(BSD-3-Clause OR GPL-2.0)': 'BSD-3-Clause',
  'AFLv2.1 or BSD': 'BSD'
};

async function getLicenses() {
  const data = new Map();

  const packages = await (new Promise((resolve, reject) => {
    checker.init({start: process.cwd()}, (err, packages) => {
      if (err) return reject(err);
      resolve(packages);
    });
  }));

  for (const [key, p] of Object.entries(packages)) {
    if (key.startsWith('@mathigon')) continue;

    let license = (Array.isArray(p.licenses) ? p.licenses.join(' or ') : p.licenses) || '';
    if (license.startsWith('Custom')) license = 'Custom';
    if (license.includes('MIT OR') || license.includes(' OR MIT')) license = 'MIT';
    if (license in LICENSE_RENAME) license = LICENSE_RENAME[license];

    if (!data.has(license)) data.set(license, new Set());
    const name = key.startsWith('@') ? '@' + key.slice(1).split('@')[0] : key.split('@')[0];
    data.get(license).add(`[${name}](${p.repository})`);
  }

  let text = '# Open Source Licenses';
  for (const [name, items] of data.entries()) {
    text += `\n\n## ${name} (${items.size})`;
    for (const item of items) text += `\n* ${item}`;
  }

  await writeFile(OUTPUT + '/licenses.md', text);
}

module.exports.getLicenses = getLicenses;
