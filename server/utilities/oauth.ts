// =============================================================================
// OAuth API
// (c) Mathigon
// =============================================================================


import express from 'express';
import path from 'path';
import {URLSearchParams} from 'url';
import fetch from 'node-fetch';
import {Progress} from '../models/progress';

import {sendWelcomeEmail} from './emails';
import {CONFIG, loadYAML, q} from './utilities';
import {normalizeEmail} from './validate';
import {User} from '../models/user';


// -----------------------------------------------------------------------------
// Interfaces

type Provider = 'google'|'facebook'|'microsoft'|'ibm';

interface OAuthProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  picture?: string;
}

interface OAuthConfig {
  title: string;
  authorizeUrl: string;
  accessUrl: string;
  clientId: string;
  clientSecret: string;
  profileUrl: string;
  profileMethod?: 'GET'|'POST';
  scope?: string;
  profile: OAuthProfile;
}

// Copy client secrets from secrets.yaml to oauth.yaml data file.
const CONFIGS = loadYAML(path.join(__dirname, '../data/oauth')) as Record<Provider, OAuthConfig>;
if (CONFIG.accounts.oAuth) Object.assign(CONFIGS, CONFIG.accounts.oAuth);


// -----------------------------------------------------------------------------
// User Creation and Lookup

function normalizeProfile(data: any, provider: Provider) {
  if (!data) return;
  const profile: OAuthProfile = {id: '', email: ''};

  const config = CONFIGS[provider];
  for (const key of ['id', 'email', 'firstName', 'lastName', 'picture'] as const) {
    const template = config.profile[key] || '';
    profile[key] = template.replace(/\${([^}]+)}/g, (_, key: string) => key.split('||').map(k => data[k.trim()]).find(t => t) || '');
  }

  profile.email = normalizeEmail(profile.email) || '';
  return (profile.email && profile.id) ? profile : undefined;
}

async function findOrCreateUser(req: express.Request, provider: Provider, profile: OAuthProfile) {
  const token = `${provider}:${profile.id}`;

  const p1 = User.findOne({oAuthTokens: token});
  const p2 = User.lookup(profile.email);
  const [sameProviderUser, sameEmailUser] = await Promise.all([p1, p2]);

  if (sameProviderUser) {
    // If the user has two accounts and they switched their provider email
    // address from one to the other, we have to disable one of their accounts
    // to ensure the `email` key is unique.
    if (sameEmailUser && sameEmailUser.id !== sameProviderUser.id) {
      sameEmailUser.email += '__duplicate';
      sameEmailUser.deletionRequested = Date.now();
      await sameEmailUser.save();
    }
    sameProviderUser.email = profile.email;
    await sameProviderUser.save();
    return sameProviderUser;
  }

  if (sameEmailUser && !sameEmailUser.emailVerificationToken) {
    // Link this OAuth provider to an existing account.
    sameEmailUser.oAuthTokens.push(token);
    // TODO req.flash('info', req.__(MESSAGES['socialLoginLink'], toTitleCase(provider)));
    await sameEmailUser.save();
    return sameEmailUser;
  }

  if (sameEmailUser) {
    // If there already is an account with the same email address, but the
    // email address has not been verified, we have to remove it.
    sameEmailUser.email += '__removed';
    sameEmailUser.deletionRequested = Date.now();
    await sameEmailUser.save();
  }

  const user = new User({
    email: profile.email,
    firstName: profile.firstName,
    lastName: profile.lastName,
    picture: profile.picture,
    type: 'student',
    country: req.country,
    oAuthTokens: [token]
  });

  await user.save();

  // Copy course data from temporary user to new user account.
  if (req.tmpUser) await Progress.updateMany({userId: req.tmpUser}, {userId: user.id}).exec();

  sendWelcomeEmail(user);  // async
  return user;
}


// -----------------------------------------------------------------------------
// OAuth Flow

const host = (req: express.Request) => `${req.protocol}://${req.hostname}`;

function login(req: express.Request, provider: Provider) {
  const config = CONFIGS[provider];
  const query = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: `${host(req)}/auth/${provider}/callback`,
    scope: config.scope
  });
  return `${config.authorizeUrl}?${query.toString()}`;
}

async function getToken(req: express.Request, provider: Provider) {
  const config = CONFIGS[provider];

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: q(req, 'code'),
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: `${host(req)}/auth/${provider}/callback`
  });

  const response = await fetch(config.accessUrl, {method: 'POST', body});
  if (!response.ok) return;
  return (await response.json() as any)?.access_token;
}

async function getProfile(req: express.Request, provider: Provider, accessToken?: string) {
  const config = CONFIGS[provider];
  if (!accessToken) accessToken = await getToken(req, provider);

  const headers = {Authorization: `Bearer ${accessToken}`};
  const response = await fetch(config.profileUrl, {method: config.profileMethod, headers});
  if (!response.ok) return;

  return normalizeProfile(await response.json(), provider);
}


// -----------------------------------------------------------------------------
// Server Endpoints

export async function oAuthLogin(req: express.Request) {
  if (!CONFIG.accounts.oAuth?.[req.params.provider]) return;
  const provider = req.params.provider as Provider;

  const redirect = login(req, provider);
  return redirect ? {redirect} : {error: 'socialLoginError', params: [CONFIGS[provider].title]};
}

export async function oAuthCallback(req: express.Request) {
  if (!CONFIG.accounts.oAuth?.[req.params.provider]) return;
  const provider = req.params.provider as Provider;

  const profile = await getProfile(req, provider);
  const user = profile ? await findOrCreateUser(req, provider, profile) : undefined;
  return user ? {user} : {error: 'socialLoginError', params: [CONFIGS[provider].title]};
}
