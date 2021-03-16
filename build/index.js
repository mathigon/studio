#!/usr/bin/env node
'use strict';

const yargs = require('yargs-parser');
const argv = yargs(process.argv.slice(2));

const {buildAssets} = require('./assets');
const {CONFIG} = require('./utilities');
const {buildSearch} = require('./tools/search');
const {buildCourseThumbnails} = require('./tools/thumbnails');
const {translate} = require('./tools/translate');


(async () => {
  // Build assets using `mgon-build --assets [--minify] [--watch]`
  if (argv.assets) await buildAssets(argv.minify || false, argv.watch || false);

  // Build the search index
  if (argv.search && CONFIG.search.enabled) await buildSearch();

  // Build course thumbnails
  if (argv.thumbnails) await buildCourseThumbnails();

  // Translate content using `mgon-build --translate --key service-account.json`
  if (argv.translate) await translate(argv.key, argv.all || false);

  console.log('\x1b[32m  DONE!\x1b[0m');
})();
