#!/usr/bin/env ts-node --script-mode

// A super really node server that can be used in development using mgon-serve.

import * as fs from 'fs';
import {MathigonStudioApp} from './app';
import {CONTENT_DIR} from './utilities';

const courses = fs.readdirSync(CONTENT_DIR)
    .filter(id => id !== 'shared' && !id.includes('.') && !id.startsWith('_'));

new MathigonStudioApp()
    .setup({sessionSecret: 'hypatia'})
    .get('/', (req, res) => res.render('home.pug', {courses}))
    .course({})
    .errors()
    .listen(5000);
