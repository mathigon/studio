// =============================================================================
// Internationalisation Helper Functions
// (c) Mathigon
// =============================================================================


import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import * as express from 'express';
import {CONFIG, IS_PROD, loadYAML, PROJECT_DIR} from './utilities';


export type Locale = {id: string, key: string, name: string, flag: string, dir?: string, google?: string};

const COUNTRIES = loadYAML(__dirname + '/data/countries.yaml') as Record<string, string>;
export const LOCALES = loadYAML(__dirname + '/data/locales.yaml') as Record<string, Locale>;
for (const id of Object.keys(LOCALES)) LOCALES[id].id = id;

const EU_COUNTRIES = ['BE', 'BG', 'CZ', 'DK', 'DE', 'EE', 'IE', 'EL', 'ES',
  'FR', 'HR', 'IT', 'CY', 'LV', 'LT', 'LU', 'HU', 'MT', 'NL', 'AT', 'PL', 'PT',
  'RO', 'SI', 'SK', 'FI', 'SE', 'GB'];

const CORE_TRANSLATIONS = path.join(__dirname, '../translations');
const PROJECT_TRANSLATIONS = path.join(PROJECT_DIR, CONFIG.translationsDir);

export const AVAILABLE_LOCALES = CONFIG.locales.map(l => LOCALES[l]);


// -----------------------------------------------------------------------------
// Translations

export function getCountry(req: express.Request) {
  // The [cf-ipcountry] header is added automatically by CloudFlare.
  const ipCountry = req.headers['cf-ipcountry'] as string|undefined;
  const code = ipCountry?.toUpperCase().slice(0, 2) || '';
  return (code in COUNTRIES) ? code : 'US';
}

/**
 * Checks if a country is located within the EU (for cookie consent).
 * @param countryCode {string}
 */
export function isInEU(countryCode: string) {
  return EU_COUNTRIES.includes(countryCode);
}

/**
 * Determines the locale of a request, using the ?hl= query string, first
 * subdomain, or defaulting to English.
 * @param req {express.Request}
 * @param fallback {string}
 */
export function getLocale(req: express.Request, fallback = 'en'): Locale {
  return LOCALES['' + req.query.hl] || LOCALES[req.subdomains[0]] || LOCALES[fallback];
}
