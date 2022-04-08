// =============================================================================
// Course Progress Model
// (c) Mathigon
// =============================================================================


import {FilterXSS} from 'xss';
import {Document, Model, model, Schema} from 'mongoose';
import express from 'express';
import {safeToJSON, total} from '@mathigon/core';
import {clamp} from '@mathigon/fermat';
import {Section} from '../interfaces';
import {findLastIndex, getCourse} from '../utilities/utilities';

type StepData = Record<string, {scores?: string[], data?: unknown}>;
type MessageData = Array<{content?: string, kind?: string}>;
type SectionData = {completed?: boolean, activeStep?: boolean, messages: MessageData, steps: StepData};

const whiteList = {a: ['href'], strong: [], b: [], em: [], i: [], u: []};
const sanitise = new FilterXSS({whiteList});


// -----------------------------------------------------------------------------
// Interfaces

export type UserProgress = Map<string, ProgressDocument>;

export interface ChangeData {
  activeStep?: string;
  completed?: boolean;
  steps?: Record<string, {scores?: string[], data?: any}>;
}

export interface ProgressBase {
  userId: string;
  courseId: string;
  progress: number;
  sections: Map<string, {progress?: number, completed?: boolean, activeStep?: string}>;
  steps: Map<string, {scores: string[], data?: string}>;
  messages?: MessageData;
}

export interface ProgressDocument extends ProgressBase, Document {
  createdAt: Date;
  updatedAt: Date;
  activeSection: string;
  getJSON: (sectionId?: string) => string;
  getSectionData: (sectionId: string) => Promise<SectionData>;
  getSectionProgress: (section: Section) => number;
  updateData: (sectionId: string, changes: ChangeData) => number;
}

interface ProgressModel extends Model<ProgressDocument> {
  lookup: (req: express.Request, courseId: string, createNew?: boolean) => Promise<ProgressDocument|undefined>;
  delete: (req: express.Request, courseId: string) => Promise<boolean>;
  getUserData: (userId: string) => Promise<UserProgress>;
  getRecentCourses: (userId: string) => Promise<string>;
}


// -----------------------------------------------------------------------------
// Schema

const ProgressSchema = new Schema<ProgressDocument, ProgressModel>({
  userId: {type: String, index: true, required: true},
  courseId: {type: String, required: true},
  progress: {type: Number, default: 0},  // Percentage between 0 and 100

  sections: {
    type: Map as any,
    of: {
      progress: {type: Number, default: 0},  // Percentage between 0 and 100
      completed: {type: Boolean, default: false},
      activeStep: String
    },
    default: {} as any
  },

  steps: {
    type: Map as any,
    of: {scores: [String], data: String},
    default: {} as any
  },

  messages: [{content: String, kind: {type: String, default: 'hint'}}]
}, {timestamps: true});

ProgressSchema.index({userId: 1, courseId: 1}, {unique: true});

ProgressSchema.virtual('activeSection').get(function(this: ProgressDocument) {
  const course = getCourse(this.courseId, 'en')!;

  const status = course.sections.map((section) => {
    const progress = this.sections.get(section.id)?.progress;
    if (!progress) return 'empty';
    if (this.sections.get(section.id)?.completed && progress > 90) return 'completed';
    return 'started';
  });

  // Last section that has been attempted but not completed.
  const lastStarted = status.lastIndexOf('started');

  // Last section that is not completed, but directly after a completed one.
  const lastAfterCompleted = findLastIndex(status,
      (s, i) => (s !== 'completed' && status[i - 1] === 'completed'));

  const p = Math.max(0, lastStarted, lastAfterCompleted);
  return course.sections[p];
});

ProgressSchema.methods.getSectionData = async function(this: ProgressDocument, sectionId: string) {
  const steps: StepData = {};
  // TODO Only return data for steps in the requested section.
  for (const [key, step] of this.steps?.entries() || []) {
    steps[key] = {scores: step.scores, data: step.data ? JSON.parse(step.data) : undefined};
  }

  const section = sectionId ? this.sections?.get(sectionId) : undefined;
  const messages = this.messages?.map(m => ({content: m.content, type: m.kind}));
  return {completed: section?.completed, activeStep: section?.activeStep, messages, steps};
};

