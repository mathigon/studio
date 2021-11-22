// =============================================================================
// Search Utilities
// (c) Mathigon
// =============================================================================


import {Cache, stringDistance, unique} from '@mathigon/core';
import {loadJSON, OUT_DIR} from './utilities/utilities';

// TODO Ensure that these files have been generated before restarting!
export const SEARCH_DOCS = loadJSON(OUT_DIR + '/search-docs.json') as Record<string, string> || {};
const SEARCH_INDEX = loadJSON(OUT_DIR + '/search-index.json') as Record<string, string> || {};
const KEYWORDS = Object.keys(SEARCH_INDEX);

const CACHE = new Cache(1000);  // Cache the last 1000 search queries


function autocomplete(str: string): string[] {
  if (!str) return [];
  const options = KEYWORDS.filter(s => s[0] === str[0]);

  const match = SEARCH_INDEX[str] ? [str] : [];
  const completed = options.filter(s => s.startsWith(str));

  const maxDistance = str.length <= 3 ? 0 : str.length <= 6 ? 1 : 2;
  let corrected: [number, string][] = [];
  for (const t of options) {
    const d = stringDistance(str, t, true);  // Ignore trailing characters in t.
    if (d <= maxDistance) corrected.push([d, t]);
  }
  corrected = corrected.sort((a, b) => a[0] - b[0]);

  return unique([...match, ...completed, ...corrected.map(t => t[1])]);
}

function getSearchResults(query: string) {
  // TODO Performance improvements

  const allResults = query.split(' ').map(k => {
    const docs = autocomplete(k).flatMap(o => SEARCH_INDEX[o]);
    return unique(docs.map(t => t.slice(2)));  // Remove priority keys
  }) as string[][];

  // Prioritise results that contain all keywords.
  const common = allResults[0].filter(k => allResults.every(r => r.includes(k)));

  for (let i = 0; i < 5; ++i) {
    for (const r of allResults) {
      if (r[i] && !common.includes(r[i])) common.push(r[i]);
    }
  }

  const glossary = common.find(g => g.startsWith('gloss'));
  const results = common.filter(g => !g.startsWith('gloss'));

  if (glossary) results.unshift(glossary);
  return results.slice(0, 5).map(key => SEARCH_DOCS[key]);
}

export function search(query: string) {
  query = query.trim().toLowerCase().normalize('NFD')
      .replace(/[-_\s]+/, ' ').replace(/[^a-z0-9 ]/g, '')
      .split(' ').filter(t => (t === 'pi' || t.length > 2)).join(' ');

  if (!query.length) return;
  return CACHE.getOrSet(query, getSearchResults);
}
