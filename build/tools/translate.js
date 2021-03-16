// =============================================================================
// Generate Translations using Google Translate
// (c) Mathigon
// =============================================================================


const path = require('path');
const yaml = require('js-yaml');
const {Translate} = require('@google-cloud/translate').v2;
const {loadYAML, CONFIG, writeFile} =  require('../utilities')


async function loadFromGoogle(api, string, locale) {
  const result = await api.translate(string, locale);
  const str = Array.isArray(result) ? result[0] : result;
  return str.replace(/\$ 0/g, '$0');
}

async function translate(key, allLocales = false) {
  const api = new Translate({keyFilename: path.join(process.cwd(), key)});
  const locales = loadYAML(path.join(__dirname, `../../server/data/locales.yaml`));
  const strings = Object.keys(loadYAML(process.cwd() + '/translations/strings.yaml'));
  const available = CONFIG.locales || ['en'];

  for (const [locale, options] of Object.entries(locales)) {
    if (locale === 'en') continue;
    if (!allLocales && !available.includes(locale)) continue;

    console.log(`\x1b[33m  Translating ${locale}...`);
    const file = process.cwd() + `/translations/${locale}/strings.yaml`;

    const data = loadYAML(file)
    for (const str of strings) {
      if (!data[str]) data[str] = await loadFromGoogle(api, str, options.google || locale);
    }

    await writeFile(file, yaml.dump(data, {sortKeys: true}));

    // TODO Translate course content
  }
}

module.exports.translate = translate;
