// =============================================================================
// Mathigon Studio Express App
// (c) Mathigon
// =============================================================================


import * as express from 'express';
import * as cookieParser from 'cookie-parser';
import * as compression from 'compression';
import * as bodyParser from 'body-parser';
import * as lusca from 'lusca';
import * as session from 'express-session';
import * as path from 'path';

import {AVAILABLE_LOCALES, getCountry, getLocale, isInEU, Locale, LOCALES, translate} from './i18n';
import {search, SEARCH_DOCS} from './search';
import {CourseRequestOptions, ServerOptions} from './interfaces';
import {cacheBust, CONFIG, CONTENT_DIR, ENV, findNextSection, getCourse, href, include, IS_PROD, lighten, ONE_YEAR, OUT_DIR, PROJECT_DIR, promisify, removeCacheBust} from './utilities';


declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      country: string;
      locale: Locale;
      __: (str: string) => string;
      // user?: User;
      // tmpUser: string;
      // session?: {auth?: {user?: string}};
    }
  }
}

const STATUS_CODES: Record<string, string> = {
  401: 'You don’t have access to this page,',
  404: 'This page doesn’t exist.',
  default: 'Something went wrong.'
};


// -----------------------------------------------------------------------------
// Express App Setup

export class MathigonStudioApp {
  private app: express.Application;

  constructor() {
    const app = this.app = express();
    app.set('env', ENV);
    app.set('trust_proxy', true);
    app.set('views', [__dirname + '/templates', PROJECT_DIR + '/server/templates']);
    app.set('view engine', 'pug');
    if (ENV === 'development') app.set('json spaces', 2);
    app.disable('x-powered-by');
  }


  use(fn: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<void>) {
    this.app.use(fn);
    return this;
  }

  get(url: string, handler: (req: express.Request, res: express.Response, next: express.NextFunction) => void) {
    this.app.get(url, promisify(handler));
    return this;
  }

  post(url: string, handler: (req: express.Request, res: express.Response, next: express.NextFunction) => void) {
    this.app.post(url, promisify(handler));
    return this;
  }

  listen(port?: number) {
    port = (+process.env.PORT!) || port || 8080;
    this.app.set('port', port);
    this.app.listen(port, () => console.log(`Running on port ${port} in ${ENV} mode.`));
  }


  // ---------------------------------------------------------------------------
  // Server Configuration

  /**
   * Sets up the express body and cookie parser, as well as security headers.
   * This should happen *after* binding static assets repositories.
   * @param options {ServerOptions}
   * @return {MathigonStudioApp}
   */
  setup(options: ServerOptions) {
    this.app.use(cookieParser(options.sessionSecret));

    const limit = options?.maxBodySize || '400kb';
    this.app.use(bodyParser.json({limit}));
    this.app.use(bodyParser.urlencoded({extended: false, limit}));

    const SESSION_COOKIE = {
      domain: IS_PROD ? CONFIG.domain : undefined,
      maxAge: 1000 * 60 * 60 * 24 * 60  // Two months, in ms
    };

    this.app.use(session({
      name: 'session',
      secret: options.sessionSecret,
      cookie: SESSION_COOKIE,
      resave: false,  // Don't save session if unmodified
      saveUninitialized: false  // Don't create session until something stored
      // store: MongoStore.create({clientPromise: mongoClient, touchAfter: 12 * 3600})
    }));

    this.app.use(lusca({
      csrf: {blocklist: options?.csrfBlocklist},  // Cross Site Request Forgery
      hsts: {maxAge: 31536000},                   // Strict-Transport-Security
      nosniff: true,                              // X-Content-Type-Options
      xssProtection: true                        // X-XSS-Protection
    }));

    this.app.use((req, res, next) => {
      req.url = removeCacheBust(req.url);
      req.country = getCountry(req);
      req.locale = getLocale(req);
      req.__ = (str: string, ...args: string[]) => translate(req.locale.id, str, args);

      // These keys are required by the error page, so they need to be added
      // before any static files routing (which might throw an error).
      const showCookieConsent = !req.cookies.cookie_consent && isInEU(req.country);
      Object.assign(res.locals, {
        country: req.country, locale: req.locale, __: req.__, env: ENV, req,
        availableLocales: AVAILABLE_LOCALES, config: CONFIG, include,
        href: href.bind(undefined, req), basedir: __dirname + '/templates',
        search: {docs: SEARCH_DOCS}, showCookieConsent, getCourse, cacheBust
      });

      next();
    });

    // Static asset directories
    this.app.use(compression());
    this.app.use(express.static(PROJECT_DIR + '/frontend/assets', {maxAge: ONE_YEAR}));
    this.app.use(express.static(path.join(__dirname, '../frontend/assets'), {maxAge: ONE_YEAR}));
    this.app.use(express.static(OUT_DIR, {maxAge: ONE_YEAR}));
    this.app.use('/content', express.static(CONTENT_DIR, {maxAge: ONE_YEAR}));

    // Search Endpoint
    if (CONFIG.search.enabled) {
      this.get('/api/search', (req, res) => {
        res.locals.search.results = search((req.query.q || '').toString());
        res.render('search');
      });
    }

    return this;
  }


