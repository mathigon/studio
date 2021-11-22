#!/usr/bin/env -S ts-node --script-mode

// A simple node server that can be used in development using mgon-serve.

import {MathigonStudioApp} from './app';
import {COURSES} from './utilities/utilities';

new MathigonStudioApp()
    .secure()
    .setup({sessionSecret: 'hypatia'})
    .get('/', (req, res) => res.render('home.pug', {courses: COURSES}))
    .course({})
    .errors()
    .listen(5000);
