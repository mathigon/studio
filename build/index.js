#!/usr/bin/env node
'use strict';

const {buildAssets} = require('./assets');
const {buildSearch} = require('./search');

const minify = process.argv.includes('--minify');
const watch = process.argv.includes('--watch');

(async () => {
  await buildAssets(minify, watch);
  await buildSearch();
})();
