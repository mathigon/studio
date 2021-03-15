#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');


// Hide dynamic elements for better diffing.
const CUSTOM_CSS = `iframe, video[controls], g.pulses, x-gesture, svg.graph { display: none !important; }
* { text-rendering: optimizeSpeed !important; -webkit-font-smoothing: antialiased !important; }`;

// Load all URLs to screenshot from the sitemap file.
const sitemap = fs.readFileSync(path.join(__dirname, '../.output/sitemap.xml'), 'utf8');
const urls = (sitemap.match(/<loc>[\w+/:.]+<\/loc>/g) || [])
    .map(l => new URL(l.slice(5, l.length - 6)).pathname);

// Output director for screenshot PNGs.
const i = process.argv.indexOf('--output');
const outDir = i ? process.argv[i + 1] : 'screenshots';
const dir = path.join(process.cwd(), outDir);
if (!fs.existsSync(dir)) fs.mkdirSync(dir);


(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({width: 1200, height: 960});

  // TODO Seed Math.random()
  // TODO Disable WebGL Errors
  page.on('pageerror', e => {
    console.log('\x1b[31m', 'JS error on page', page.url());
    console.log('\x1b[0m', '  ', e.message.split('\n')[0]);
  });

  for (const url of urls) {
    // TODO Make the localhost port configurable!
    await page.goto(`http://localhost:8080${url}#full`);
    await page.addStyleTag({content: CUSTOM_CSS});
    const file = `${dir}/${(url.slice(1) || 'home').replace(/\//g, '-')}.png`;
    await page.screenshot({path: file, fullPage: true});
  }

  await browser.close();
  process.exit();
})();
