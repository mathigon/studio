// =============================================================================
// Markdown Parser Tests
// (c) Mathigon
// =============================================================================


const fs = require('fs');
const path = require('path');
const tape = require('tape');
const {parseStep} = require('../../build/markdown/parser');


tape('Parse Markdown', async (test) => {
  const dir = path.join(process.cwd(), 'tests/markdown');
  const source = fs.readFileSync(dir + '/input.md', 'utf8');

  const steps = source.split(/\n---+\n/);
  const parsed = await Promise.all(steps.map((s, i) => parseStep(s, i, 'test', 'en')));

  const output = JSON.stringify(parsed, undefined, '  ')
      .replace(/MJX-[\w-]+/g, 'MJX-TEX');  // Fix MathJax element IDs

  const current = fs.readFileSync(dir + '/output.json', 'utf8');
  fs.writeFileSync(dir + '/output.json', output);
  test.equal(output, current);
  test.end();
});
