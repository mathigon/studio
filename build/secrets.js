#!/usr/bin/env node
'use strict';

/**
 * This script can be used to update secrets in `config.yaml` during continuous
 * deployment processes. Here is an example GitHub action:
 *
 *   - name: Secrets
 *     run: mgon-secrets --mongo ${{ secrets.MONGODB }} --googleClientId ${{ secrets.GOOGLE_CLIENT_ID }} --googleClientSecret ${{ secrets.GOOGLE_CLIENT_SECRET }} --sendgrid ${{ secrets.SENDGRID_KEY }}
 */

const yargs = require('yargs-parser');
const yaml = require('js-yaml');
const {loadYAML, writeFile} = require('./utilities');
const path = require('path');

(async () => {
  const argv = yargs(process.argv.slice(2));
  const src = path.join(process.cwd(), 'config.yaml');

  const config = loadYAML(src);
  if (!config.accounts) config.accounts = {};
  if (!config.accounts.oAuth) config.accounts.oAuth = {};

  if (argv.session) config.sessionSecret = argv.session;
  if (argv.sendgrid) config.accounts.sendgrid = argv.sendgrid;
  if (argv.mongo) config.accounts.mongoServer = argv.mongo;

  for (const k of ['google', 'facebook', 'microsoft', 'ibm']) {
    const clientId = argv[`${k}ClientId`];
    const clientSecret = argv[`${k}ClientSecret`];
    if (clientId) config.accounts.oAuth[k].clientId = clientId;
    if (clientSecret) config.accounts.oAuth[k].clientSecret = clientSecret;
  }

  await writeFile(src, yaml.dump(config));
})();
