// =============================================================================
// User Model
// (c) Mathigon
// =============================================================================


import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import * as date from 'date-fns';
import {Document, Model, model, Schema, Types} from 'mongoose';

import {age, hash} from '../utilities/utilities';
import {normalizeEmail} from '../utilities/validate';

export const USER_TYPES = ['student', 'teacher', 'parent'] as const;
export type UserType = typeof USER_TYPES[number];
const INDEX = {index: true, unique: true, sparse: true};


// -----------------------------------------------------------------------------
// Interfaces

export interface UserBase {
  email: string;
  previousEmails: string[];

  firstName: string;
  lastName: string;
  type: UserType;
  country: string;
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
  consentDaysRemaining: number;
  age: number;

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

const UserSchema = new Schema<UserDocument, UserModel>({
  email: {type: String, required: true, lowercase: true, ...INDEX, maxLength: 64},
  previousEmails: {type: [String], default: []},

  firstName: {type: String, default: '', maxLength: 32},
  lastName: {type: String, default: '', maxLength: 32},
  type: {type: String, enum: USER_TYPES, default: 'student'},
  country: {type: String, default: 'US'},
  birthday: Date,
  picture: String,
  lastOnline: Date,

  password: {type: String, maxLength: 64},
  passwordResetToken: {type: String, ...INDEX},
  passwordResetExpires: Number,
  emailVerificationToken: String,
  oAuthTokens: {type: [String], default: [], ...INDEX},
  deletionRequested: Number,
  acceptedPolicies: Boolean
}, {timestamps: true});

UserSchema.virtual('fullName').get(function(this: UserDocument) {
  return (`${this.firstName} ${this.lastName}`).trim();
});

UserSchema.virtual('shortName').get(function(this: UserDocument) {
  return this.firstName || this.lastName;
});

UserSchema.virtual('sortingName').get(function(this: UserDocument) {
  return this.lastName || this.firstName;
});

UserSchema.virtual('birthdayString').get(function(this: UserDocument) {
  return this.birthday ? date.format(new Date(this.birthday), 'dd MMMM yyyy') : '';
});

UserSchema.virtual('age').get(function(this: UserDocument) {
  return this.birthday ? age(this.birthday) : NaN;
});

UserSchema.pre<UserDocument>('save', async function(next) {
  if (this.password && this.isModified('password')) {
    const salt = bcrypt.genSaltSync(10);
    this.password = bcrypt.hashSync(this.password, salt);
  }
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

UserSchema.statics.lookup = async function(email: string) {
  const cleanEmail = normalizeEmail(email);
  return cleanEmail ? User.findOne({email}) : undefined;
};

// -----------------------------------------------------------------------------

export const User = model<UserDocument, UserModel>('User', UserSchema);
