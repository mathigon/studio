// =============================================================================
// User Input Validation
// (c) Mathigon
// =============================================================================


import {isBetween} from '@mathigon/fermat';
import validator from 'validator';
import {ONE_YEAR} from './utilities';


export function sanitizeString(str: string, maxLength = 40) {
  return validator.escape(validator.stripLow(str || '')).trim()
      .replace(/\s+/, ' ').slice(0, maxLength);
}

export function checkBirthday(birthdayString?: string|null) {
  const date = birthdayString ? validator.toDate(birthdayString) : undefined;
  if (!date) return;
  const now = Date.now();
  if (!isBetween(+date, now - 120 * ONE_YEAR, now - ONE_YEAR)) return;
  return date;
}

export function normalizeEmail(str?: string|null) {
  if (!str || !validator.isEmail(str)) return;
  return validator.normalizeEmail(str) || undefined;
}
