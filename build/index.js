#!/usr/bin/env node
'use strict';

const {buildAssets} = require('./assets');
const {CONFIG} = require('./utilities');
const {buildSearch} = require('./tools/search');
const {buildCourseThumbnails} = require('./tools/thumbnails');

const assets = process.argv.includes('--assets');
const minify = process.argv.includes('--minify');
const watch = process.argv.includes('--watch');
const thumbnails = process.argv.includes('--thumbnails');

(async () => {
  if (assets) await buildAssets(minify, watch);
  if (assets && CONFIG.search.enabled) await buildSearch();
  if (thumbnails) await buildCourseThumbnails();
  // TODO Run plugin build scripts
  console.log('\x1b[32m  Server ready!');
})();
