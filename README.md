# Mathigon Studio

Welcome to Mathigon Studio – an award-winning platform for creating interactive, online courses!

## Usage

This repository is not intended to be used standalone. You will need to create a parent repository
containing the content, settings, and any customisations for this course. You can see a sample
repository at [docs/example](docs/example). Then install Mathigon Studio as a dependency using
`npm install @mathigon/studio`.

For more details on how to set up a server, customise its settings, and create interactive
courses, take a look at our documentation:

* [Setup and Customisation](docs/setup.md)
* [Course Markdown Syntax](docs/markdown.md)
* [Interactive Components](docs/interactives.md)

## Directory Structure

Here is a breakdown of all the components included in this repository:

* [__build/__](build): Build tools like a custom markdown parser and JS/CSS asset bundling.
* [__docs/__](docs): Documentation and a sample implementation
* [__frontend/__](frontend): Client-side [TypeScript](https://www.typescriptlang.org/) code and
  [SCSS](https://sass-lang.com/) styles. Ever top-level `.ts` or `.scss` file in this directory will
  get bundled into a separate `.js` or `.css` file in the `public` directory.
* [__server/__](server): A NodeJS Express application for serving the course website.
* [__tests/__](tests): Markdown compiler tests and screenshot generation.
* [__translations/__](translations): Translations for all built-in strings.

## Contributing

[![Build Status](https://github.com/mathigon/studio/workflows/CI%20Tests/badge.svg)](https://github.com/mathigon/studio/actions?query=workflow%3A%22CI+Tests%22)
![Code Quality](https://github.com/mathigon/studio/workflows/Code%20Quality/badge.svg)
[![npm](https://img.shields.io/npm/v/@mathigon/studio)](https://www.npmjs.com/package/@mathigon/studio)
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

© Mathigon 2016–2022, All rights reserved
