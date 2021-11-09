// =============================================================================
// Internationalisation Helper Functions
// (c) Mathigon
// =============================================================================


import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import express from 'express';
import {CONFIG, IS_PROD, loadCombinedYAML, loadData, loadYAML, PROJECT_DIR, STUDIO_DIR} from './utilities';


export type Locale = {id: string, key: string, name: string, flag: string, dir?: string, google?: string};

const COUNTRIES = loadData('countries') as Record<string, string>;
export const LOCALES = loadData('locales') as Record<string, Locale>;
for (const id of Object.keys(LOCALES)) LOCALES[id].id = id;

const EU_COUNTRIES = ['BE', 'BG', 'CZ', 'DK', 'DE', 'EE', 'IE', 'EL', 'ES',
  'FR', 'HR', 'IT', 'CY', 'LV', 'LT', 'LU', 'HU', 'MT', 'NL', 'AT', 'PL', 'PT',
  'RO', 'SI', 'SK', 'FI', 'SE', 'GB'];

// TODO Filter only valid locales!
export const AVAILABLE_LOCALES = CONFIG.locales.map((l: string) => LOCALES[l]);


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
  return LOCALES['' + req.query.hl] || LOCALES[req.subdomains[req.subdomains.length - 1]] || LOCALES[fallback];
}


// -----------------------------------------------------------------------------
// Translations

// In development mode, we keep a list of all strings accessed using __().
const STRINGS = IS_PROD ? {} : loadCombinedYAML('translations/strings.yaml') as Record<string, string>;
const STUDIO_STRINGS = IS_PROD ? {} : loadYAML(STUDIO_DIR + '/translations/strings.yaml') as Record<string, string>;

// We load the files with all translated UI strings.
const TRANSLATIONS: Record<string, Record<string, string>> = {};
for (const locale of AVAILABLE_LOCALES) {
  if (locale.id === 'en') continue;
  TRANSLATIONS[locale.id] = loadCombinedYAML(`translations/${locale.id}/strings.yaml`) as Record<string, string>;
}

export function translate(locale: string, str: string, args: string[] = []) {
  // In development mode, we add any missing strings to the strings.yaml file.
  // Unless running in the docs/example directory, we filter all strings that
  // are already defined in the studio repo.
  if (!IS_PROD && AVAILABLE_LOCALES.length >= 1 && !(str in STRINGS)) {
    STRINGS[str] = '';
    const isExample = process.cwd() === path.join(__dirname, '../docs/example');
    const file = (isExample ? STUDIO_DIR : PROJECT_DIR) + '/translations/strings.yaml';
    const replacer = isExample ? undefined : (k: string, v: any) => (!k || !(k in STUDIO_STRINGS) ? v : undefined);
    if (!fs.existsSync(path.dirname(file))) fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, yaml.dump(STRINGS, {sortKeys: true, replacer}));
  }

  let str1 = (locale === 'en') ? str : (TRANSLATIONS[locale]?.[str] || str);

  // TODO Use https://messageformat.github.io/messageformat/ instead
  for (const [i, a] of args.entries()) str1 = str1.replace('$' + i, a);

  return str1;
}
