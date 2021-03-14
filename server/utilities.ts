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
import {Config, Course} from './interfaces';


export const CORE_DIR = path.join(__dirname, '../');
export const PROJECT_DIR = process.cwd();

export const ENV = process.env.NODE_ENV || 'development';
export const IS_PROD = ENV === 'production';

export const ONE_YEAR = 1000 * 60 * 60 * 24 * 365;


// -----------------------------------------------------------------------------
// Data Loading

export const loadYAML = cache((file: string) => {
  // TODO Support both .yaml and .yml extensions
  return yaml.load(fs.readFileSync(file, 'utf8'));
});

export const getCourse = cache<Course>((courseId: string, locale: string) => {
  return require(`../.output/content/${courseId}/data_${locale}.json`);
});

// Configuration
export const CONFIG = loadYAML(CORE_DIR + '/config.yaml') as Config;
const PROJECT_CONFIG = loadYAML(PROJECT_DIR + '/config.yaml');
deepExtend(CONFIG, PROJECT_CONFIG, (a, b) => b);


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

export function lighten(c: string) {
  const hsl = Color.from(c).hsl as [number, number, number];
  hsl[1] = Math.min(100, hsl[1] * 1.14);
  hsl[2] = Math.min(100, hsl[2] * 1.14);
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


// -----------------------------------------------------------------------------
// Static File Caching

const FILE_NAME_CACHE = new Map<string, string>();

export function cacheBust(file: string) {
  if (FILE_NAME_CACHE.has(file)) return FILE_NAME_CACHE.get(file)!;
  if (file.startsWith('http')) return file;

  const fileName = path.join(__dirname, '../.output', file);
  if (!fs.existsSync(fileName)) return file;

  const content = fs.readFileSync(fileName);
  const token = crypto.createHash('md5').update(content).digest('hex').substr(26);
  const newFile = file.replace(/\.(\w+)$/g, `.${token}.$1`);

  // We only cache the result in production, to allow real-time updating.
  if (IS_PROD) FILE_NAME_CACHE.set(file, newFile);
  return newFile;
}

export function removeCacheBust(file: string) {
  return file.replace(/\.([a-z0-9]+)\.(js|css|svg|mp3)/,
      (m, p1, p2) => p1 === 'min' ? `.min.${p2}` : `.${p2}`);
}
