// =============================================================================
// Mathigon Studio Demo App
// (c) Mathigon
// =============================================================================


import {MathigonStudioApp} from '@mathigon/studio/server/app';

new MathigonStudioApp()
    .get('/_ah/health', (req, res) => res.status(200).send('ok'))  // AppEngine Health Checks
    .secure()
    .setup({sessionSecret: 'hey!'})
    .get('/', (req, res) => res.render('home.pug', {}))
    .get('/courses', (req, res) => res.render('courses.pug', {}))
    .get('/custom', (req, res) => res.render('custom.pug', {}))
    .course({})
    .redirects({'/help': '/'})
    .errors()
    .listen(8080);
