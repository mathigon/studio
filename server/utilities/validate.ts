// =============================================================================
// User Input Validation
// (c) Mathigon
// =============================================================================


import {isBetween} from '@mathigon/fermat';
import validator from 'validator';
import {USER_TYPES} from '../models/user';
import {ONE_YEAR} from './utilities';


export function sanitizeString(str: string, maxLength = 40) {
  return validator.escape(validator.stripLow(str || '')).trim()
      .replace(/\s+/, ' ').slice(0, maxLength);
}

export function sanitizeType(str?: string|null): 'student'|'teacher'|'parent' {
  if (!str) return 'student';
  return USER_TYPES.includes(str as any) ? (str as 'student'|'teacher'|'parent') : 'student';
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

export function normalizeUsername(str?: string|null) {
  if (!str) return;
  str = str.toLowerCase().trim();
  return /^[a-z0-9_]{4,}$/.test(str) ? str : undefined;
}

export function isClassCode(str?: string|null) {
  return !!str && /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(str);
}
