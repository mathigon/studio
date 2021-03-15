#!/usr/bin/env node
'use strict';

const {buildAssets} = require('./assets');
const {buildSearch} = require('./search');
const {CONFIG} = require('./utilities');

const minify = process.argv.includes('--minify');
const watch = process.argv.includes('--watch');

(async () => {
  await buildAssets(minify, watch);
  if (CONFIG.search.enabled) await buildSearch();
  // TODO Run plugin build scripts
  console.log('\x1b[32m  Server ready!');
})();
