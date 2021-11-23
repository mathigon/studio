// =============================================================================
// Mathigon Studio Markdown Parser
// (c) Mathigon
// =============================================================================


const fs = require('fs');
const path = require('path');
const glob = require('glob');

const {toTitleCase, last, words, throttle} = require('@mathigon/core');
const {mod} = require('@mathigon/fermat');
const {readFile, warning, loadYAML, OUTPUT, writeFile, textHash} = require('../utilities');
const {writeTexCache} = require('./mathjax');
const {parseStep, parseSimple} = require('./parser');

const COURSE_URLS = new Set();  // Used for Sitemap generation

const CACHE_FILE = OUTPUT + '/cache.json';
const CACHE = JSON.parse(readFile(CACHE_FILE, '{}'));


// -----------------------------------------------------------------------------
// YAML Parsing utilities

const YAML_CACHE = new Map();

/** Resolve locale-based filenames. */
function resolvePath(directory, file, locale = 'en') {
  if (locale === 'en') return path.join(directory, file);
  const courseId = path.basename(directory);
  return path.join(directory, '../../translations', locale, courseId, file);
}

/** Some YAML files contain markdown that needs to be parsed separately. */
async function parseYAML(directory, file, locale, markdownField, cache = true) {
  const src = resolvePath(directory, file, locale);
  if (cache && YAML_CACHE.has(src)) return YAML_CACHE.get(src);

  let data = await loadYAML(src);

  for (const [key, value] of Object.entries(data)) {
    if (markdownField === '*') {
      // Top-level keys (in hints.yaml)
      data[key] = await (Array.isArray(value) ? Promise.all(value.map(v => parseSimple(v))) : parseSimple(value));
    } else if (markdownField) {
      // Nested objects (in bios.yaml and gloss.yaml)
      value[markdownField] = await parseSimple(value[markdownField] || '');
    }
  }

  // Fallback for non-english languages
  if (locale !== 'en') {
    const fallback = await parseYAML(directory, file, 'en', markdownField, cache);
    data = Object.assign({}, fallback, data);
  }

  if (cache) YAML_CACHE.set(src, data);
  return data;
}

/** Merge and filter the YAML files for a course. */
async function bundleYAML(file, directory, locale, filterKeys) {
  const mdField = file === 'glossary.yaml' ? 'text' : file === 'bios.yaml' ? 'bio' : '*';
  const course = await parseYAML(directory, file, locale, mdField);
  const shared = await parseYAML(path.join(directory, '../shared'), file, locale, mdField);

  const result = {};
  if (!filterKeys) return Object.assign(result, shared, course);

  const missing = [];
  for (const key of filterKeys) {
    result[key] = course[key] || shared[key] || undefined;
    if (!result[key]) missing.push(key);
  }

  const courseID = path.basename(directory);
  if (locale === 'en' && missing.length) warning(`Missing ${file.split('.')[0]} keys in ${courseID}: ${missing.join(', ')}`);
  return result;
}

function getNextCourse(directory, shift = 1) {
  // Find the next (or previous if shift = -1) course alphabetically.
  const courseId = path.basename(directory);
  const allCourses = glob.sync('!(shared|_*|*.*)', {cwd: path.join(directory, '../')});
  return allCourses[mod(allCourses.indexOf(courseId) + shift, allCourses.length)];
}


// -----------------------------------------------------------------------------
// Bundle Course Markdown

async function parseCourse(directory, locale, allLocales = ['en']) {
  const courseId = path.basename(directory);
  const srcFile = resolvePath(directory, 'content.md', locale);
  const content = readFile(srcFile);
  if (!content) return;

  // Generate hash, to avoid re-compiling courses that didn't change.
  const hash = textHash(content);
  if (CACHE[courseId + '-' + locale] === hash) return {srcFile};

  // Keep track of all glossary and biography keys used within this course.
  const gloss = new Set();
  const bios = new Set();

  const steps = content.split(/\n---+\r?\n/);
  const parsed = await Promise.all(steps.map((s, i) => parseStep(s, i, directory, courseId, locale)));

  const course = {
    id: courseId, locale,
    nextCourse: parsed[0].next || getNextCourse(directory),
    prevCourse: parsed[0].prev || getNextCourse(directory, -1),
    title: parsed[0].courseTitle || 'Untitled Course',
    description: parsed[0].description || '',
    color: parsed[0].color || '#2274e8',
    trailer: parsed[0].trailer || undefined,
    author: parsed[0].author || undefined,
    level: parsed[0].level || undefined,
    icon: parsed[0].icon ? path.join(`/content/${courseId}`, parsed[0].icon) : fs.existsSync(directory + '/icon.png') ? `/content/${courseId}/icon.png` : undefined,
    hero: path.join('/content', courseId, parsed[0].hero || 'hero.jpg'),
    goals: 0, sections: [], steps: {}
  };

  for (const step of parsed) {
    if (course.steps[step.id]) warning(`Duplicate Step ID: ${step.id}`);

    // Update course-level data
    course.goals += step.goals.length;
    for (const key of step.gloss) gloss.add(key);
    for (const key of step.bios) bios.add(key);

    // Create a new section
    if (step.sectionTitle) {
      // TODO We should always auto-generate section IDs using the English
      // section title, to prevent errors when switching between locales.
      const sectionId = step.section || step.sectionTitle.toLowerCase().replace(/\s/g, '-').replace(/[^\w-]/g, '');
      const url = step.url || `/course/${courseId}/${sectionId}`;
      course.sections.push({
        id: sectionId,
        title: step.sectionTitle.replace(/\\/g, ''),  // No escape characters in title strings
        background: step.sectionBackground || undefined,
        locked: (step.sectionStatus === 'dev') || undefined,
        autoTranslated: (step.translated === 'auto') || undefined,
        url, steps: [], goals: 0, duration: 0
      });
    }

    // Update section-level data
    const section = last(course.sections);
    if (!section) throw new Error('Every course has to start with a section title (##)');
    section.steps.push(step.id);
    section.goals += step.goals.length;
    section.duration += step.duration;

    // Set step-level data
    const title = step.title || toTitleCase(step.id.replace(/-|[0-9]+$/g, ' '));
    const keywords = step.keywords ? words(step.keywords) : [];
    course.steps[step.id] = {id: step.id, title, html: step.html, goals: step.goals, keywords};
  }

  // Round the duration of every section to the nearest multiple of 5 (minutes).
  for (const section of course.sections) {
    section.duration = Math.max(5, 5 * Math.ceil(section.duration / 5));
  }

  if (!course.description) course.description = course.sections.map(s => s.title).join(', ');

  // Find all locales that this course has been translated into.
  course.availableLocales = allLocales.filter(l => fs.existsSync(resolvePath(directory, 'content.md', l)));

  course.biosJSON = JSON.stringify(await bundleYAML('bios.yaml', directory, locale, bios));
  course.glossJSON = JSON.stringify(await bundleYAML('glossary.yaml', directory, locale, gloss));
  course.hintsJSON = JSON.stringify(await bundleYAML('hints.yaml', directory, locale));

  for (const s of course.sections) {
    if (locale === 'en' && !s.locked) COURSE_URLS.add(s.url);
  }

  CACHE[courseId + '-' + locale] = hash;
  return {course, srcFile};
}

function writeCache() {
  writeFile(CACHE_FILE, JSON.stringify(CACHE));
  writeTexCache();
}

module.exports.writeCache = throttle(writeCache, 1000);
module.exports.parseCourse = parseCourse;
module.exports.parseSimple = parseSimple;
module.exports.parseYAML = parseYAML;
module.exports.COURSE_URLS = COURSE_URLS;
