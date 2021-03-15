// =============================================================================
// Create Course Thumbnails
// (c) Mathigon
// =============================================================================


const fs = require('fs');
const path = require('path');
const glob = require('glob');
const puppeteer = require('puppeteer');
const pug = require('pug');
const {CONTENT, PROJECT_ASSETS, OUTPUT, CONFIG, success} = require('../utilities');


function loadImg(file, mime) {
  if (!fs.existsSync(file)) return '';
  const data = fs.readFileSync(file).toString('base64');
  return `data:image/${mime};base64,${data}`;
}

const courseBody = pug.compileFile(__dirname + '/thumb.pug', {});

const logo1 = loadImg(path.join(PROJECT_ASSETS, 'assets', CONFIG.header.logo), 'svg+xml');
const logo2 = loadImg(path.join(PROJECT_ASSETS, 'assets', CONFIG.header.title), 'svg+xml');


async function makeThumbnail(page, course, section) {
  const hero = loadImg(path.join(CONTENT, '../', course.hero), 'jpg');
  const icon = course.icon ? loadImg(path.join(CONTENT, '../', course.icon), 'jpg') : undefined;

  const output = path.join(OUTPUT, `content/${course.id}/thumbnails/${section.id}-${course.locale}.jpg`);
  await page.setContent(courseBody({course, section, hero, icon, logo1, logo2}));

  if (!fs.existsSync(path.dirname(output))) fs.mkdirSync(path.dirname(output));
  await page.screenshot({path: output, type: 'jpeg', quality: 90});
}


async function buildCourseThumbnails() {
  const start = Date.now();
  const courses = glob.sync('content/*/data_*.json', {cwd: OUTPUT})
      .map(c => require(path.join(OUTPUT, c)));

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  page.setViewport({width: 720, height: 360});

  console.log('\x1b[33m  Generating course tiles...\x1b[0m');
  const promises = [];
  for (const course of courses) {
    for (const section of course.sections) {
      promises.push(makeThumbnail(page, course, section));
    }
  }

  await Promise.all(promises);
  await browser.close();
  success(`${promises.length} course thumbnails`, Date.now() - start);
}

module.exports.buildCourseThumbnails = buildCourseThumbnails;
