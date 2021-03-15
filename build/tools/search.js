// =============================================================================
// Build Search Data
// (c) Mathigon
// =============================================================================


const path = require('path');
const glob = require('glob');
const {unique} = require('@mathigon/core');
const {parseYAML} = require('../markdown');
const {OUTPUT, success, writeFile} = require('../utilities');

// TODO Support search for non-English languages
// TODO Find a better way to clean and configure the special words below.

const IGNORED_WORDS = ['introduction', 'then', 'diagrams', 'first', 'second',
  'third', 'fourth', 'fifth', 'table', 'the', 'and', 'sum', 'for', 'von',
  'math', 'maths', 'mathematics'];

function wordClean(str) {
  if (str.startsWith('pythagor')) return 'pythagoras';
  if (str.startsWith('trigonom')) return 'trigonometry';
  if (str.startsWith('combinat')) return 'combinatorics';
  if (str.startsWith('polyg')) return 'polygon';
  if (str.match(/hedral?$/)) return str.replace(/hedral?/, 'hedron');
  return str;
}


// -----------------------------------------------------------------------------
// Load Raw Search Documents

async function loadDocuments(locale = 'en') {
  const documents = [];

  const courses = glob.sync('*', {cwd: OUTPUT + '/content'}).map(c => path.join(OUTPUT, 'content', c, `data_${locale}.json`));
  const glossary = await parseYAML('shared', 'glossary.yaml', locale, 'text');

  for (const courseId of courses) {
    const course = require(courseId);

    for (const section of course.sections) {
      if (section.locked) continue;
      const steps = section.steps.map(step => course.steps[step]);
      const html = steps.map(s => s.html).join('');

      // The keywords related to this document, in priority order.
      const sectionTitle = section.title === 'Introduction' ? course.title : section.title;
      const keywords = [[sectionTitle], [course.title], [], []];

      // Find manually added step keywords (as keywords: metadata)
      for (const step of steps) keywords[1].push(...step.keywords);

      // Find subtitles
      for (const title of (html.match(/<h2>[\w\s]+<\/h2>/g) || [])) {
        keywords[2].push(title.slice(4, title.length - 5));
      }

      // Find glossary entries in this course
      for (const link of (html.match(/xid="[\w-]+"/g) || [])) {
        const key = link.slice(5, link.length - 1);
        if (glossary[key]) keywords[2].push(glossary[key].title);
      }

      // Find bold words
      for (const strong of (html.match(/<strong>[\w\s]+<\/strong>/g) || [])) {
        keywords[3].push(strong.slice(8, strong.length - 9));
      }

      documents.push({
        id: `course:${course.id}:${section.id}`,
        keywords,
        title: section.title,
        subtitle: (course.level ? course.level + ' – ' : '') + course.title,
        image: `background-color: ${course.color}; background-image: url(${course.icon || course.hero})`,
        url: section.url
      });
    }
  }

  for (const [key, data] of Object.entries(glossary)) {
    let body = (data.image) ? `<img alt="" src="/content/shared/glossary/${data.image}"/>` : '';
    body += data.text;
    const multiWord = data.title.split(' ').length > 1;
    // Single-word glossary entries have a higher priority, to fix sorting.
    const keywords = multiWord ? [[], [data.title]] : [[data.title], []];
    documents.push({
      id: `gloss:${key}`,
      keywords: [...keywords, [data.keywords || '']],
      title: data.title,
      subtitle: body
    });
  }

  return documents;
}


// -----------------------------------------------------------------------------
// Generate Map

function clean(keywords) {
  const cleaned = keywords.join(' ').trim().toLowerCase().normalize('NFD')
      .replace(/[-_\s]+/, ' ').replace(/[^a-z0-9 ]/g, '').split(' ')
      .map(w => wordClean(w));

  return unique(cleaned).filter(w => !w.match(/^[0-9]+$/))
      .filter(w => (w === 'pi' || w.length > 2))  // Keywords must be >2 characters, except "pi"
      .filter(w => !IGNORED_WORDS.includes(w));
}

function addKeyword(index, keyword, docId, priority) {
  if (!index[keyword]) index[keyword] = [];
  const i = index[keyword].findIndex(s => s.slice(2) === docId);

  // Make sure we keep the highest priority instance of this document.
  if (i < 0) return index[keyword].push(priority + ':' + docId);
  if (+index[keyword][i][0] <= priority) return;
  index[keyword][i] = priority + ':' + docId;
}

async function buildSearch() {
  const start = Date.now();
  const documents = await loadDocuments();
  const index = {};

  for (const doc of documents) {
    for (const priority of [0, 1, 2, 3]) {
      for (const keyword of clean(doc.keywords[priority] || [])) {
        addKeyword(index, keyword, doc.id, priority);
      }
    }
  }

  // Reconcile pluralised words.
  for (const key of Object.keys(index)) {
    const plural = key + (key.endsWith('s') ? 'es' : 's');
    if (!index[plural]) continue;
    for (const p of index[plural]) addKeyword(index, key, p.slice(2), +p[0]);
    index[plural] = index[key];  // Maybe just delete map[plural]?
  }

  // Special handling for certain keywords
  if (index.pythagoras) index.pythagorean = index.pythagoras;

  // Write search index to file
  const sortedIndex = {};
  for (const s of Object.keys(index).sort()) sortedIndex[s] = index[s].sort();
  await writeFile(OUTPUT + '/search-index.json', JSON.stringify(sortedIndex));

  // Generate search documents
  const docs = {};
  for (const {id, title, subtitle, url, image, type} of documents) {
    docs[id] = {title, type: type || id.split(':')[0], subtitle, url, image};
  }

  // Write search documents to file
  const sortedDocs = {};
  for (const s of Object.keys(docs).sort()) sortedDocs[s] = docs[s];
  await writeFile(OUTPUT + '/search-docs.json', JSON.stringify(sortedDocs));
  success('search-index.json and search-docs.json', Date.now() - start);
}

module.exports.buildSearch = buildSearch;
