# Mathigon Studio

Welcome to Mathigon Studio – an award-winning platform for creating interactive, online courses!

## Usage

This repository is not intended to be used standalone. You will need to create a parent repository
containing the content, settings, and any customisations for this course. You can see a sample
repository at [docs/sample](docs/sample). Then install Mathigon Studio as a dependency using
`npm install @mathigon/coursekit`.

The scripts and server behave slightly different depending on whether they run in development or
production mode:

| Development                                       | Production                                   |
| ----------------------------------------------- | --------------------------------------- |
| Start a local development server: `npm run dev` | Build the website: `npm run build`      |
| The server will automatically watch for changes to files and recompile. | Deploy to your server |
|                                                 | Start a production server: `npm start`  |

## Directory Structure

Here is a breakdown of all the components included in this repository:

* [__build/__](build): Build tools like a custom markdown parser and JS/CSS asset bundling.
* [__frontend/__](frontend): Client-side [TypeScript](https://www.typescriptlang.org/) code and [SCSS](https://sass-lang.com/) styles. Ever top-level `.ts` or `.scss` file in this directory will get bundled into a separate `.js` or `.css` file in the `.output` directory.
* [__docs/__](docs): Documentation and a sample implementation
* [__server/__](server): A NodeJS Express application for serving the course website.

## Contributing

[![Build Status](https://github.com/mathigon/studio/workflows/CI%20Tests/badge.svg)](https://github.com/mathigon/studio/actions?query=workflow%3A%22CI+Tests%22)
![Code Quality](https://github.com/mathigon/studio/workflows/Code%20Quality/badge.svg)
![GitHub repo size](https://img.shields.io/github/repo-size/mathigon/studio)
![GitHub issues](https://img.shields.io/github/issues-raw/mathigon/studio)

We welcome any contributions to Mathigon Studio: from bug fixes to writing more documentations,
adding new translations, or developing entirely new features. If you find any bugs or errors,
please file an [issue](https://github.com/mathigon/studio/issues).

Before submitting a pull request, you will need to sign the [Mathigon Individual Contributor License
Agreement](https://gist.github.com/plegner/5ad5b7be2948a4ad073c50b15ac01d39).

If you want to work for Mathigon, visit our [careers page](https://mathigon.org/careers), and
[contact us](mailto:dev@mathigon.org) if you have any questions.

---

[![Twitter Follow](https://img.shields.io/twitter/follow/MathigonOrg?style=social)](https://twitter.com/intent/follow?screen_name=MathigonOrg)

© Mathigon 2016–2021, All rights reserved
