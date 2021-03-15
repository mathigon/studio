// =============================================================================
// Mathigon Studio Build Assets
// (c) Mathigon
// =============================================================================


const fs = require('fs');
const path = require('path');
const glob = require('glob');
const esbuild = require('esbuild');
const pug = require('pug');
const sass = require('sass');
const postcss = require('postcss');
const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');
const rtlcss = require('rtlcss');

const {error, readFile, success, writeFile, CONFIG, CORE_ASSETS, PROJECT_ASSETS, CONTENT, OUTPUT, watchFiles} = require('./utilities');
const {parseCourse, COURSE_URLS} = require('./markdown');
const {writeTexCache} = require('./markdown/mathjax');


// -----------------------------------------------------------------------------
// Styles

/** CSS properties to exclude from RTL conversion. */
const RTL_EXCLUDE = ['background', 'background-color', 'background-image',
  'background-repeat', 'background-size', 'cursor'];

const SAFE_AREA_VARS = ['safe-area-inset-top', 'safe-area-inset-bottom',
  'safe-area-inset-left', 'safe-area-inset-right'];

/** Custom PostCSS plugin for converting safe-area variables for iOS. */
const safeAreaCSS = {
  postcssPlugin: 'safe-area-inset',
  Root(root) {
    root.walkDecls(decl => {
      const vars = decl.value.match(/env\(([\w-]+)\)/g) || [];
      const match = SAFE_AREA_VARS.some(s => vars.includes(`env(${s})`));
      if (!match) return;

      let fallback1 = decl.value;
      let fallback2 = decl.value;

      for (const key of SAFE_AREA_VARS) {
        const regex = new RegExp(`env\\(${key}\\)`, 'g');
        fallback1 = fallback1.replace(regex, '0px');
        fallback2 = fallback2.replace(regex, `constant(${key})`);
      }

      decl.before(`${decl.prop}:${fallback1}`);
      decl.before(`${decl.prop}:${fallback2}`);
    });
  }
};

async function bundleStyles(srcPath, destPath, minify = false, watch = false) {
  const start = Date.now();
  const rtl = false;  // TODO Generate rtl files

  let output = sass.renderSync({
    file: srcPath,
    functions: {
      'uri-encode($str)': (str) => new sass.types.String(encodeURIComponent(str.getValue()))
    }
  });
  const files = output.stats.includedFiles;

  const postCSSOptions = [autoprefixer(), safeAreaCSS];
  if (rtl) postCSSOptions.shift(rtlcss({blacklist: RTL_EXCLUDE}));
  if (minify) postCSSOptions.push(cssnano());
  output = (await postcss(postCSSOptions).process(output.css, {from: undefined})).css;

  // TODO Use github.com/madyankin/postcss-modules to scope all component classes
  await writeFile(destPath, output);

  if (watch) {
    watchFiles(files, () => bundleStyles(srcPath, destPath, rtl, minify));
    // TODO Update watched files when output.includedFiles changes
  }

  const ms = Date.now() - start;
  success(srcPath, ms);
}


// -----------------------------------------------------------------------------
// Scripts

// Custom Rollup plugin for importing PUG files in TS.
// TODO Implement __() and generate translated bundles for each locale.
const pugOptions = {__: x => x, config: CONFIG};
const pugPlugin = {
  name: 'pug',
  setup: (build) => {
    build.onLoad({filter: /\.pug$/}, (args) => {
      const code = fs.readFileSync(args.path, 'utf8');
      const options = {compileDebug: false, filename: args.path, doctype: 'html'};
      const compiled = pug.compile(code, options)(pugOptions);
      return {contents: 'export default ' + JSON.stringify(compiled)};
    });
  }
};

