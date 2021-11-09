// =============================================================================
// Analytics Model
// (c) Mathigon
// =============================================================================


import * as date from 'date-fns';
import {Document, Model, model, Schema} from 'mongoose';
import {total} from '@mathigon/core';
import {UserDocument} from './user';

const TIMEOUT = 1000 * 60 * 3;  // 3 minutes
const TRAILING_TIME = 40;  // 40 seconds

export interface CourseAnalyticsDocument extends Document {
  user: string;
  date: Date;
  points: number;
  seconds: number;  // Time use has spent interacting with this course
  lastTime: Date;
}

export type UserStats = {points: number, minutes: number};

interface CourseAnalyticsModel extends Model<CourseAnalyticsDocument> {
  track: (userId: string, points?: number) => Promise<void>;
  getStats: (userId: string, start: Date, end: Date) => Promise<UserStats>;
  getLastWeekStats: (userId: string) => Promise<UserStats>;
}

const CourseAnalyticsSchema = new Schema<CourseAnalyticsDocument, CourseAnalyticsModel>({
  user: {type: String, index: true},
  date: {type: Date, index: true},
  points: {type: Number, default: 0},
  seconds: {type: Number, default: 0},  // Time on page, in seconds
  lastTime: {type: Date, default: new Date(0)}
}, {timestamps: true});

CourseAnalyticsSchema.index({user: 1, date: 1}, {unique: true});

CourseAnalyticsSchema.statics.track = async function(userId: string, points = 0) {
  // TODO Ensure requests are always handled in the correct order (index?).
  // TODO Use client timestamps rather than server timestamps.
  const today = new Date(date.format(new Date(), 'yyyy-MM-dd'));
  let analytics = await CourseAnalytics.findOne({date: today, user: userId});
  if (!analytics) analytics = new CourseAnalytics({date: today, user: userId});

  const dt = (+today) - (+analytics.lastTime);
  if (dt > 0) {
    analytics.seconds += (dt < TIMEOUT) ? Math.round(dt / 1000) : TRAILING_TIME;
    analytics.lastTime = today;
  }
  analytics.points += points;
  await analytics.save();
};

CourseAnalyticsSchema.statics.getLastWeekStats = async function(userId: string) {
  return CourseAnalytics.getStats(userId, date.subDays(new Date(), 7), new Date());
};

CourseAnalyticsSchema.statics.getStats = async function(user: string, start: Date, end: Date) {
  const items = await CourseAnalytics.find({user, date: {$gte: start, $lte: end}}).exec();
  const points = total(items.map(a => a.points));
  const minutes = Math.ceil(total(items.map(a => a.seconds)) / 60);
  return {points, minutes};
};

export const CourseAnalytics = model<CourseAnalyticsDocument, CourseAnalyticsModel>('CourseAnalytics', CourseAnalyticsSchema);


// -----------------------------------------------------------------------------
// Login Analytics

export interface LoginAnalyticsDocument extends Document {
  user: string;
  date: Date;
}

interface LoginAnalyticsModel extends Model<LoginAnalyticsDocument> {
  ping: (user: UserDocument) => Promise<void>;
}

const LoginAnalyticsSchema = new Schema<LoginAnalyticsDocument, LoginAnalyticsModel>({
  user: {type: String, required: true},
  date: {type: Date, required: true}
}, {timestamps: true});

LoginAnalyticsSchema.index({user: 1, date: 1}, {unique: true});

LoginAnalyticsSchema.statics.ping = async function(user: UserDocument) {
  const today = new Date(date.format(new Date(), 'yyyy-MM-dd'));
  if (today <= (user.lastOnline || 0)) return;

  const query = {user: user.id, date: today};
  user.lastOnline = today;

  const p1 = LoginAnalytics.findOneAndUpdate(query, {}, {upsert: true});
  const p2 = user.save();
  await Promise.all([p1, p2]);
};

export const LoginAnalytics = model<LoginAnalyticsDocument, LoginAnalyticsModel>('LoginAnalytics', LoginAnalyticsSchema);
