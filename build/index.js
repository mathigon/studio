#!/usr/bin/env node
'use strict';

const yargs = require('yargs-parser');
const argv = yargs(process.argv.slice(2));

const {buildAssets} = require('./assets');
const {CONFIG} = require('./utilities');
const {buildSearch} = require('./tools/search');


(async () => {
  // Build assets using `mgon-build --assets [--minify] [--watch]`
  if (argv.assets) {
    const locales = argv.locales ? argv.locales.split(',') : CONFIG.locales;
    await buildAssets(argv.minify || false, argv.watch || false, locales);
  }

  // Build the search index
  if (argv.search && CONFIG.search.enabled) await buildSearch();

  // Build course thumbnails
  if (argv.thumbnails) await require('./tools/thumbnails').buildCourseThumbnails();

  // Translate content using `mgon-build --translate --key service-account.json`
  if (argv.translate) await require('./tools/translate').translate(argv.key, argv.all || false);

  // Generate list of all OS dependency licenses
  if (argv.licenses) await require('./tools/licenses').getLicenses();

  console.log('\x1b[32m  DONE!\x1b[0m');
})();