ProgressSchema.methods.getSectionProgress = function(section: Section) {
  return (this.sections?.get(section.id)?.progress || 0) / 100;
};

ProgressSchema.methods.updateData = function(sectionId: string, changes: ChangeData) {
  const course = getCourse(this.courseId)!;
  const sectionData = this.sections?.get(sectionId) || {};
  let addedScores = 0;  // Keep track of how many new scores were added

  if ('activeStep' in changes) sectionData.activeStep = changes.activeStep;
  if ('completed' in changes) sectionData.completed = changes.completed;

  for (const [stepId, {scores, data}] of Object.entries(changes.steps || [])) {
    const step = course.steps[stepId];
    if (!step) continue;

    const stepData = this.steps.get(stepId) || {scores: []};

    if (scores) {
      const previousScores = stepData.scores.length;
      stepData.scores = step.goals.filter(id => stepData.scores.includes(id) || scores.includes(id));
      addedScores += stepData.scores.length - previousScores;
    }

    if (data) {
      // TODO Sanitize other data fields. Better validation?
      if (data['free-text']) data['free-text'] = sanitise.process(data['free-text'].slice(0, 500).trim());
      const newData = Object.assign(safeToJSON(stepData.data, {}), data);
      stepData.data = JSON.stringify(newData);
    }

    this.steps.set(stepId, stepData);  // Update Mongoose map
  }

  const section = course.sections.find(s => s.id === sectionId)!;
  const sectionGoals = total(section.steps.map(s => this.steps.get(s)?.scores.length || 0));
  sectionData.progress = clamp(Math.round(sectionGoals / section.goals * 100) || 0, 0, 100);

  const courseGoals = total(course.sections.map(s => this.sections.get(s.id)?.progress || 0));
  this.progress = clamp(Math.round(courseGoals / course.goals * 100) || 0, 0, 100);

  this.sections.set(sectionId, sectionData);  // Update Mongoose map
  return addedScores;
};

ProgressSchema.methods.getJSON = function(this: ProgressDocument, sectionId?: string) {
  // TODO Only return data for steps in the requested section.
  const steps: StepData = {};
  for (const [key, data] of this.steps.entries()) {
    steps[key] = {scores: data.scores, data: data.data ? JSON.parse(data.data) : undefined};
  }

  const section = sectionId ? this.sections.get(sectionId) : undefined;

  return JSON.stringify({
    completed: section ? section.completed : undefined,
    activeStep: section ? section.activeStep : undefined,
    messages: this.messages?.map(m => ({content: m.content, kind: m.kind})),
    steps
  });
};

ProgressSchema.statics.lookup = async function(req: express.Request, courseId: string, createNew = false) {
  const userId = req.user?.id || req.tmpUser || '';
  if (!userId) return undefined;
  const progress = await Progress.findOne({userId, courseId}).exec();
  return createNew ? progress || new Progress({userId, courseId}) : progress;
};

ProgressSchema.statics.delete = async function(req: express.Request, courseId: string) {
  const userId = req.user?.id || req.tmpUser || '';
  const response = await Progress.deleteOne({userId, courseId}).exec();
  return response.deletedCount >= 0;
};

ProgressSchema.statics.getUserData = async function(userId: string) {
  const data = new Map<string, ProgressDocument>();
  const courses = await Progress.find({userId}, '-steps -messages').exec();
  for (const c of courses) data.set(c.courseId, c);
  return data;
};

/** Returns all course IDs which a student has attempted, in order of recency. */
ProgressSchema.statics.getRecentCourses = async function(userId: string) {
  const courses = Array.from((await Progress.getUserData(userId)).values());
  return courses
      .filter(data => data.progress > 0 && data.progress < 100)
      .sort((p, q) => (+q.updatedAt) - (+p.updatedAt))
      .map(p => p.courseId);
};

// -----------------------------------------------------------------------------

export const Progress = model<ProgressDocument, ProgressModel>('Progress', ProgressSchema);