async function bundleScripts(srcPath, destPath, minify = false, watch = false, name) {
  const start = Date.now();

  const result = await esbuild.build({
    entryPoints: [srcPath],
    bundle: true,
    minify,
    globalName: name,
    platform: 'browser',
    format: 'iife',
    plugins: [pugPlugin],
    target: ['es2016'],
    metafile: watch,
    write: false,
    banner: {js: '/* (c) Mathigon.org */'}
  });

  for (const file of result.outputFiles) {
    const text = file.text.replace(/\/\*![\s\S]*?\*\//g, '').trim();
    await writeFile(destPath, text);
  }

  if (watch) {
    const cwd = process.cwd();
    const files = Object.keys(result.metafile.inputs).filter(f => !f.startsWith('node_modules')).map(f => path.join(cwd, f));
    watchFiles(files, () => bundleScripts(srcPath, destPath, minify));
    // TODO Update watched files when output.includedFiles changes
  }

  const ms = Date.now() - start;
  success(srcPath, ms);
}


// -----------------------------------------------------------------------------
// Markdown Courses

async function bundleMarkdown(id, locale, watch = false) {
  const start = Date.now();

  const data = await parseCourse(path.join(CONTENT, id), locale);
  if (!data) return;

  const dest = path.join(OUTPUT, 'content', id, `data_${locale}.json`);
  await writeFile(dest, JSON.stringify(data.course));
  await writeTexCache();

  if (watch) {
    watchFiles([data.srcFile], () => bundleMarkdown(id, locale));
    // TODO Also watch markdown dependencies (e.g. SVG, PUG or YAML files)
  }

  const ms = Date.now() - start;
  success(`course ${id} [${locale}]`, ms);
}


// -----------------------------------------------------------------------------
// Miscellaneous Files

async function createPolyfill() {
  const src = path.join(__dirname, '../node_modules');
  const f1 = readFile(src + '/web-animations-js/web-animations.min.js');
  const f2 = readFile(src + '/@webcomponents/custom-elements/custom-elements.min.js');

  const polyfill = [f1, f2].join('\n').replace(/\nsourceMappingURL=.*\n/g, '\n');  // No Sourcemaps
  return writeFile(path.join(OUTPUT, 'polyfill.js'), polyfill);
}

async function createSitemap() {
  // TODO Generate sitemaps for locale subdomains
  // TODO Automatically generate the sitemap from Express router, rather than manually adding paths to config.yaml
  const options = '<changefreq>weekly</changefreq><priority>1.0</priority>';
  const urls = ['/', ...Array.from(COURSE_URLS), ...CONFIG.sitemap]
      .map(url => `<url><loc>https://${CONFIG.domain}${url}</loc>${options}</url>`);
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`;
  return writeFile(path.join(OUTPUT, 'sitemap.xml'), sitemap);
}


// -----------------------------------------------------------------------------
// Tools

function getAssetFiles(pattern, extension) {
  const projectFiles = glob.sync(pattern, {cwd: PROJECT_ASSETS}).map(c => path.join(PROJECT_ASSETS, c));
  const projectFileNames = projectFiles.map(p => path.basename(p));

  // Don't include any core files that are overwritten by the project.
  const studioFiles = glob.sync(pattern, {cwd: CORE_ASSETS}).map(c => path.join(CORE_ASSETS, c))
      .filter(p => !projectFileNames.includes(path.basename(p)));

  return [...studioFiles, ...projectFiles].map(src => {
    const dest = path.join(OUTPUT, path.basename(src).split('.')[0] + extension);
    return {src, dest};
  });
}

function getCourseFiles(id, pattern, extension) {
  const srcDir = path.join(CONTENT, id);
  return glob.sync(pattern, {cwd: srcDir}).map(file => {
    const dest = path.join(OUTPUT, 'content', id, file.split('.')[0] + extension);
    return {src: path.join(srcDir, file), dest};
  });
}

async function buildAssets(minify = false, watch = false) {
  const promises = [];

  // Top-level TypeScript files
  for (const {src, dest} of getAssetFiles('*.ts', '.js')) {
    if (src.endsWith('.d.ts')) continue;
    promises.push(bundleScripts(src, dest, minify, watch).catch(error(src)));
  }

  // Top-level SCSS files
  for (const {src, dest} of getAssetFiles('*.scss', '.css')) {
    promises.push(bundleStyles(src, dest, minify, watch).catch(error(src)));
  }

  // Individual Courses
  for (const id of glob.sync('*', {cwd: CONTENT})) {
    if (id === 'shared') continue;
    for (const {src, dest} of getCourseFiles(id, '*.ts', '.js')) {
      promises.push(bundleScripts(src, dest, minify, watch, 'StepFunctions').catch(error(src)));
    }
    for (const {src, dest} of getCourseFiles(id, '*.scss', '.css')) {
      promises.push(bundleStyles(src, false, dest, minify, watch).catch(error(src)));
    }
    for (const locale of CONFIG.locales) {
      promises.push(bundleMarkdown(id, locale, watch).catch(error(`course ${id} [${locale}]`)));
    }
  }

  // Miscellaneous Files
  promises.push(await createPolyfill().catch(error('polyfill.js')));

  // Generate the sitemap after all other assets have been compiled
  await Promise.all(promises);
  await createSitemap().catch(error('sitemap.xml'));
}

module.exports.buildAssets = buildAssets;
