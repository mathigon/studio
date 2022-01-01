// =============================================================================
// Custom Markdown Renderer
// (c) Mathigon
// =============================================================================


const yaml = require('js-yaml');
const {marked} = require('marked');
const pug = require('pug');
const entities = require('html-entities');

const {Expression} = require('@mathigon/hilbert');
const {makeTexPlaceholder} = require('./mathjax');
const {CONFIG, warning} = require('../utilities');


// -----------------------------------------------------------------------------
// Configuration

// TODO Make the URL configurable!
const EMOJI_URL = 'https://static.mathigon.org/emoji';

/** Custom language names for syntax highlighting. */
const codeBlocks = {py: 'python', c: 'clike', jl: 'julia', sh: 'bash', code: 'md'};

/** Equation helper functions. */
const customMathML = {
  pill: (expr, color, target) => {
    if (!target) return `<span class="pill ${color.val.s}">${expr}</span>`;
    return `<span class="pill step-target ${color.val.s}" data-to="${target.val.s}" tabindex="0">${expr}</span>`;
  },
  reveal: (expr, when) => `<mrow class="reveal" data-when="${when.val.s}">${expr}</mrow>`,
  input: (value, placeholder) => `<x-blank solution="${value.val.n}" placeholder="${placeholder ? placeholder.val.s : '???'}"></x-blank>`,
  blank: (...values) => `<x-blank-mc>${values.map(v => `<button class="choice">${v}</button>`).join('')}</x-blank-mc>`,
  arc: (value) => `<mover>${value}<mo value="⌒">⌒</mo></mover>`,
  var: (value) => `<span class="var">\${${value.val.s}}</span>`,
  class: (expr, name) => `<mrow class="${name.val.s}">${expr}</mrow>`
};

/** Generate the audio-narration text for equation helper functions. */
const customVoice = {
  pill: (expr) => `${expr}`,
  reveal: (expr) => `${expr}`,
  input: () => 'blank',
  blank: () => 'blank',
  bar: (expr) => `${expr}`,
  vec: (expr) => `${expr}`,
  arc: (expr) => `${expr}`,
  var: (expr) => `${expr}`,
  class: (expr) => `${expr}`
};


// -----------------------------------------------------------------------------
// Create Markdown Renderer

