// =============================================================================
// Custom Markdown Parser
// (c) Mathigon
// =============================================================================


const {marked} = require('marked');
const pug = require('pug');
const JSDom = require('jsdom').JSDOM;  // Could switch to cheerio.js.org for speed?
const {last, cache} = require('@mathigon/core');
const htmlMinify = require('html-minifier').minify;

const {fillTexPlaceholders} = require('./mathjax');
const {getRenderer} = require('./renderer');
const {addNarrationTags} = require('./audio');
const {CONFIG, warning} = require('../utilities');

const $$ = (el, query) => Array.from(el.querySelectorAll(query));


// -----------------------------------------------------------------------------
// Configuration

const MINIFY_CONFIG = {
  collapseWhitespace: true,
  conservativeCollapse: true,
  removeComments: true
};

// TODO Make this list of goals configurable, and remove non-public components.
// For now, you can manually add [goal] attributes to other, custom elements.
const COMPONENTS = [
  {query: 'x-blank, x-blank-mc', goal: 'blank-$'},
  {query: 'x-var', goal: 'var-$'},
  {query: 'x-slider', goal: 'slider-$'},
  {query: 'x-sortable', goal: 'sortable-$'},
  {query: 'x-free-text', goal: 'free-text-$'},
  {query: '.next-step', goal: 'next-$', noAttr: true},
  {query: 'x-equation, x-equation-system', goal: 'eqn-$', exclude: 'x-equation-system x-equation'}, // Exclude equation *inside* system.

  // These components have multiple goals each, based on their children.
  {query: 'x-algebra-flow', goal: 'algebra-flow', goals: (e) => $$(e, 'ul li').slice(1).map((c, i) => 'algebra-flow-' + i)},
  {query: 'x-picker', goal: 'picker', goals: (e) => $$(e, '.item').map((c, i) => c.hasAttribute('data-error') ? '' : 'picker-' + i).filter(g => g)},
  {query: 'x-slideshow', goal: 'slide', goals: (e) => $$(e, ':scope > *:not([slot="stage"])').slice(1).map((c, i) => 'slide-' + i)},

  // For backwards-compatibility the components dont' have a -0 in their goal.
  {query: 'x-quill', goal: 'quill'},
  {query: 'x-gameplay', goal: 'gameplay'}
];

const NOWRAP_QUERY = 'code, x-blank, x-blank-mc, x-var, svg.mathjax, x-gloss, x-bio, span.step-target, span.pill, x-target, span.math';


// -----------------------------------------------------------------------------
// Markdown Parsers

