// =============================================================================
// MathJax Parser Utilities
// (c) Mathigon
// =============================================================================


const path = require('path');
const entities = require('html-entities');
const mathjax = require('mathjax');
const {readFile, writeFile, warning} = require('../utilities');

const cacheFile = path.join(process.env.HOME, '/.mathjax-cache');
const mathJaxStore = JSON.parse(readFile(cacheFile, '{}'));
let storeChanged = false;

const placeholders = {};
let placeholderCount = 0;
let promise = undefined;


module.exports.makeTexPlaceholder = function(code, isInline = false) {
  const id = entities.decode(code) + (isInline || false);
  if (id in mathJaxStore) return mathJaxStore[id];

  const placeholder = `XEQUATIONX${placeholderCount++}XEQUATIONX`;
  placeholders[placeholder] = [code, isInline];
  return placeholder;
};

async function texToSvg(code, isInline) {
  const id = entities.decode(code) + (isInline || false);
  if (mathJaxStore[id]) return mathJaxStore[id];

  if (!promise) {
    promise = mathjax.init({
      loader: {load: ['input/tex-full', 'output/svg']},
      svg: {}  // http://docs.mathjax.org/en/latest/options/output/svg.html#the-configuration-block
    });
  }

  let output = '';

  try {
    // TODO Use KaTeX for performance, and generate HTML not SVGs
    const MathJax = await promise;
    const svg = await MathJax.tex2svg(code, {display: !isInline});
    output = MathJax.startup.adaptor.innerHTML(svg)
        .replace('role="img" focusable="false"', 'class="mathjax"')
        .replace(/ xmlns(:xlink)?="[^"]+"/g, '')
        .replace('<defs>', `<title>${entities.encode(code).trim()}</title><defs>`);
  } catch (e) {
    warning(`MathJax Error – ${e.message} at "${code}"`);
  }

  storeChanged = true;
  return mathJaxStore[id] = output;
}

module.exports.fillTexPlaceholders = async function(doc) {
  const matches = doc.match(/XEQUATIONX[0-9]+XEQUATIONX/g) || [];
  for (const placeholder of matches) {
    const code = await texToSvg(...placeholders[placeholder]);
    doc = doc.replace(placeholder, code);
  }
  return doc;
};

module.exports.writeTexCache = async function() {
  if (storeChanged) await writeFile(cacheFile, JSON.stringify(mathJaxStore));
  storeChanged = false;
};
