// =============================================================================
// Email Helper Functions
// (c) Mathigon
// =============================================================================


import path from 'path';
import {compileFile} from 'pug';
import Sendgrid from '@sendgrid/mail';
import {UserDocument} from '../models/user';
import {CONFIG} from './utilities';


if (CONFIG.accounts.sendgridKey) Sendgrid.setApiKey(CONFIG.accounts.sendgridKey);

function loadEmailTemplate(name: string) {
  const prefix = path.join(__dirname, '../templates/emails/');
  const html = compileFile(`${prefix}/${name}.pug`);
  const text = compileFile(`${prefix}/${name}-simple.pug`);
  return [html, text];
}

type MailData = Omit<Sendgrid.MailDataRequired, 'from'|'to'> & {from?: string, to?: string, user?: UserDocument};

export async function sendEmail(options: MailData) {
  if (!options.from) options.from = `${CONFIG.siteName} <no_reply@${CONFIG.domain}>`;
  if (options.user && !options.to) {
    const email = options.user.email || options.user.guardianEmail;
    options.to = `${options.user.fullName} <${email}>`;
  }

  try {
    return await Sendgrid.send(options as Sendgrid.MailDataRequired);
  } catch (error) {
    console.error(`Failed to send email to`, options.to, error);
  }
}

// -----------------------------------------------------------------------------

const WELCOME = loadEmailTemplate('welcome');
export function sendWelcomeEmail(user: UserDocument) {
  return sendEmail({
    subject: `Welcome to ${CONFIG.siteName}!`,
    html: WELCOME[0]({user, config: CONFIG}),
    text: WELCOME[1]({user, config: CONFIG}),
    user
  });
}

const RESET = loadEmailTemplate('reset');
export function sendPasswordResetEmail(user: UserDocument, token: string) {
  return sendEmail({
    subject: `${CONFIG.siteName} Password Reset`,
    html: RESET[0]({user, token, config: CONFIG}),
    text: RESET[1]({user, token, config: CONFIG}),
    user
  });
}

const PASSWORD = loadEmailTemplate('password');
export function sendPasswordChangedEmail(user: UserDocument) {
  return sendEmail({
    subject: `${CONFIG.siteName} Password Change Notification`,
    html: PASSWORD[0]({user, config: CONFIG}),
    text: PASSWORD[1]({user, config: CONFIG}),
    user
  });
}

const CHANGE_EMAIL = loadEmailTemplate('change-email');
export function sendChangeEmailConfirmation(user: UserDocument) {
  return sendEmail({
    subject: `Confirm your new email address for ${CONFIG.siteName}`,
    html: CHANGE_EMAIL[0]({user, config: CONFIG}),
    text: CHANGE_EMAIL[1]({user, config: CONFIG}),
    user
  });
}

const CONSENT = loadEmailTemplate('consent');
export function sendGuardianConsentEmail(user: UserDocument) {
  return sendEmail({
    subject: `Approve your child’s ${CONFIG.siteName} account`,
    text: CONSENT[0]({user, config: CONFIG}),
    html: CONSENT[1]({user, config: CONFIG}),
    to: user.guardianEmail
  });
}

const JOIN_CLASS = loadEmailTemplate('join-class');
export function sendClassCodeAddedEmail(student: UserDocument, teacher: UserDocument) {
  return sendEmail({
    subject: `A new student joined your ${CONFIG.siteName} class`,
    text: JOIN_CLASS[0]({student, user: teacher, config: CONFIG}),
    html: JOIN_CLASS[1]({student, user: teacher, config: CONFIG}),
    user: teacher!
  });
}

const CLASSROOM_WELCOME = loadEmailTemplate('classroom-welcome');
export function sendStudentAddedToClassEmail(user: UserDocument, teacher: UserDocument) {
  return sendEmail({
    subject: `Welcome to ${CONFIG.siteName}`,
    text: CLASSROOM_WELCOME[0]({user, teacher, config: CONFIG}),
    html: CLASSROOM_WELCOME[1]({user, teacher, config: CONFIG}),
    user
  });
}
