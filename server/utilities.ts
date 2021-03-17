// =============================================================================
// Utility Functions
// (c) Mathigon
// =============================================================================


import * as express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as yaml from 'js-yaml';

import {cache, Color, deepExtend} from '@mathigon/core';
import {Config, Course, Section} from './interfaces';


export const STUDIO_DIR = path.join(__dirname, '../');
export const PROJECT_DIR = process.cwd();
export const OUT_DIR = STUDIO_DIR + '/.output';

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

export const getCourse = cacheIfProd((courseId: string, locale = 'en'): Course|undefined => {
  const course = loadJSON(OUT_DIR + `/content/${courseId}/data_${locale}.json`) as Course;
  if (!course && locale !== 'en') return getCourse(courseId);  // Return English fallback
  if (!course) return undefined;
  return course;
});

/**
 * On its own, PUG doesn't allow dynamic includes (e.g. for file paths provided
 * in a configuration file). Here, we manually load and insert an external file.
 */
export const include = cache((file: string, base = 'frontend/assets') => {
  const p1 = path.join(PROJECT_DIR, base, file);
  if (fs.existsSync(p1)) return fs.readFileSync(p1, 'utf-8');
  const p2 = path.join(STUDIO_DIR, base, file);
  if (fs.existsSync(p2)) return fs.readFileSync(p2, 'utf-8');
  throw new Error(`Can't find file "${file}" in "${base}".`);
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

export function safeToJson<T>(str: string, fallback?: T, allowedKeys?: string[]): T|undefined {
  if (!str) return fallback;
  try {
    // Filter only specific keys in a JSON object.
    const reviver = allowedKeys ? function(this: any, key: string, value: any) {
      if (!key || Array.isArray(this) || allowedKeys.includes(key)) return value;
    } : undefined;
    return JSON.parse(str, reviver) || fallback;
  } catch (e) {
    return fallback;
  }
}

/** Determine which section or course to link to at the end of this one. */
export function findNextSection(course: Course, section: Section) {
  // TODO Personalise this, based on users' previous work
  const nextSection = course.sections[course.sections.indexOf(section) + 1];
  if (nextSection) return {section: nextSection};
  const nextCourse = getCourse(course.nextCourse, course.locale)!;
  return {course: nextCourse, section: nextCourse.sections[0]};
}


// -----------------------------------------------------------------------------
// Static File Caching

const FILE_NAME_CACHE = new Map<string, string>();

export function cacheBust(file: string) {
  if (FILE_NAME_CACHE.has(file)) return FILE_NAME_CACHE.get(file)!;
  if (file.startsWith('http')) return file;

  const fileName = path.join(__dirname, '../.output', file);
  if (!fs.existsSync(fileName)) return file;

  const content = fs.readFileSync(fileName);
  const token = crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
  const newFile = file.replace(/\.(\w+)$/g, `.${token}.$1`);

  // We only cache the result in production, to allow real-time updating.
  if (IS_PROD) FILE_NAME_CACHE.set(file, newFile);
  return newFile;
}

export function removeCacheBust(file: string) {
  return file.replace(/\.([a-z0-9]+)\.(js|css|svg|mp3)/,
      (m, p1, p2) => p1 === 'min' ? `.min.${p2}` : `.${p2}`);
}