  // ---------------------------------------------------------------------------
  // Helper Functions

  /**
   * Create redirect handlers for a map of URLs. It is possible to use and
   * reference URL parameters, e.g. {"/:name": "/course/$name"}.
   * @param data {Record<string, string>}
   * @return {MathigonStudioApp}
   */
  redirects(data: Record<string, string>) {
    for (const from of Object.keys(data)) {
      this.app.get(from, (req, res) => {
        let url = data[from];
        for (const [key, value] of Object.entries(req.params)) {
          url = url.replace('$' + key, value);
        }
        res.redirect(url);
      });
    }

    return this;
  }

  /**
   * Bind Express error handlers. This should be called after all other
   * request handlers have been set up.
   * @return {MathigonStudioApp}
   */
  errors() {
    const render = (req: express.Request, res: express.Response, error?: Error) => {
      res.render('error', {
        code: res.statusCode, error,
        message: STATUS_CODES[res.statusCode] || STATUS_CODES.default,
        url: req.url
      });
    };

    this.app.use((req, res) => {
      res.status(404);
      if (req.accepts('html')) {
        render(req, res);
      } else if (req.accepts('json')) {
        res.send({error: 'Not found'});
      } else {
        res.type('txt').send('Not found');
      }
    });

    this.app.use((error: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
      if (error.name === 'URIError') {
        // This handles requests with invalid query parameters that can't be parsed by Express.
        res.status(400);
      } else if (res.statusCode === 200) {
        res.status(500);
      }
      render(req, res, error);
    });

    return this;
  }


  // ---------------------------------------------------------------------------
  // Setup Course Routes

  /**
   * Bind request handlers for all course pages, including getters and POST
   * requests for saving progress, sending feedback and asking tutor queries.
   * @param options {CourseRequestOptions}
   */
  course(options: CourseRequestOptions = {}) {
    this.get('/course/:course', (req, res, next) => {
      const course = getCourse(req.params.course, req.locale.id);
      return course ? res.redirect(course.sections[0].url) : next();
    });

    this.get('/course/:course/:section', async (req, res, next) =>{
      const course = getCourse(req.params.course, req.locale.id);
      const section = course?.sections.find(s => s.id === req.params.section);
      if (!course || !section) return next();

      const response = await options.getProgressData?.(req, course, section);
      const progressJSON = JSON.stringify(response?.data || {});
      const nextUp = findNextSection(course, section);

      res.locals.availableLocales = course.availableLocales.map(l => LOCALES[l]);
      res.render('course', {course, section, lighten, progressJSON, nextUp});
    });

    this.post('/course/:course/:section', async (req, res, next) => {
      const course = getCourse(req.params.course, req.locale.id);
      const section = course?.sections.find(s => s.id === req.params.section);
      if (!course || !section) return next();

      const response = await options.setProgressData?.(req, course, section);
      res.status(response?.status || 200).end();
    });

    this.post('/course/:course/reset', async (req, res, next) => {
      const course = getCourse(req.params.course, req.locale.id);
      if (!course) return next();

      const response = await options.clearProgressData?.(req, course);
      res.status(response?.status || 200).end();
    });

    this.post('/course/:course/feedback', async (req, res, next) => {
      if (!CONFIG.courses.feedback) return next();
      const course = getCourse(req.params.course, req.locale.id);
      if (!course) return next();

      const response = await options.sendFeedback?.(req, course);
      res.status(response?.status || 200).end();
    });

    this.post('/course/:course/ask', async (req, res, next) => {
      const course = getCourse(req.params.course, req.locale.id);
      if (!course) return next();

      const response = await options.askTutor?.(req, course);
      res.status(response?.status || 200).json(response?.data || {}).end();
    });

    return this;
  }
}
