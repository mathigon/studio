# Setup and Customisation

## Introduction

Start by creating a new repository and then install Mathigon Studio as a dependency using
`npm install @mathigon/studio`.

A usage example that shows many of the available customisation options is available in the
[example/](example) directory. When copying the contents of this directory for use elsewhere,
remember to replace `"@mathigon/studio": "file:../.."` in `package.json` with the latest version
of the `@mathigon/studio` module on NPM.

## The NodeJS Server

First, you need to create a TypeScript entrypoint file for the NodeJS server, for example
`server/app.ts`. This file will allow you to set up and configure the server and add any plugins,
extensions or customisations required:

```ts
import {MathigonStudioApp} from '@mathigon/studio/server/app';

const studio = new MathigonStudioApp()
    .setup({sessionSecret: 'archimedes'})  // Setup Express App
    .get('/', (req, res) => res.render('home.pug'))  // Custom routes
    .get('/courses', (req, res) => res.render('courses.pug'))
    .course({})  // Bind and configure course endpoints
    .errors()  // The error routes have to be created last
    .listen(8080);  // Dev port can be overridden by process.env.PORT
```

Internally, `MathigonStudioApp()` creates an [Express server](https://expressjs.com/). You can
extend this server directly by accessing `studio.app()`. The functions `studio.get()` and
`studio.post()` are wrappers around the native Express handlers that catch any rejected Promises
or async functions and show an error page.

Notice how the example above creates two custom endpoints, `/` and `/courses`. Their PUG templates
are located in the `server/templates` directory.

## Customisation Options

The `config.yaml` file at the root of your repository can be used to customise and configure the
behaviour of your server. Take a look at [server/interfaces.ts](../server/interfaces.ts#L92) for a
detailed schema of which options are supported.

TODO: Write more docs for each option.

## Static Assets

In the `frontend/` directory, you can add any custom styles, scripts or assets that you want to
expose to users. Any files in `frontend/assets/` will directly be publicly available.  Any top
level `.ts` and `.scss` will be automatically compiled into separate `.js` and and `.css` files
with the same name.

You can use the `frontend/` directory to overwrite any files in the corresponding
`node_modules/@mathigon/studio/frontend/` directory – for example, to add your own `favicon.ico`
file or to overwrite the `course.ts` script.

The `frontend/assets/icons/` subdirectory can contain custom `.svg` icons that will get bundled
into a single `/icons.svg` file with symbols and can be used using the `x-icon(name="...")`
custom webcomponent. The `name=` attribute corresponds to the original filename of the icon.

_Note: We are working on additional customisation options, including providing custom partials for
the PUG templates._

## Add Content

Now you can start writing your first courses. Every course is located in a subdirectory of
`content/`, but you can customise this path using the `contentDir` property in `config.yaml`.
Once compiled, the course at `content/courseid/` will be available at the URL `/course/courseid`.

Every course must contain a `content.md` markdown file with the text, subsections and  metadata.
[Learn more](markdown.md) about the syntax for these files. You should also include a `styles.scss`
file and a `functions.ts` file for custom styles or interactivity. You can also add images for
courses, as well as `glossary.yaml`, `bios.yaml` and `hints.yaml` files with additional data.

The `shared/` directory can contain corresponding `.yaml` files that are shared across all courses,
as well as other shared TypeScript components or styles. You cannot have a course with the ID
`shared/`.

## Scripts

To start a server, you can simply run `ts-node server/app.ts`, with your server entry file. You
can also use tools like [Nodemon](https://nodemon.io/) to automatically restart your server when
files change.

However, first you need to build the courses, static assets, and other dependencies. For this,
Mathigon Studio exposes the `mgon-build` CLI that can be called using `npm run` or `npx`. Here are
some of the supported options:

* `--assets` builds all courses, SCSS styles, TS scripts and SVG icons. You can optionally add
  `--minify` to also minify all assets and `--watch` to continue watching all files for changes.
* `--search` generates the search index for all courses. You need to set `search.enabled` in
  `config.yaml`, where you can further customise the search behaviour.
* `--thumbnails` generates preview images for all courses. These are shown, for example, on social
  media sites like Twitter when sharing a link.
* `--translate` generate translations for all UI strings referenced using `__()` in templates.

The [package.json](example/package.json) file in the example directory show how best to use and
combine all these scripts:

| Production                                | Development                            |
| ----------------------------------------- | -------------------------------------- |
| 1. Build the website: `npm run build`     | 1. Start a local server: `npm run dev` |
| 2. Deploy to your server host (e.g. AWS)  | 2. The server will automatically watch for changes to files and recompile. |
| 3. Start a production server: `npm start` |                                        |

Finally, you can run `mgon-screenshots --output screenshots` to generate screenshots for all pages
in your app and write them to a new directory. This requires a server running in the background,
and can be useful for screen-diffing any changes.

## Translations

TODO: Write docs for translations