async function parseStep(content, index, directory, courseId, locale = 'en') {
  // Custom HTML blocks using :::
  content = blockIndentation(content);

  // Circumvent Markdown Inline escaping of \$s.
  content = content.replace(/\\\$/g, '\\\\$');

  // Replace relative image URLs
  content = content.replace(/(url\(|src=["'`]|href=["'`]|background=["'`]|poster=["'`])images\//g, `$1/content/${courseId}/images/`);

  // Rename special attributes
  content = content.replace(/ (when|delay|animation|duration|voice)=/g, ' data-$1=');

  // Markdown requires header rows. We temporary add empty headers to tables
  // without one, and then delete the later.
  content = content.replace(/\n\n\|(.*)\n\|(.*)\n/g, (m, row1, row2) => {
    const cols = row1.split(' | ').length;
    const header = row2.match(/^[\s|:-]+$/) ? '' :
      `|${' |'.repeat(cols)}\n|${' - |'.repeat(cols)}\n`;
    return `\n\n${header}|${row1}\n|${row2}\n`;
  });

  // The |s used to separate answer options in blanks interfere with table
  // parsing. We temporarily replace them with §§, and then revert later.
  content = content.replace(/\[\[([^\]]+)]]/g, x => x.replace(/\|/g, '§§'));

  // Actually parse the Markdown
  const lexer = new marked.Lexer();
  lexer.tokenizer.rules.block.html = /^<.*[\n]{2,}/;
  const tokens = lexer.lex(content);

  const metadata = {gloss: new Set(), bios: new Set()};
  const renderer = getRenderer(metadata, directory, locale);
  let parsed = marked.Parser.parse(tokens, {renderer});

  // Check step and section IDs
  metadata.id = checkId(metadata.id, 'step') || 'step-' + index;
  metadata.section = checkId(metadata.section, 'section');

  // Asynchronously replace all LaTeX Equation placeholders.
  parsed = await fillTexPlaceholders(parsed);

  // Parse the HTML string as DOM
  const window = new JSDom('<x-step>' + parsed + '</x-step>').window;
  const body = window.document.body.children[0];

  // Parse custom element attributes like {.class}
  // TODO Parse attributes for <ul> and <table>
  for (const n of nodes(body)) blockAttributes(n);

  // Add <nowrap> elements around inline-block elements.
  addNoWraps(body);

  // Parse markdown inside HTML elements with .md class
  for (const $md of $$(body, '.md')) {
    $md.classList.remove('md');
    $md.innerHTML = marked($md.innerHTML, {renderer}).replace(/^<p>|<\/p>$/g, '');
  }

  // Add the [parent] attribute as class to all elements parents
  for (const $p of $$(body, '[parent]')) {
    const classes = $p.getAttribute('parent').split(' ');
    $p.removeAttribute('parent');
    $p.parentNode.classList.add(...classes);
  }

  // Remove empty table headers
  for (const $th of $$(body, 'thead')) {
    if (!$th.textContent.trim() && !$th.querySelector('.mathjax')) $th.remove();
  }

  // Add `.with-titles` to all box elements containing a <h3> element
  for (const $b of $$(body, '.box')) {
    if ($b.querySelector('h3, .tabs')) $b.classList.add('with-title');
  }

  // Allow setting a class attribute in the last row of a table
  for (const $td of body.querySelectorAll('td[class]')) {
    if (!$td.parentElement.textContent.trim()) {
      const $table = $td.parentElement.parentElement.parentElement;
      $table.setAttribute('class', $td.getAttribute('class'));
      $td.parentElement.remove();
    }
  }

  // Add empty alt attributes for accessibility
  for (const $img of body.querySelectorAll('img:not([alt])')) {
    $img.setAttribute('alt', '');
  }

  // Add RTL overrides to always-LTR elements
  if (locale === 'ar') {
    const LTR = 'x-geopad, x-coordinate-system, svg, x-var';
    for (const $el of $$(body, LTR)) $el.setAttribute('dir', 'ltr');
  }

  // Rename special data attributes
  for (const a of ['when', 'delay', 'animation', 'duration', 'voice']) {
    for (const el of body.querySelectorAll(`[${a}]`)) {
      el.setAttribute(`data-${a}`, el.getAttribute(a));
      el.removeAttribute(a);
    }
  }

  // Create sentence elements for audio narrations
  if (CONFIG.courses.audio) addNarrationTags(window.document, directory, locale);

  // Every step has a list of "goals": things that students need to achieve
  // before moving on. You can provide a list of custom goals in the metadata
  // (e.g. for goals that are triggered within the TypeScript code).
  const goals = new Set(metadata.goals ? metadata.goals.split(' ') : []);

  // You can also specify goals using a [goal] attribute for a custom component.
  for (const el of $$(body, '[goal]')) goals.add(el.getAttribute('goal'));

  // Finally, we automatically generate goals for some built-in components.
  for (const c of COMPONENTS) {
    const excluded = c.exclude ? $$(body, c.exclude) : [];
    for (const [i, item] of $$(body, c.query).filter(c => !excluded.includes(c)).entries()) {
      const goal = c.goal.replace('$', i);
      if (!c.noAttr) item.setAttribute('goal', goal);
      for (const g of (c.goals ? c.goals(item) : [goal])) goals.add(g);
    }
  }
  metadata.goals = Array.from(goals);

  // Calculate the reading time per section using 75 words per minute and
  // 30s per interactive goal (plus 1 minutes added above);
  // TODO Ensure this still works for non-english languages
  metadata.duration = body.textContent.split(/\s+/).length / 75;
  metadata.duration += metadata.goals.length / 2;

  // Add attributes to the <x-step> element
  body.id = metadata.id;
  body.setAttribute('goals', metadata.goals.join(' '));
  if (metadata.class) body.setAttribute('class', metadata.class);

  // Generate the Step HTML
  metadata.html = htmlMinify(body.outerHTML, MINIFY_CONFIG);
  window.close();

  return metadata;
}

async function parseSimple(text, locale = 'en') {
  const renderer = getRenderer({}, '', locale);
  const result = marked(blockIndentation(text), {renderer});
  const window = (new JSDom(result)).window;
  for (const n of nodes(window.document.body)) blockAttributes(n);
  addNoWraps(window.document.body);
  const html = htmlMinify(window.document.body.innerHTML, MINIFY_CONFIG);
  window.close();
  return await fillTexPlaceholders(html);
}

module.exports.parseStep = cache(parseStep);
module.exports.parseSimple = parseSimple;


// -----------------------------------------------------------------------------
// Helper Functions

/** Check if a section ID is valid. */
function checkId(id, type) {
  if (/^[\w-]+$/.test(id)) return id;
  warning(`Invalid ${type} ID: ${id}`);
}

/** Add HTML Tag Wrappers using ::: and indentation. */
function blockIndentation(source) {
  const lines = source.split('\n');
  const closeTags = [];
  const nested = [];

  for (let i = 0; i < lines.length; ++i) {
    if (!lines[i].startsWith(':::')) continue;
    const tag = lines[i].slice(4);

    if (!tag) {
      lines[i] = '\n' + closeTags.pop() + '\n';
      nested.pop();
      continue;
    }

    if (tag.startsWith('column')) {
      let col = pug.render(tag.replace('column', 'div')).split('</')[0];
      col = col.replace(/width="([0-9]+)"/, 'style="width: $1px"');
      if (last(nested) === 'column') {
        lines[i] = '\n</div>' + col + '\n';
      } else {
        lines[i] = '<div class="row padded">' + col + '\n';
        nested.push('column');
        closeTags.push('</div></div>');
      }
    } else if (tag.startsWith('tab')) {
      const col = pug.render(tag.replace('tab', '.tab')).split('</')[0];
      if (last(nested) === 'tab') {
        lines[i] = '\n</div>' + col + '\n';
      } else {
        lines[i] = '<x-tabbox>' + col + '\n';
        nested.push('tab');
        closeTags.push('</div></x-tabbox>');
      }
    } else {
      const wrap = pug.render(tag).split('</');
      closeTags.push('</' + wrap[1]);
      lines[i] = wrap[0] + '\n';
      nested.push('');
    }
  }

  return lines.join('\n');
}

/** Parse custom element attributes like {.class}. */
function blockAttributes(node) {
  const lastChild = node.childNodes[0]; // [node.childNodes.length - 1];
  if (!lastChild || lastChild.nodeType !== 3) return;

  const match = lastChild.textContent.match(/^{([^}]+)}/);
  if (!match) return;

  lastChild.textContent = lastChild.textContent.replace(match[0], '');

  const div = node.ownerDocument.createElement('div');
  try {
    div.innerHTML = pug.render(match[1]);
  } catch (e) {
    warning(`Invalid PUG tag: ${match[1]}`);
    return;
  }

  const replaced = div.children[0];
  if (!replaced) return warning(`Invalid attribute: {${match[1]}}`);

  if (replaced.tagName === 'DIV' && !match[1].startsWith('div')) {
    const attributes = Array.from(replaced.attributes);
    for (const a of attributes) {
      if (a.name === 'class') {
        node.classList.add(...a.value.split(' '));
      } else {
        node.setAttribute(a.name, a.value);
      }
    }
  } else {
    while (node.firstChild) replaced.appendChild(node.firstChild);
    node.parentNode.replaceChild(replaced, node);
  }
}

/**
 * Prevents line breaks between inline-block elements and punctuation. Note the
 * NOWRAP characters are removed later, after trailing punctuation is added
 * *inside* the <span> element.
 */
function addNoWraps(dom) {
  for (const el of $$(dom, NOWRAP_QUERY)) {
    if (!el.nextSibling || el.nextSibling.nodeName !== '#text') continue;
    const text = el.nextSibling.textContent;
    if (!text[0].match(/[:.,!?°]/)) continue;

    el.nextSibling.textContent = text.slice(1);
    const nowrap = el.ownerDocument.createElement('span');
    nowrap.classList.add('nowrap');
    el.replaceWith(nowrap);
    nowrap.appendChild(el);
    nowrap.innerHTML += text[0];
  }
}

/** Walk an entire DOM Tree. */
function nodes(element) {
  if (element.tagName === 'SVG') return [];
  const result = [];
  for (const c of element.children) {
    result.push(...nodes(c));
    result.push(c);
  }
  return result;
}
