#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const yargs = require('yargs-parser');

const argv = yargs(process.argv.slice(2));
const port = (+argv.port) || 8080;
const dir = path.join(process.cwd(), argv.output || 'screenshots');  // Output director for PNGs
if (!fs.existsSync(dir)) fs.mkdirSync(dir, {recursive: true});


// Hide dynamic elements for better diffing.
const CUSTOM_CSS = `iframe, video[controls], g.pulses, x-gesture, svg.graph { display: none !important; }
* { text-rendering: optimizeSpeed !important; -webkit-font-smoothing: antialiased !important; }`;

// Load all URLs to screenshot from the sitemap file.
const sitemap = fs.readFileSync(path.join(process.cwd(), 'public/sitemap.xml'), 'utf8');
const urls = (sitemap.match(/<loc>[\w+/:.-]+<\/loc>/g) || [])
    .map(l => new URL(l.slice(5, l.length - 6)).pathname);

if (argv.urls) urls.push(...argv.urls.split(','));

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
    await page.goto(`http://localhost:${port}${url}#full`);
    await page.addStyleTag({content: CUSTOM_CSS});
    const file = (url.slice(1) || 'home').replace(/\//g, '-');
    await page.screenshot({path: `${dir}/${file}.png`, fullPage: true});
  }

  await browser.close();
  process.exit();
})();
