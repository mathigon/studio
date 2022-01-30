// =============================================================================
// Utility Functions
// (c) Mathigon
// =============================================================================


import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import yaml from 'js-yaml';

import {cache, Color, deepExtend, last, total} from '@mathigon/core';
import {Config, Course, Section} from '../interfaces';
import {Locale} from './i18n';


export const STUDIO_DIR = path.join(__dirname, '../../');
export const PROJECT_DIR = process.cwd();
export const OUT_DIR = PROJECT_DIR + '/public';

export const ENV = process.env.NODE_ENV || 'development';
export const IS_PROD = ENV === 'production';

export const ONE_YEAR = 1000 * 60 * 60 * 24 * 365;


// -----------------------------------------------------------------------------
// File Loading

function cacheIfProd<T>(fn: (...args: any[]) => T) {
  return IS_PROD ? cache(fn) : fn;
}

export const loadYAML = cacheIfProd((file: string) => {
  // TODO Support both .yaml and .yml extensions
  if (!fs.existsSync(file)) return undefined;
  return yaml.load(fs.readFileSync(file, 'utf8')) as unknown;
});

export const loadJSON = cacheIfProd((file: string) => {
  // TODO Maybe should use require() instead?
  if (!fs.existsSync(file)) return undefined;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
});

export const loadData = (file: string) => {
  return loadYAML(path.join(__dirname, `../data/${file}.yaml`));
};

export const getCourse = cacheIfProd((courseId: string, locale = 'en'): Course|undefined => {
  const course = loadJSON(OUT_DIR + `/content/${courseId}/data_${locale}.json`) as Course;
  if (!course && locale !== 'en') return getCourse(courseId);  // Return English fallback
  if (!course) return undefined;
  return course;
});

function resolve(file: string, base = 'frontend/assets') {
  const p1 = path.join(PROJECT_DIR, base, file);
  if (fs.existsSync(p1)) return fs.readFileSync(p1, 'utf-8');
  const p2 = path.join(STUDIO_DIR, base, file);
  if (fs.existsSync(p2)) return fs.readFileSync(p2, 'utf-8');
}

/**
 * On its own, PUG doesn't allow dynamic includes (e.g. for file paths provided
 * in a configuration file). Here, we manually load and insert an external file.
 */
export const include = cache((file: string, base = 'frontend/assets') => {
  const content = resolve(file, base as string);
  if (!content) throw new Error(`Can't find file "${file}" in "${base}".`);
  return content;
});

/** Merge two YAML files from the studio directory and the project directory. */
export function loadCombinedYAML(file: string, deep = false) {
  const studio = loadYAML(path.join(STUDIO_DIR, file)) || {};
  const project = loadYAML(path.join(PROJECT_DIR, file)) || {};
  deep ? deepExtend(studio, project, (a, b) => b) : Object.assign(studio, project);
  return studio as unknown;
}

// Configuration files
export const CONFIG = loadCombinedYAML('config.yaml', true) as Config;
export const CONTENT_DIR = path.join(PROJECT_DIR, CONFIG.contentDir);

// List of all courses
export const COURSES = fs.readdirSync(CONTENT_DIR)
    .filter(id => id !== 'shared' && !id.includes('.') && !id.startsWith('_'));


// -----------------------------------------------------------------------------
// Utility Functions

/**
 * Wrap Express request handlers to always add a .catch() to asynchronous
 * handlers. This should be done natively in Express 5.0.0, so that we can
 * remove this.
 * @param fn
 */
export function promisify(fn: (req: express.Request, res: express.Response, next: express.NextFunction) => void) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);
}

export function href(req: express.Request, locale = req.locale.id) {
  const path = req.path.endsWith('/') ? req.path.slice(0, req.path.length - 1) : req.path;
  const subdomain = (locale !== 'en') ? locale + '.' : '';
  return `https://${subdomain}${CONFIG.domain}${path}`;
}

export function lighten(c: string, amount: 0.15) {
  const hsl = Color.from(c).hsl as [number, number, number];
  hsl[1] = Math.min(100, hsl[1] * (1 + amount));
  hsl[2] = Math.min(100, hsl[2] * (1 + amount));
  return Color.fromHsl(...hsl).hex;
}

/**
 * Determine which section or course to link to at the end of this one. Returns
 * the next course if shift = 1, or the previous course if shift = -1.
 */
export function findNextSection(course: Course, section: Section, shift = 1) {
  // TODO Personalise this, based on users' previous work
  const nextSection = course.sections[course.sections.indexOf(section) + shift];
  if (nextSection) return {section: nextSection};
  const nextCourse = getCourse(shift > 0 ? course.nextCourse : course.prevCourse, course.locale);
  if (!nextCourse) return {section: shift > 0 ? course.sections[0] : last(course.sections)};
  return {course: nextCourse, section: shift > 0 ? nextCourse.sections[0] : last(nextCourse.sections)};
}

/** Returns the last value in an arry for which a callback returns true. */
export function findLastIndex<T>(array: T[], callback: (value: T, i: number) => boolean) {
  for (let i = array.length - 1; i >= 0; i--) {
    if (callback(array[i], i)) return i;
  }
  return -1;
}

export function age(birthDate: Date) {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age = age - 1;
  }
  return age;
}

export function dateString(date: Date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return [year, month, day].join('-');
}

/** Returns the date a given (integer) number of days ago. */
export function pastDate(daysBack: number) {
  const date = new Date();
  date.setDate(date.getDate() - daysBack);
  return date;
}

/** Better handling for string query parameters. */
export function q(req: express.Request, name: string) {
  return req.query?.[name]?.toString() || '';
}

export function hash(str: string, n: number): number {
  return total(str.split('').map(c => c.charCodeAt(0))) % n;
}


// -----------------------------------------------------------------------------
// Static File Caching

const FILE_NAME_CACHE = new Map<string, string>();

export function cacheBust(file: string, locale: Locale) {
  if (file.startsWith('http')) return file;

  // We only cache the result in production, to allow real-time updating.
  const key = file + locale.id;
  if (IS_PROD && FILE_NAME_CACHE.has(key)) return FILE_NAME_CACHE.get(key)!;

  // Handle localised JS and CSS files
  if (file.endsWith('.css')) {
    const file1 = file.replace('.css', '.rtl.css');
    if (locale?.dir === 'rtl' && fs.existsSync(OUT_DIR + file1)) file = file1;
  } else if (file.endsWith('.js')) {
    const file1 = file.replace('.js', `.${locale?.id}.js`);
    if (locale?.id !== 'en' && fs.existsSync(OUT_DIR + file1)) file = file1;
  }

  // Hash the files for cache busting
  if (fs.existsSync(OUT_DIR + file)) {
    const content = fs.readFileSync(OUT_DIR + file, 'utf-8');
    const token = crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
    file = file.replace(/\.(\w+)$/g, `.${token}.$1`);
  }

  FILE_NAME_CACHE.set(key, file);
  return file;
}

export function removeCacheBust(file: string) {
  return file.replace(/\.([a-z0-9]{4,})\.(js|css|svg|mp3)/, (_1, _2, ext) => `.${ext}`);
}
