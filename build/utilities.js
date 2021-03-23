// =============================================================================
// Mathigon Studio Build Utilities
// (c) Mathigon
// =============================================================================


const fs = require('fs');
const path = require( 'path');
const crypto = require('crypto');
const glob = require( 'glob');
const yaml = require('js-yaml');
const chokidar = require('chokidar');
const {deepExtend} = require('@mathigon/core');


// -----------------------------------------------------------------------------
// Configuration

// Configuration
const CONFIG = loadYAML(path.join(__dirname, '../config.yaml'));
const PROJECT_CONFIG = loadYAML(path.join(process.cwd(), 'config.yaml'));
deepExtend(CONFIG, PROJECT_CONFIG, (a, b) => b);

// Directories
const STUDIO_ASSETS = path.join(__dirname, '../frontend');
const PROJECT_ASSETS = path.join(process.cwd(), 'frontend');
const CONTENT = path.join(process.cwd(), CONFIG.contentDir);
const OUTPUT = path.join(process.cwd(), 'public');


// -----------------------------------------------------------------------------
// File System Utilities

function readFile(file, fallback = '') {
  // TODO Make this function asynchronous
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : fallback;
}

async function writeFile(file, content) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) await fs.promises.mkdir(dir, {recursive: true});
  return fs.promises.writeFile(file, content);
}

async function copyFile(src, dest) {
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) await fs.mkdirSync(dir, {recursive: true});
  return fs.promises.copyFile(src, dest);
}

function loadYAML(file) {
  // TODO Support both .yaml and .yml extensions
  return yaml.load(readFile(file, '{}')) || {};
}

function watchFiles(dependencies, callback) {
  const watcher = chokidar.watch(dependencies);
  watcher.on('change', async () => {
    console.log('\x1b[33m  Updating...\x1b[0m');
    await callback();
  });
}

function findFiles(pattern, srcDir, destDir, flat = false) {
  return glob.sync(pattern, {cwd: srcDir}).map(file => {
    const outFile = flat ? path.basename(file) : file;
    return {src: path.join(srcDir, file), dest: path.join(destDir, outFile)};
  });
}


// -----------------------------------------------------------------------------
// Console Utilities

const prefixLength = process.cwd().split('').findIndex((k, i) => __dirname[i] !== k);
const commonPath = __dirname.slice(0, prefixLength);

function success(file, duration) {
  const shortFile = file.replace(commonPath, '');
  console.log(`\x1b[32m  ✔ Built ${shortFile} in ${duration}ms\x1b[0m`);
}

function warning(message) {
  console.log(`\x1b[33m  ! [WARNING] ${message}\x1b[0m`);
}

function error(file) {
  const shortFile = file.replace(commonPath, '');
  return (error) => console.log(`\x1b[31m  ✖ [ERROR] Building ${shortFile}:\x1b[0m\n`, error);
}

function textHash(text) {
  return crypto.createHash('md5').update(text).digest('hex');
}

// -----------------------------------------------------------------------------

module.exports.CONFIG = CONFIG;
module.exports.STUDIO_ASSETS = STUDIO_ASSETS;
module.exports.PROJECT_ASSETS = PROJECT_ASSETS;
module.exports.CONTENT = CONTENT;
module.exports.OUTPUT = OUTPUT;

module.exports.readFile = readFile;
module.exports.writeFile = writeFile;
module.exports.copyFile = copyFile;
module.exports.findFiles = findFiles;
module.exports.loadYAML = loadYAML;
module.exports.watchFiles = watchFiles;

module.exports.success = success;
module.exports.warning = warning;
module.exports.error = error;

module.exports.textHash = textHash;
