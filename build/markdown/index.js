// =============================================================================
// Mathigon Studio Markdown Parser
// (c) Mathigon
// =============================================================================


const path = require('path');
const {toTitleCase, last} = require('@mathigon/core');
const {readFile, warning, loadYAML, CONTENT} = require('../utilities');
const {parseStep, parseSimple} = require('./parser');


// -----------------------------------------------------------------------------
// YAML Parsing utilities

const YAML_CACHE = new Map();

/** Resolve locale-based filenames. */
function resolvePath(courseId, file, locale = 'en') {
  if (locale === 'en') return path.join(CONTENT, courseId, file);
  return path.join(CONTENT, 'translations', locale, courseId, file);
}

/** Some YAML files contain markdown that needs to be parsed separately. */
async function parseYAML(courseId, file, locale, markdownField) {
  const src = resolvePath(courseId, file, locale);
  if (YAML_CACHE.has(src)) return YAML_CACHE.get(src);

  let data = await loadYAML(src);

  for (const [key, value] of Object.entries(data)) {
    if (markdownField === '*') {
      // Top-level keys (in hints.yaml)
      data[key] = await (Array.isArray(value) ? Promise.all(value.map(v => parseSimple(v))) : parseSimple(value));
    } else {
      // Nested objects (in bios.yaml and gloss.yaml)
      value[markdownField] = await parseSimple(value[markdownField] || '');
    }
  }

  // Fallback for non-english languages
  if (locale !== 'en') {
    const fallback = parseYAML(courseId, file, 'en', markdownField);
    data = Object.assign({}, fallback, data);
  }

  YAML_CACHE.set(src, data);
  return data;
}

/** Merge and filter the YAML files for a course. */
async function bundleYAML(file, courseID, locale, filterKeys) {
  const mdField = file === 'gloss.yaml' ? 'text' : file === 'bios.yaml' ? 'bio' : '*';
  const course = await parseYAML(courseID, file, locale, mdField);
  const shared = await parseYAML('shared', file, locale, mdField);

  const result = {};
  if (!filterKeys) return Object.assign(result, shared, course);

  const missing = [];
  for (const key of filterKeys) {
    result[key] = course[key] || shared[key] || undefined;
    if (!result[key]) missing.push(key);
  }

  if (locale === 'en' && missing.length) warning(`Missing keys in ${file}: ${missing.join(', ')}`);
  return result;
}


// -----------------------------------------------------------------------------
// Bundle Course Markdown

async function parseCourse(srcDir, locale) {
  const courseId = path.basename(srcDir);
  const srcFile = resolvePath(courseId, 'content.md', locale);
  const content = readFile(srcFile);
  if (!content) return undefined;

  // TODO Caching for files that haven't changed.

  // Keep track of all glossary and biography keys used within this course.
  const gloss = new Set();
  const bios = new Set();

  const steps = content.split(/\n---+\n/);
  const stepsParsed = await Promise.all(steps.map((s, i) => parseStep(s, i, courseId, locale)));

  const course = {
    id: courseId, locale,
    title: steps[0].courseTitle || 'Untitled Course',
    description: steps[0].description || '',
    color: steps[0].color || '#2274e8',
    trailer: steps[0].trailer || undefined,
    author: steps[0].author || undefined,
    level: steps[0].level || undefined,
    icon: steps[0].icon ? path.join(srcDir, steps[0].icon) : undefined,
    hero: path.join(srcDir, steps[0].hero || 'hero.jpg'),
    goals: 0, sections: [], steps: {}
  };

  for (const step of stepsParsed) {
    if (course.steps[step.id]) warning(`Duplicate Step ID: ${step.id}`);

    // Update course-level data
    course.goals += step.goals.length;
    for (const key of step.gloss) gloss.add(key);
    for (const key of step.bios) bios.add(key);

    // Create a new section
    if (step.sectionTitle) {
      const sectionId = step.section || step.sectionTitle.toLowerCase().replace(/\s/g, '-').replace(/[^\w-]/g, '');
      course.sections.push({
        id: sectionId,
        title: step.sectionTitle.replace(/\\/g, ''),  // No escape characters in title strings
        background: step.sectionBackground || undefined,
        locked: (step.sectionStatus === 'dev') || undefined,
        autoTranslated: (step.translated === 'auto') || undefined,
        url: step.url || `/course/${courseId}/${sectionId}`,
        steps: [], goals: 0, duration: 0
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
    course.steps[step.id] = {id: step.id, title, html: step.html, goals: step.goals};
  }

  for (const [i, section] of course.sections.entries()) {
    // Round the duration of every section to the nearest multiple of 5 (minutes).
    section.duration = Math.max(5, 5 * Math.ceil(section.duration / 5));

    // Set up the next links for all sections
    if (course.sections[i + 1]) {
      section.next = {sectionId: course.sections[i + 1].id};
    } else {
      section.next = {courseId: '', sectionId: ''}; // TODO Set this!
    }
  }

  if (!course.description) course.description = course.sections.map(s => s.title).join(', ');
  course.availableLocales = [];  // TODO Set this!

  course.biosJSON = JSON.stringify(bundleYAML('bios.yaml', courseId, locale, bios));
  course.glossJSON = JSON.stringify(bundleYAML('gloss.yaml', courseId, locale, gloss));
  course.hintsJSON = JSON.stringify(bundleYAML('hints.yaml', courseId, locale));

  return {course, srcFile};
}

module.exports.parseCourse = parseCourse;
