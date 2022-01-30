// =============================================================================
// User Model
// (c) Mathigon
// =============================================================================


import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import * as date from 'date-fns';
import {Document, Model, model, Schema, Types} from 'mongoose';

import {age, CONFIG, hash, ONE_DAY} from '../utilities/utilities';
import {normalizeEmail, normalizeUsername} from '../utilities/validate';

export const USER_TYPES = ['student', 'teacher', 'parent'] as const;
export type UserType = typeof USER_TYPES[number];
const INDEX = {index: true, unique: true, sparse: true};


// -----------------------------------------------------------------------------
// Interfaces

export interface UserBase {
  username?: string;
  email?: string;
  previousEmails: string[];

  firstName: string;
  lastName: string;
  type: UserType;
  country: string;
  school?: string;
  birthday?: Date;
  picture?: string;
  lastOnline?: Date;

  password?: string;
  passwordResetToken?: string;
  passwordResetExpires?: number;
  emailVerificationToken?: string;
  oAuthTokens: string[];
  deletionRequested?: number;
  acceptedPolicies?: boolean;

  isRestricted?: boolean;
  guardianEmail?: string;
  guardianConsentToken?: string;
}

export interface UserDocument extends UserBase, Document {
  // Mongoose Properties
  createdAt: Date;
  updatedAt: Date;
  _id: Types.ObjectId;

  // Virtual Properties
  id: string;
  fullName: string;
  shortName: string;
  sortingName: string;
  birthdayString: string;
  consentDaysRemaining: string;
  age: number;
  canUpgrade: boolean;

  // Methods
  checkPassword: (candidate: string) => boolean;
  avatar: (size?: number) => string;
  getJSON: (...keys: string[]) => Record<string, unknown>;
}

interface UserModel extends Model<UserDocument> {
  lookup: (emailOrUsername: string) => Promise<UserDocument|undefined>;
}


// -----------------------------------------------------------------------------
// Schema

function unrestricted(this: UserDocument) {
  return !this.isRestricted;
}

function restricted(this: UserDocument) {
  return !!this.isRestricted;
}

const UserSchema = new Schema<UserDocument, UserModel>({
  username: {type: String, required: restricted, lowercase: true, ...INDEX, maxLength: 32},
  email: {type: String, required: unrestricted, lowercase: true, ...INDEX, maxLength: 64},
  previousEmails: {type: [String], default: []},

  firstName: {type: String, default: '', maxLength: 32},
  lastName: {type: String, default: '', maxLength: 32},
  type: {type: String, enum: USER_TYPES, default: 'student'},
  country: {type: String, default: 'US'},
  school: {type: String, maxLength: 32},
  birthday: Date,
  picture: String,
  lastOnline: Date,

  password: {type: String, maxLength: 64},
  passwordResetToken: {type: String, ...INDEX},
  passwordResetExpires: Number,
  emailVerificationToken: String,
  oAuthTokens: {type: [String], default: [], index: true},
  deletionRequested: Number,
  acceptedPolicies: Boolean,

  isRestricted: {type: Boolean, default: false},
  guardianEmail: {type: String, lowercase: true, required: restricted},
  guardianConsentToken: {type: String, ...INDEX}
}, {timestamps: true});

UserSchema.virtual('fullName').get(function(this: UserDocument) {
  return (`${this.firstName || ''} ${this.lastName || ''}`).trim() || this.username;
});

UserSchema.virtual('shortName').get(function(this: UserDocument) {
  return this.firstName || this.lastName || this.username;
});

UserSchema.virtual('sortingName').get(function(this: UserDocument) {
  return this.lastName || this.firstName || this.username || '';
});

UserSchema.virtual('birthdayString').get(function(this: UserDocument) {
  return this.birthday ? date.format(new Date(this.birthday), 'dd MMMM yyyy') : '';
});

UserSchema.virtual('consentDaysRemaining').get(function(this: UserDocument) {
  if (!this.isRestricted || !this.guardianConsentToken) return undefined;
  const accountAge = Math.floor((Date.now() - (+this.createdAt)) / ONE_DAY);
  const daysLeft = Math.max(1, 7 - accountAge);
  return `${daysLeft} day${daysLeft > 1 ? 's' : ''}`;
});

UserSchema.virtual('age').get(function(this: UserDocument) {
  return this.birthday ? age(this.birthday) : NaN;
});

UserSchema.virtual('canUpgrade').get(function(this: UserDocument) {
  if (this.isRestricted) return this.age >= 13;
  return this.type !== 'student' || !this.birthday || this.age >= 16;
});

UserSchema.pre<UserDocument>('save', async function(next) {
  if (this.password && this.isModified('password')) {
    const salt = bcrypt.genSaltSync(10);
    this.password = bcrypt.hashSync(this.password, salt);
  }

  if (this.isRestricted && !CONFIG.accounts.restricted) throw new Error('Restricted accounts are not supported.');
  if (this.type === 'teacher' && !CONFIG.accounts.teachers) throw new Error('Teacher accounts are not supported.');
  if (this.type === 'parent' && !CONFIG.accounts.parents) throw new Error('Parent accounts are not supported.');

  next();
});

UserSchema.methods.checkPassword = function(candidate: string) {
  candidate = candidate.trim();
  return this.password && candidate && bcrypt.compareSync(candidate, this.password);
};

UserSchema.methods.avatar = function(size = 200) {
  if (this.picture) return this.picture.replace('sz=50', `sz=${size}`);

  const n = hash(this.fullName, 7);
  const fallback = `https://mathigon.org/images/avatars/avatar-${n}.png`;
  if (!this.email) return fallback;

  const email = this.email ? crypto.createHash('md5').update(this.email).digest('hex') : '';
  return `https://gravatar.com/avatar/${email}?s=${size}&d=${encodeURIComponent(fallback)}`;
};

UserSchema.methods.getJSON = function(this: any, ...keys: string[]) {
  const data: Record<string, unknown> = {};
  for (const k of keys) data[k] = this[k];
  return data;
};

UserSchema.statics.lookup = async function(emailOrUsername: string) {
  const cleanEmail = normalizeEmail(emailOrUsername);
  if (cleanEmail) return User.findOne({email: cleanEmail});
  const cleanUsername = normalizeUsername(emailOrUsername);
  return cleanUsername ? User.findOne({username: cleanUsername}) : undefined;
};

// -----------------------------------------------------------------------------

export const User = model<UserDocument, UserModel>('User', UserSchema);