module.exports.getRenderer = function(metadata, directory, locale='en') {
  const renderer = new marked.Renderer();
  let originalP = '';  // Caching of unparsed paragraphs (for blockquotes)

  renderer.heading = (text, level) => {
    if (level === 1) metadata.courseTitle = text;
    if (level === 2) metadata.sectionTitle = text;
    return level > 2 ? `<h${level - 1}>${text}</h${level - 1}>` : '';
  };

  // Parse blockquote (>) blocks as YAML metadata.
  renderer.blockquote = (quote) => {
    Object.assign(metadata, yaml.load(entities.decode(originalP || quote)));
    return '';
  };

  renderer.paragraph = (text) => {
    originalP = text;
    return '<p>' + parseParagraph(text) + '</p>';
  };

  renderer.listitem = (text) => {
    return '<li>' + parseParagraph(text) + '</li>';
  };

  renderer.tablecell = (text, flags) => {
    const tag = flags.header ? 'th' : 'td';
    const align = flags.align ? ` align="${flags.align}"` : '';
    return `<${tag}${align}>${parseParagraph(text)}</${tag}>`;
  };

  renderer.link = function(href, title, text) {
    if (href === 'btn:next') {
      return `<button class="next-step">${text}</button>`;
    }

    if (href.startsWith('gloss:')) {
      const id = href.slice(6);
      metadata.gloss.add(id);
      return `<x-gloss xid="${id}">${text}</x-gloss>`;
    }

    if (href.startsWith('bio:')) {
      const id = href.slice(4);
      metadata.bios.add(id);
      return `<x-bio xid="${id}">${text}</x-bio>`;
    }

    if (href.startsWith('target:')) {
      const id = href.slice(7);
      return `<span class="step-target pill" tabindex="0" data-to="${id}">${text}</span>`;
    }

    if (href.startsWith('action:')) {
      const id = href.slice(7);
      return `<button class="var-action" @click="${id}">${text}</button>`;
    }

    if (href.startsWith('pill:')) {
      const colour = href.slice(5);
      return `<strong class="pill ${colour}">${text}</strong>`;
    }

    const href1 = entities.decode(href);
    if (href1.startsWith('->')) {
      return `<x-target class="step-target pill" to="${href1.slice(2).replace(/_/g, ' ')}">${text}</x-target>`;
    }

    const newWindow = !href.startsWith('#') && !href.includes(CONFIG.domain);
    return `<a href="${href}"${newWindow ? ' target="_blank"' : ''}>${text}</a>`;
  };

  renderer.codespan = (code) => {
    code = entities.decode(code);

    // Specify the language of the block, e.g. `{py} x = 10`.
    const lang = code.match(/^{(\w+)}/);
    if (lang) {
      code = code.slice(lang[1].length + 2).trim();
      if (lang[1] === 'latex') return `${makeTexPlaceholder(code, true)}`;
      const name = codeBlocks[lang[1]] || lang[1];
      return `<code class="language-${name}">${code}</code>`;
    }

    // By default, code blocks are parsed as maths equations.
    const newRender = code.startsWith('§');
    if (newRender) code = code.slice(1);

    try {
      const expr = Expression.parse(code);
      const maths = expr.toMathML(customMathML);
      const voice = expr.toVoice(customVoice);
      const dir = locale === 'ar' ? 'dir="ltr"' : '';
      return newRender ? `<x-math data-voice="${voice}" ${dir}>${maths}</x-math>` : `<span class="math" data-voice="${voice}" ${dir}>${maths}</span>`;
    } catch (e) {
      warning(`Maths parsing error in "${code}": ${e.toString()}`);
      return '<span class="math"></span>';
    }
  };

  const pugFile = `${directory}/content.pug`;
  renderer.code = (code, name) => {
    if (name === 'latex') {
      const eqn = '\\begin{align*}' + entities.decode(code) + '\\end{align*}';
      return `<p class="text-center">${makeTexPlaceholder(eqn, false)}</p>`;
    }

    if (name) {
      code = entities.decode(code);
      name = codeBlocks[name] || name;
      return `<pre class="language-${name}"><code>${code}</code></pre>`;
    }

    try {
      return pug.render(code, {filename: pugFile});
    } catch (e) {
      warning(`PUG parsing error: ${e.message}`);
      return '';
    }
  };

  return renderer;
};


// -----------------------------------------------------------------------------
// Helper Functions

/** Render inline blank elements using [[a|b]]. */
function inlineBlanks(text) {
  return text.replace(/\[\[([^\]]+)]]/g, (x, body) => {
    const choices = body.split('§§');  // Replacement for |s because of tables.

    if (choices.length === 1) {
      const [_1, value, _2, hint] = (/^([^(]+)(\((.*)\))?\s*$/g).exec(body);
      const hintAttr = hint ? `hint="${hint}"` : '';
      return `<x-blank solution="${value}" ${hintAttr}></x-blank>`;

    } else {
      const choiceEls = choices.map(c => `<button class="choice">${c}</button>`);
      return `<x-blank-mc>${choiceEls.join('')}</x-blank-mc>`;
    }
  });
}

/** Render inline LaTeX equations using $x^2$. */
function inlineEquations(text) {
  // We want to match $a$ strings, except
  //  * the closing $ is immediately followed by a word character (e.g. currencies)
  //  * the opening $ is prefixed with a \ (for custom override)
  //  * they start with ${} (for variables)
  return text.replace(/(^|[^\\])\$([^{][^$]*?)\$($|[^\w])/g, (_, prefix, body, suffix) => {
    return prefix + makeTexPlaceholder(entities.decode(body), true) + suffix;
  });
}

/** Render inline variables using ${x}. */
function inlineVariables(text) {
  return text.replace(/\${([^}]+)}{([^}]+)}/g, '<x-var bind="$2">${$1}</x-var>')
      .replace(/\${([^}]+)}(?!<\/x-var>)/g, '<span class="var">${$1}</span>');
}

function parseParagraph(text) {
  text = inlineBlanks(text);
  text = inlineEquations(text);
  text = inlineVariables(text);

  // Replace non-breaking space and escaped $s.
  text = text.replace(/\\ /g, '&nbsp;').replace(/\\\$/g, '$');

  // TODO Support the standard GitHub Emoji keys, not Emojipedia.
  return text.replace(/:([a-zA-Z0-9_\-+]+):/g, (_, name) =>
    `<img class="emoji" width="20" height="20" src="${EMOJI_URL}/${name}.png" alt="${name}"/>`);
}
